// customer/orderModals.js — customer portal: cancel order, review, and dispute modals
'use strict';

/* ════════════════════════════════════════════════════════════
   CANCEL ORDER MODAL  [NEW — reason picker]
═══════════════════════════════════════════════════════════════*/

function openCancelModal(orderId) {
  document.getElementById('cancel-order-id').value = orderId;
  document.getElementById('cancel-reason-select').value = 'Changed my mind';
  document.getElementById('cancel-other-wrap').style.display = 'none';
  document.getElementById('cancel-modal-overlay').style.display = 'flex';
}

function closeCancelModal() {
  document.getElementById('cancel-modal-overlay').style.display = 'none';
}

function onCancelReasonChange() {
  const val = document.getElementById('cancel-reason-select').value;
  document.getElementById('cancel-other-wrap').style.display = val === 'Other' ? 'block' : 'none';
}

async function confirmCancelOrder() {
  if (!state.user) return;
  const orderId  = parseInt(document.getElementById('cancel-order-id').value);
  const selected = document.getElementById('cancel-reason-select').value;
  const other    = document.getElementById('cancel-reason-other').value.trim();
  const reason   = selected === 'Other' ? (other || 'Other') : selected;

  const data = await apiFetch(apiUrl('cancel_order'), {
    method: 'POST',
    body:   JSON.stringify({ user_id: state.user.user_id, order_id: orderId, reason }),
  });

  if (data.success) {
    toast('Order cancelled.', 'success');
    closeCancelModal();
    closeOrderModal();
    loadOrders();
    loadNotifications();
  } else {
    toast(data.message || 'Could not cancel order.', 'error');
  }
}

/* ════════════════════════════════════════════════════════════
   REVIEW MODAL  [NEW]
═══════════════════════════════════════════════════════════════*/

let _reviewRating = 0;

function openReviewModal(productId, orderId, productName) {
  _reviewRating = 0;
  document.getElementById('review-product-id').value  = productId;
  document.getElementById('review-order-id').value    = orderId;
  document.getElementById('review-product-name').textContent = productName;
  document.getElementById('review-text').value         = '';
  document.getElementById('review-rating').value       = '0';
  document.getElementById('review-error').style.display = 'none';
  _renderStarPicker(0);
  document.getElementById('review-modal-overlay').style.display = 'flex';
}

function closeReviewModal() {
  document.getElementById('review-modal-overlay').style.display = 'none';
}

function setReviewRating(val) {
  _reviewRating = val;
  document.getElementById('review-rating').value = val;
  _renderStarPicker(val);
}

function _renderStarPicker(active) {
  document.querySelectorAll('.star-pick').forEach(s => {
    const v = parseInt(s.dataset.val);
    s.classList.toggle('star-pick-active', v <= active);
  });
}

async function submitReview() {
  const productId = parseInt(document.getElementById('review-product-id').value);
  const orderId   = parseInt(document.getElementById('review-order-id').value);
  const rating    = parseInt(document.getElementById('review-rating').value);
  const text      = document.getElementById('review-text').value.trim();
  const errEl     = document.getElementById('review-error');
  errEl.style.display = 'none';

  if (!state.user || !productId || !orderId) return;
  if (rating < 1 || rating > 5) {
    errEl.textContent   = 'Please select a rating (1–5 stars).';
    errEl.style.display = 'block';
    return;
  }

  const data = await apiFetch(apiUrl('add_review'), {
    method: 'POST',
    body:   JSON.stringify({ user_id: state.user.user_id, product_id: productId, order_id: orderId, rating, review_text: text }),
  });

  if (data.success) {
    toast('Review submitted! Thank you ⭐', 'success');
    closeReviewModal();
  } else {
    errEl.textContent   = data.message;
    errEl.style.display = 'block';
  }
}

/* ════════════════════════════════════════════════════════════
   DISPUTE MODAL  [NEW]
═══════════════════════════════════════════════════════════════*/

function openDisputeModal(orderId) {
  document.getElementById('dispute-order-id').value        = orderId;
  document.getElementById('dispute-description').value     = '';
  // Reset file input by replacing it with a fresh clone (value='' does not clear file inputs in all browsers)
  const fileInput = document.getElementById('dispute-evidence');
  if (fileInput) {
    const clone = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(clone, fileInput);
  }
  document.getElementById('dispute-error').style.display   = 'none';
  document.getElementById('dispute-modal-overlay').style.display = 'flex';
}

function closeDisputeModal() {
  document.getElementById('dispute-modal-overlay').style.display = 'none';
}

async function submitDispute() {
  const orderId     = parseInt(document.getElementById('dispute-order-id').value);
  const description = document.getElementById('dispute-description').value.trim();
  const fileInput   = document.getElementById('dispute-evidence');
  const errEl       = document.getElementById('dispute-error');
  errEl.style.display = 'none';

  if (!state.user || !orderId) return;
  if (!description) {
    errEl.textContent   = 'Please describe the issue.';
    errEl.style.display = 'block';
    return;
  }

  // Read the selected file as a Base64 data-URL for multipart submission
  let evidenceData = null;
  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    if (file.size > 5 * 1024 * 1024) {
      errEl.textContent   = 'Photo file must be 5 MB or smaller.';
      errEl.style.display = 'block';
      return;
    }
    evidenceData = await new Promise((resolve, reject) => {
      const reader  = new FileReader();
      reader.onload  = () => resolve(reader.result);   // data:image/...;base64,...
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.readAsDataURL(file);
    });
  }

  const data = await apiFetch(apiUrl('file_dispute'), {
    method: 'POST',
    body:   JSON.stringify({ user_id: state.user.user_id, order_id: orderId, description, evidence_data: evidenceData }),
  });

  if (data.success) {
    toast('Issue reported. Our team will review it. 📋', 'success');
    closeDisputeModal();
    // Re-open the order detail to show the new dispute status
    showOrderDetail(orderId);
  } else {
    errEl.textContent   = data.message;
    errEl.style.display = 'block';
  }
}

