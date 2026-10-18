// rider/podSignature.js — rider portal: proof-of-delivery image handling and signature pad
'use strict';

/* ── POD image handling ─────────────────────────────────── */

function handlePodFileChange(evt) {
  const file = evt.target.files[0];
  if (file) processPodFile(file);
}

function handlePodDrop(evt) {
  evt.preventDefault();
  document.getElementById('pod-upload-area')?.classList.remove('dragover');
  const file = evt.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) processPodFile(file);
  else if (file) toast('Please drop an image file.', 'error');
}

function processPodFile(file) {
  if (file.size > 15 * 1024 * 1024) {
    toast('Image too large. Maximum size is 15 MB before compression.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX_WIDTH  = 800;
      const scale      = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
      const canvas     = document.createElement('canvas');
      canvas.width     = Math.round(img.width  * scale);
      canvas.height    = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl    = canvas.toDataURL('image/jpeg', 0.55);
      rModal.podData   = dataUrl.split(',')[1];
      rModal.podMime   = 'image/jpeg';

      const preview    = document.getElementById('pod-preview');
      const previewImg = document.getElementById('pod-preview-img');
      const uploadArea = document.getElementById('pod-upload-area');

      previewImg.src    = dataUrl;
      preview.hidden    = false;
      uploadArea.hidden = true;
      preview.querySelector('button')?.focus();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removePod() {
  rModal.podData = null;
  rModal.podMime = null;

  const preview    = document.getElementById('pod-preview');
  const uploadArea = document.getElementById('pod-upload-area');
  const fileInput  = document.getElementById('pod-file-input');

  preview.hidden    = true;
  uploadArea.hidden = false;
  if (fileInput) fileInput.value = '';
  uploadArea.focus();
}

/* ── Signature Pad ──────────────────────────────────────── */

let _sigDrawing = false;

function switchPodTab(tab) {
  const photoPanel = document.getElementById('pod-panel-photo');
  const sigPanel   = document.getElementById('pod-panel-sig');
  const photoTab   = document.getElementById('pod-tab-photo');
  const sigTab     = document.getElementById('pod-tab-sig');
  if (tab === 'photo') {
    photoPanel.hidden = false; sigPanel.hidden = true;
    photoTab.setAttribute('aria-selected', 'true');   photoTab.classList.add('active');
    sigTab.setAttribute('aria-selected', 'false');    sigTab.classList.remove('active');
  } else {
    photoPanel.hidden = true;  sigPanel.hidden = false;
    sigTab.setAttribute('aria-selected', 'true');     sigTab.classList.add('active');
    photoTab.setAttribute('aria-selected', 'false');  photoTab.classList.remove('active');
    initSignaturePad();
  }
}

function initSignaturePad() {
  const canvas = document.getElementById('pod-sig-canvas');
  if (!canvas || canvas._sigInit) return;
  canvas._sigInit = true;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / r.width;
    const scaleY = canvas.height / r.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
  }
  canvas.addEventListener('pointerdown', (e) => {
    _sigDrawing = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!_sigDrawing) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  });
  ['pointerup', 'pointerleave'].forEach(ev =>
    canvas.addEventListener(ev, () => { _sigDrawing = false; }));
}

function clearSignaturePad() {
  const canvas = document.getElementById('pod-sig-canvas');
  if (!canvas) return;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  const status = document.getElementById('sig-capture-status');
  if (status) status.textContent = '';
  rModal.podData = null;
  rModal.podMime = null;
}

function captureSignature() {
  const canvas = document.getElementById('pod-sig-canvas');
  if (!canvas) return;
  const dataUrl  = canvas.toDataURL('image/jpeg', 0.8);
  rModal.podData = dataUrl.split(',')[1];
  rModal.podMime = 'image/jpeg';
  const status   = document.getElementById('sig-capture-status');
  if (status) {
    status.textContent = '✅ Signature captured! You can now confirm the delivery.';
    status.style.color = 'var(--success,#16a34a)';
  }
}

