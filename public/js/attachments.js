/**
 * File upload, preview rendering, drag-and-drop, and lightbox.
 */

/* === Allowed file types (must match AttachmentUploadService::ALLOWED_MIME_TYPES) === */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

/* === Ticket File Upload === */

function handleFiles(fileList) {
  for (const f of fileList) {
    if (!ALLOWED_MIME_TYPES.includes(f.type)) {
      alert(f.name + ': only images (JPEG, PNG, GIF, WebP) and PDFs are allowed');
      continue;
    }
    selectedFiles.push(f);
  }
  renderPreviews();
}

function renderPreviews() {
  const strip = document.getElementById('preview-strip');

  // Revoke old blob URLs to prevent memory leaks
  strip.querySelectorAll('img').forEach(el => {
    if (el.src.startsWith('blob:')) URL.revokeObjectURL(el.src);
  });

  strip.innerHTML = selectedFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return '<div class="preview-thumb"><img src="' + url + '" />' +
      '<button class="preview-remove" onclick="removeFile(' + i + ')">✕</button></div>';
  }).join('');
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderPreviews();
}

/* === Requisition File Upload === */

function handleReqFiles(fileList) {
  for (const f of fileList) {
    if (!ALLOWED_MIME_TYPES.includes(f.type)) {
      alert(f.name + ': only images (JPEG, PNG, GIF, WebP) and PDFs are allowed');
      continue;
    }
    reqSelectedFiles.push(f);
  }
  renderReqPreviews();
}

function renderReqPreviews() {
  const strip = document.getElementById('req-preview-strip');

  // Revoke old blob URLs to prevent memory leaks
  strip.querySelectorAll('img').forEach(el => {
    if (el.src.startsWith('blob:')) URL.revokeObjectURL(el.src);
  });

  strip.innerHTML = reqSelectedFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    const preview = f.type === 'application/pdf'
      ? '<div style="font-size:10px;padding:6px 4px;text-align:center;word-break:break-all;color:#555">📄 ' + esc(f.name) + '</div>'
      : '<img src="' + url + '" />';
    return '<div class="preview-thumb">' + preview +
      '<button class="preview-remove" onclick="removeReqFile(' + i + ')">✕</button></div>';
  }).join('');

  feather.replace();
}

function removeReqFile(index) {
  reqSelectedFiles.splice(index, 1);
  renderReqPreviews();
}

/* === Drag & Drop === */

function initDropZone() {
  const zone = document.getElementById('drop-zone');
  if (!zone) return;

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
}

/* === Lightbox === */

function openLightbox(src) {
  const content = document.getElementById('lightbox-content');
  content.innerHTML = '<img src="' + src + '" style="max-width:90vw;max-height:90vh" />';
  document.getElementById('lightbox').classList.add('active');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
}
