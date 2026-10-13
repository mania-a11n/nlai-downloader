process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

exports.handler = async function(event, context) {
  try {
    const params = event.queryStringParameters || {};
    const inputUrl = params.url || params.id || '';
    const action = params.action || 'image';
    const requestedPn = parseInt(params.pn || '1', 10);

    if (!inputUrl) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'لطفاً لینک یا شناسه را وارد کنید' })
      };
    }

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
        body: JSON.stringify({ error: 'شناسه سند (ID یا cid) یافت نشد' })
      };
    }

    // دریافت تعداد کل صفحات
    if (action === 'info') {
      let totalPages = 5;
      let isEstimated = true;

      try {
        let displayUrl = `https://dl.nlai.ir/UI/Forms/DisplayImage.aspx?cid=${cid}&pn=1`;
        if (docId) displayUrl += `&id=${docId}&db=false`;

        const pageRes = await fetch(displayUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://dl.nlai.ir/'
          }
        });

        if (pageRes.ok) {
          const html = await pageRes.text();
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
      } catch (e) {}

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ cid, docId, totalPages, isEstimated })
      };
    }

    // دریافت تصویر اصلی صفحه
    let targetImageUrl = `https://dl.nlai.ir/UI/Controls/ImageHandler.ashx?ID=${cid}`;
    let displayUrl = `https://dl.nlai.ir/UI/Forms/DisplayImage.aspx?cid=${cid}&pn=${requestedPn}`;
    if (docId) displayUrl = `https://dl.nlai.ir/UI/Forms/DisplayImage.aspx?id=${docId}&db=false&pn=${requestedPn}&cid=${cid}`;

    try {
      const displayPageRes = await fetch(displayUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://dl.nlai.ir/'
        }
      });

      if (displayPageRes.ok) {
        const htmlText = await displayPageRes.text();
        const imgMatch = htmlText.match(/src=["']([^"']*ImageHandler\.ashx[^"']*)["']/i) || 
                         htmlText.match(/href=["']([^"']*ImageHandler\.ashx[^"']*)["']/i);
        
        if (imgMatch && imgMatch[1]) {
          const rawSrc = imgMatch[1];
          if (rawSrc.startsWith('http')) {
            targetImageUrl = rawSrc;
          } else {
            const cleanPath = rawSrc.replace(/^\.\.\//, '').replace(/^\//, '');
            targetImageUrl = `https://dl.nlai.ir/UI/${cleanPath}`;
          }
        }
      }
    } catch (e) {}

    const imgRes = await fetch(targetImageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://dl.nlai.ir/'
      }
    });

    if (!imgRes.ok) {
      return {
        statusCode: imgRes.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: `تصویر صفحه ${requestedPn} یافت نشد` })
      };
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg',
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
