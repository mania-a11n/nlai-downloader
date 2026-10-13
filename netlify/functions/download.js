// netlify/functions/download.js

const ALLOWED_HOST = "dl.nlai.ir";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function getParam(url, name) {
  try {
    return new URL(url).searchParams.get(name);
  } catch {
    return null;
  }
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return json({ error: "فقط POST پشتیبانی می‌شود." }, 405);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: "درخواست JSON معتبر نیست." }, 400);
  }

  let source;

  try {
    source = new URL(body.url);
  } catch {
    return json({ error: "لینک واردشده معتبر نیست." }, 400);
  }

  if (
    source.hostname !== ALLOWED_HOST ||
    source.pathname.toLowerCase() !==
      "/ui/controls/imageform.aspx"
  ) {
    return json({
      error: "لینک صفحه ImageForm از dl.nlai.ir را وارد کنید.",
    }, 400);
  }

  const collectionId =
    source.searchParams.get("ID") ||
    source.searchParams.get("id");

  if (!collectionId) {
    return json({
      error: "شناسه ID در لینک پیدا نشد.",
    }, 400);
  }

  try {
    const response = await fetch(source.href, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return json({
        error: `خطای سایت منبع: ${response.status}`,
      }, 502);
    }

    const html = await response.text();

    // جست‌وجوی لینک‌های DisplayImage در HTML
    const matches = [
      ...html.matchAll(
        /DisplayImage\.aspx\?[^"'<>\\\s]+/gi
      ),
    ];

    const displayUrls = matches
      .map((match) => {
        let value = match[0]
          .replace(/&amp;/gi, "&")
          .replace(/\\u0026/g, "&");

        try {
          return new URL(
            value.startsWith("/")
              ? value
              : "/UI/Forms/" + value,
            source.origin
          );
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    let imageId = null;
    let cid = collectionId;
    let pageCount = 0;

    for (const url of displayUrls) {
      imageId ||= url.searchParams.get("id");
      cid = url.searchParams.get("cid") || cid;

      pageCount = Math.max(
        pageCount,
        Number(url.searchParams.get("pn")) || 0
      );
    }

    // الگوهای عمومی برای تشخیص تعداد صفحه
    const countPatterns = [
      /(?:totalPages|pageCount|PageCount|TotalPages)\s*[:=]\s*["']?(\d+)/gi,
      /(?:تعداد\s*صفحه(?:ات)?|صفحات)\s*[:：]?\s*(\d+)/g,
    ];

    for (const pattern of countPatterns) {
      for (const match of html.matchAll(pattern)) {
        pageCount = Math.max(
          pageCount,
          Number(match[1]) || 0
        );
      }
    }

    if (!imageId) {
      return json({
        error:
          "شناسه تصویر در HTML پیدا نشد. باید ساختار واقعی صفحه بررسی شود.",
      }, 422);
    }

    if (pageCount < 1) {
      return json({
        error:
          "تعداد صفحات تشخیص داده نشد؛ لینک‌های صفحه بعد باید بررسی شوند.",
      }, 422);
    }

    if (pageCount > 500) {
      return json({
        error: "تعداد صفحه غیرعادی است.",
      }, 422);
    }

    const pages = Array.from(
      { length: pageCount },
      (_, index) => {
        const pageNumber = index + 1;

        const imagePage = new URL(
          "/UI/Forms/DisplayImage.aspx",
          source.origin
        );

        imagePage.searchParams.set("id", imageId);
        imagePage.searchParams.set("db", "false");
        imagePage.searchParams.set("pn", String(pageNumber));
        imagePage.searchParams.set("cid", cid);

        return {
          page: pageNumber,
          imagePageUrl: imagePage.href,

          // فعلاً آدرس صفحه است، نه فایل واقعی thumbnail
          thumbnailUrl: imagePage.href,
        };
      }
    );

    return json({
      collectionId: cid,
      imageId,
      pageCount,
      pages,
      note:
        "آدرس واقعی تامبنیل هنوز از سایت منبع استخراج نشده است.",
    });
  } catch (error) {
    return json({
      error:
        "ارتباط با سایت منبع ناموفق بود. ممکن است دسترسی سروری محدود شده باشد.",
    }, 502);
  }
};
