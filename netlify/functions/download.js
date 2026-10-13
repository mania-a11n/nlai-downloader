export async function handler(event) {
  const urlParam = event.queryStringParameters?.url;
  const idParam = event.queryStringParameters?.id;
  
  let targetId = idParam;
  if (!targetId && urlParam) {
    const match = urlParam.match(/ID=([a-f0-9\-]+)/i);
    if (match) targetId = match[1];
  }

  if (!targetId) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'شناسه یا لینک معتبر یافت نشد' })
    };
  }

  const targetUrl = `https://dl.nlai.ir/UI/Controls/ImageHandler.ashx?ID=${targetId}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://dl.nlai.ir/'
      }
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'خطا در دریافت تصویر از سرور کتابخانه ملی' })
      };
    }

    const buffer = await response.arrayBuffer();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      },
      body: Buffer.from(buffer).toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'خطای داخلی سرور' })
    };
  }
}
