// rider/completeDelivery.js — rider portal: complete delivery modal
'use strict';

/* ════════════════════════════════════════════════════════════
   COMPLETE DELIVERY MODAL  (POD upload + confirmation)
═══════════════════════════════════════════════════════════════*/

function openCompleteModal(orderId) {
  const order = rSession.orders.active.find(o => o.order_id == orderId)
             || (rModal.order?.order_id == orderId ? rModal.order : null);

  closeOrderModal();

  // Require barcode scan confirmation before opening modal
  const scanKey = `scan_confirmed_${orderId}`;
  if (!sessionStorage.getItem(scanKey)) {
    showScanGuard(orderId, order, () => {
      sessionStorage.setItem(scanKey, '1');
      if (!order) openCompleteModalFetch(orderId);
      else _renderCompleteModal(order);
    });
    return;
  }

  if (!order) {
    openCompleteModalFetch(orderId);
    return;
  }
  _renderCompleteModal(order);
}

function showScanGuard(orderId, order, onConfirmed) {
  const orderNum = order?.order_number || String(orderId);
  // Build a lightweight inline scan-guard overlay
  const overlay = document.createElement('div');
  overlay.id    = 'scan-guard-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'scan-guard-title');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.innerHTML = `
    <div style="background:var(--surface,#fff);border-radius:14px;padding:1.5rem;max-width:420px;width:100%;text-align:center">
      <div style="font-size:2rem;margin-bottom:.5rem" aria-hidden="true">📦</div>
      <h2 id="scan-guard-title" style="margin:0 0 .5rem;font-size:1.1rem">Scan Package Barcode</h2>
      <p style="font-size:.9rem;color:var(--text-muted,#6b7280);margin-bottom:1rem">
        Scan the thermal label on the package to confirm this is Order <strong>${escHtml(orderNum)}</strong>.
      </p>
      <input id="scan-guard-input" type="text" class="form-input"
        placeholder="Scan barcode or enter order number…"
        style="text-align:center;font-size:1.1rem;letter-spacing:.05em;margin-bottom:.75rem"
        autocomplete="off" autofocus>
      <p id="scan-guard-error" style="color:var(--error,#ef4444);font-size:.85rem;min-height:1.2em"></p>
      <div style="display:flex;gap:.5rem;justify-content:center;margin-top:.5rem">
        <button class="btn-outline" type="button" onclick="document.getElementById('scan-guard-overlay').remove()">
          Cancel
        </button>
        <button class="btn-primary" type="button" id="scan-guard-confirm">
          <span aria-hidden="true">✅</span> Confirm Scan
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input   = overlay.querySelector('#scan-guard-input');
  const errEl   = overlay.querySelector('#scan-guard-error');
  const confirm = overlay.querySelector('#scan-guard-confirm');
  input.focus();

  function validate() {
    const val = input.value.trim();
    if (!val) { errEl.textContent = 'Please scan or enter the barcode.'; return; }
    // Accept the order number itself, the numeric order_id, or any value containing them
    if (val === orderNum || val === String(orderId) || val.includes(orderNum) || val.includes(String(orderId))) {
      overlay.remove();
      onConfirmed();
    } else {
      errEl.textContent = `Barcode does not match Order ${orderNum}. Check the label and try again.`;
      input.value = '';
      input.focus();
    }
  }
  confirm.addEventListener('click', validate);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') validate(); });
}

async function openCompleteModalFetch(orderId) {
  const res = await apiGet('order', { id: orderId });
  if (res.success) _renderCompleteModal(res.data);
  else toast(res.message || 'Could not load order.', 'error');
}

function _renderCompleteModal(o) {
  rModal.order   = o;
  rModal.podData = null;
  rModal.podMime = null;

  const finalAmt = o.final_total ?? o.estimated_total;
  const body     = document.getElementById('rider-complete-modal-body');
  const footer   = document.getElementById('rider-complete-modal-footer');

  document.getElementById('rider-complete-modal-title').textContent =
    'Complete — ' + o.order_number;

  const isCOD            = o.payment_method === 'COD' || o.payment_method === 'Cash on Delivery';
  const isGCash          = o.payment_method === 'GCash';
  const gcashUnverified  = isGCash && (o.pay_status === 'Unverified' || o.pay_status === 'Pending');

  body.innerHTML = `
    <section class="detail-section" aria-labelledby="complete-amount-title">
      <h3 class="detail-section-title" id="complete-amount-title">Amount to Collect</h3>
      <div class="rider-confirm-amount" style="display:block;margin-bottom:0">
        <div class="amount-label">
          ${escHtml(o.final_total ? 'Final Total' : 'Estimated Total')} ·
          <span aria-hidden="true">${payIcon(o.payment_method)}</span> ${escHtml(o.payment_method)}
        </div>
        <div class="amount-value" aria-label="Amount: ${fmtPrice(finalAmt)}">${fmtPrice(finalAmt)}</div>
      </div>
      ${isCOD ? `
        <div class="cod-collect-banner" role="alert" aria-live="assertive"
          style="background:var(--warning,#f59e0b);color:#000;border-radius:8px;padding:1rem;margin-top:.75rem;font-size:1.1rem;font-weight:700;text-align:center;">
          <span aria-hidden="true">💵</span>
          COLLECT CASH: <span style="font-size:1.4rem">${fmtPrice(finalAmt)}</span>
          <div style="font-size:.85rem;font-weight:400;margin-top:.25rem">
            Hand the customer their items only after collecting the exact amount above.
          </div>
        </div>` : ''}
      ${gcashUnverified ? `
        <div class="gcash-unverified-warning" role="alert" aria-live="assertive"
          style="background:var(--error,#ef4444);color:#fff;border-radius:8px;padding:1rem;margin-top:.75rem;font-weight:600;text-align:center;">
          <span aria-hidden="true">🚫</span>
          GCash payment is <strong>UNVERIFIED</strong>.<br>
          <span style="font-size:.9rem;font-weight:400">Do NOT hand over the package.<br>Contact admin for payment clearance before proceeding.</span>
        </div>` : ''}
      ${isGCash && !gcashUnverified ? `
        <div class="gcash-notice" role="note">
          <span aria-hidden="true">💙</span>
          <strong>GCash order:</strong> Payment verified. Do <em>not</em> collect cash.
        </div>` : ''}
      ${!o.final_total ? `
        <p class="estimated-warning" role="note">
          <span aria-hidden="true">⚠️</span>
          Final weight not yet recorded. Collect the estimated amount; it will be reconciled by staff.
        </p>` : ''}
    </section>

    <section class="detail-section" aria-labelledby="pod-section-title">
      <h3 class="detail-section-title" id="pod-section-title">
        Proof of Delivery
        <span class="optional-label" aria-hidden="true">(optional but recommended)</span>
      </h3>

      <!-- POD tab switcher -->
      <div role="tablist" aria-label="Proof of delivery method" style="display:flex;gap:.5rem;margin-bottom:.75rem">
        <button class="tab-btn btn-outline btn-sm active" role="tab" aria-selected="true"
          id="pod-tab-photo" aria-controls="pod-panel-photo"
          onclick="switchPodTab('photo')" type="button">
          <span aria-hidden="true">📷</span> Photo
        </button>
        <button class="tab-btn btn-outline btn-sm" role="tab" aria-selected="false"
          id="pod-tab-sig" aria-controls="pod-panel-sig"
          onclick="switchPodTab('sig')" type="button">
          <span aria-hidden="true">✍️</span> Signature
        </button>
      </div>

      <!-- Photo tab -->
      <div id="pod-panel-photo" role="tabpanel" aria-labelledby="pod-tab-photo">
        <div id="pod-upload-area" class="pod-upload-area"
          role="button" tabindex="0"
          aria-label="Upload proof of delivery photo. Click or press Enter to browse."
          onclick="document.getElementById('pod-file-input').click()"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.getElementById('pod-file-input').click()}"
          ondragover="event.preventDefault();this.classList.add('dragover')"
          ondragleave="this.classList.remove('dragover')"
          ondrop="handlePodDrop(event)">
          <span class="pod-upload-icon" aria-hidden="true">📷</span>
          <p class="pod-upload-text">
            <strong>Click or drag</strong> to upload a photo<br>
            <small>JPG, PNG, HEIC — max 15 MB (auto-compressed)</small>
          </p>
        </div>
        <input type="file" id="pod-file-input" accept="image/*" class="sr-only"
          aria-label="Select proof of delivery image"
          onchange="handlePodFileChange(event)">
        <div id="pod-preview" class="pod-preview" aria-live="polite" hidden>
          <img id="pod-preview-img" src="" alt="Proof of delivery preview">
          <button class="pod-preview-remove" type="button"
            onclick="removePod()" aria-label="Remove proof of delivery photo">
            <span aria-hidden="true">🗑️</span> Remove photo
          </button>
        </div>
      </div>

      <!-- Signature tab -->
      <div id="pod-panel-sig" role="tabpanel" aria-labelledby="pod-tab-sig" hidden>
        <p style="font-size:.85rem;color:var(--text-muted,#6b7280);margin-bottom:.5rem">
          Ask the customer to sign below with their finger.
        </p>
        <canvas id="pod-sig-canvas"
          style="width:100%;height:180px;border:2px solid var(--border,#e5e7eb);border-radius:8px;background:#fff;touch-action:none;cursor:crosshair"
          aria-label="Customer signature pad"
          width="600" height="180">
        </canvas>
        <div style="display:flex;gap:.5rem;margin-top:.5rem">
          <button class="btn-outline btn-sm" type="button" onclick="clearSignaturePad()">
            <span aria-hidden="true">🗑️</span> Clear
          </button>
          <button class="btn-primary btn-sm" type="button" onclick="captureSignature()">
            <span aria-hidden="true">✅</span> Use Signature
          </button>
        </div>
        <p id="sig-capture-status" style="font-size:.85rem;margin-top:.4rem" aria-live="polite"></p>
      </div>
    </section>

    <p id="complete-error" class="form-error" role="alert" aria-live="assertive" hidden></p>`;

  const _gcashLocked = (o.payment_method === 'GCash') &&
    (o.pay_status === 'Unverified' || o.pay_status === 'Pending');

  footer.innerHTML = `
    <button class="btn-outline" type="button" onclick="closeCompleteModal()">Cancel</button>
    <button class="btn-primary" id="complete-confirm-btn" type="button"
      onclick="submitCompleteOrder()"
      ${_gcashLocked ? 'disabled aria-disabled="true"' : ''}>
      <span aria-hidden="true">✅</span> Confirm Delivery Complete
    </button>
    ${_gcashLocked ? `
      <p role="alert" style="width:100%;text-align:center;color:var(--error,#ef4444);font-size:.85rem;margin-top:.5rem">
        <span aria-hidden="true">🔒</span> Contact Admin for Payment Clearance
      </p>` : ''}`;

  _completeModalCleanup = openAccessibleModal('rider-complete-modal-overlay', 'complete-confirm-btn');
}

function closeCompleteModal() {
  // Clear scan guard so the same order can be re-scanned if reopened
  if (rModal.order?.order_id) {
    sessionStorage.removeItem(`scan_confirmed_${rModal.order.order_id}`);
  }
  closeAccessibleModal(
    'rider-complete-modal-overlay',
    rConfirm.previousFocus || document.activeElement,
    _completeModalCleanup);
  _completeModalCleanup = null;
  rModal.podData        = null;
  rModal.podMime        = null;
}

