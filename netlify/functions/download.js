process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

exports.handler = async function(event, context) {
  try {
    const params = event.queryStringParameters || {};
    const action = params.action || 'image';
    const urlParam = params.url || params.id;

    if (!urlParam) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'لطفاً لینک یا شناسه را وارد کنید' })
      };
    }

    // استخراج GUID
    let targetId = null;
    const guidMatch = urlParam.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (guidMatch) {
      targetId = guidMatch[1];
    } else {
      const match = urlParam.match(/ID=([^&]+)/i);
      if (match) targetId = match[1];
    }

    if (!targetId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'شناسه معتبر یا لینک استاندارد یافت نشد' })
      };
    }

    // --- بخش اول: دریافت اطلاعات و لیست تمام صفحات ---
    if (action === 'info') {
      const pageUrl = `https://dl.nlai.ir/UI/Controls/ImageForm.aspx?ID=${targetId}`;
      
      try {
        const pageRes = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://dl.nlai.ir/'
          }
        });

        if (!pageRes.ok) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ total: 1, pages: [targetId], initialIndex: 0 })
          };
        }

        const htmlText = await pageRes.text();
        const allGuids = htmlText.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi) || [];
        
        // حذف موارد تکراری با حفظ ترتیب
        const uniqueGuids = [];
        for (const id of allGuids) {
          const lowerId = id.toLowerCase();
          if (!uniqueGuids.includes(lowerId)) {
            uniqueGuids.push(lowerId);
          }
        }

        if (!uniqueGuids.includes(targetId.toLowerCase())) {
          uniqueGuids.unshift(targetId.toLowerCase());
        }

        const initialIndex = uniqueGuids.indexOf(targetId.toLowerCase());

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            total: uniqueGuids.length,
            pages: uniqueGuids,
            initialIndex: initialIndex >= 0 ? initialIndex : 0
          })
        };
      } catch (err) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ total: 1, pages: [targetId], initialIndex: 0 })
        };
      }
    }

    // --- بخش دوم: دریافت تصویر صفحه درخواستی ---
    const targetUrl = `https://dl.nlai.ir/UI/Controls/ImageHandler.ashx?ID=${targetId}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://dl.nlai.ir/'
      }
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: `خطا در دریافت تصویر (کد ${response.status})` })
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: `خطای سرور: ${err.message}` })
    };
  }
};
