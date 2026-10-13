let currentId = '';
let currentPage = 1;

// استخراج شناسه ID از URL
function extractId(url) {
  try {
    const urlObj = new URL(url.trim());
    const params = new URLSearchParams(urlObj.search);
    return params.get('ID') || params.get('id') || params.get('cid');
  } catch (e) {
    return null;
  }
}

// ساخت آدرس تصویر بر اساس ID و صفحه
function buildImageUrl(id, page) {
  return `https://dl.nlai.ir/UI/Forms/DisplayImage.aspx?id=${id}&db=false&pn=${page}&cid=${id}`;
}

// بارگذاری اولیه سند
function loadDocument() {
  const input = document.getElementById('urlInput').value;
  const errorDiv = document.getElementById('errorMsg');
  errorDiv.innerText = '';

  const extractedId = extractId(input);
  if (!extractedId) {
    errorDiv.innerText = 'شناسه (ID) معتبر از لینک استخراج نشد. لطفاً آدرس را بررسی کنید.';
    return;
  }

  currentId = extractedId;
  currentPage = 1;
  updateViewer();
  document.getElementById('viewerSection').style.display = 'block';
}

// تغییر شماره صفحه (+1 یا -1)
function changePage(delta) {
  if (currentPage + delta < 1) return;
  currentPage += delta;
  updateViewer();
}

// به‌روزرسانی تصویر و دکمه‌ها
function updateViewer() {
  const imgUrl = buildImageUrl(currentId, currentPage);
  const imgElem = document.getElementById('docImage');
  const pageDisp = document.getElementById('pageDisplay');
  const prevBtn = document.getElementById('prevBtn');
  const directLink = document.getElementById('directLink');

  imgElem.src = imgUrl;
  pageDisp.innerText = currentPage;
  prevBtn.disabled = currentPage <= 1;
  directLink.innerHTML = `آدرس تصویر جاری: <a href="${imgUrl}" target="_blank" rel="noopener noreferrer">${imgUrl}</a>`;
}

// باز کردن تصویر در تب جدید
function openInNewTab() {
  if (!currentId) return;
  const imgUrl = buildImageUrl(currentId, currentPage);
  window.open(imgUrl, '_blank');
}

// اتصال رویدادها (Event Listeners) پس از بارگذاری DOM
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loadBtn').addEventListener('click', loadDocument);
  document.getElementById('prevBtn').addEventListener('click', () => changePage(-1));
  document.getElementById('nextBtn').addEventListener('click', () => changePage(1));
  document.getElementById('openTabBtn').addEventListener('click', openInNewTab);

  // امکان بارگذاری با کلید Enter در کادر ورودی
  document.getElementById('urlInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loadDocument();
    }
  });
});
