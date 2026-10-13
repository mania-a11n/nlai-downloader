process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

exports.handler = async function(event, context) {
  try {
    const params = event.queryStringParameters || {};
    const inputUrl = params.url || '';

    if (!inputUrl) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'لطفاً لینک را وارد کنید' })
      };
    }

    // استخراج دقیق شناسه سند (cid / ID)
    let cid = null;
    let docId = null;

    const cidMatch = inputUrl.match(/cid=([a-f0-9\-]+)/i) || inputUrl.match(/ID=([a-f0-9\-]+)/i);
    if (cidMatch) cid = cidMatch[1];

    const idMatch = inputUrl.match(/[?&]id=([a-f0-9\-]+)/i);
    if (idMatch && idMatch[1].toLowerCase() !== cid?.toLowerCase()) {
      docId = idMatch[1];
    }

    if (!cid) {
      const guidMatch = inputUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (guidMatch) cid = guidMatch[1];
    }

    if (!cid) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'شناسه معتبر در لینک یافت نشد' })
      };
    }

    // --- محاسبه تعداد کل صفحات ---
    let totalPages = 50; 
    let isEstimated = true;
    let currentDocId = docId;

    try {
      let displayUrl = `https://dl.nlai.ir/UI/Forms/DisplayImage.aspx?cid=${cid}&pn=1`;
      if (currentDocId) displayUrl += `&id=${currentDocId}&db=false`;

      const pageRes = await fetch(displayUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://dl.nlai.ir/'
        }
      });

      if (pageRes.ok) {
        const html = await pageRes.text();
        
        // پیدا کردن ID مخفی جلسه اگر در لینک نبود
        if (!currentDocId) {
          const extractedDocId = html.match(/id=([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
          if (extractedDocId) currentDocId = extractedDocId[1];
        }

        const optionMatches = html.match(/<option[^>]*value=["']?(\d+)["']?[^>]*>/gi);
        if (optionMatches && optionMatches.length > 0) {
          totalPages = optionMatches.length;
          isEstimated = false;
        } else {
          const totalMatch = html.match(/از\s*(\d+)/) || html.match(/PageCount["']?\s*:\s*(\d+)/i);
          if (totalMatch) {
            totalPages = parseInt(totalMatch[1], 10);
            isEstimated = false;
          }
        }
      }
    } catch (e) {
      // در صورت فیلتر شدن درخواست توسط کتابخانه ملی، مقادیر تخمینی برمی‌گردد
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ cid, docId: currentDocId, totalPages, isEstimated })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: `خطای سرور: ${err.message}` })
    };
  }
};
