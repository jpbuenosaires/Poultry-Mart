// rider/endOfShift.js — rider portal: end of shift / hub check-in
'use strict';

/* ════════════════════════════════════════════════════════════
   END OF SHIFT / HUB CHECK-IN
═══════════════════════════════════════════════════════════════*/

let _shiftModalCleanup = null;

async function openShiftModal() {
  const body   = document.getElementById('rider-shift-modal-body');
  const footer = document.getElementById('rider-shift-modal-footer');
  body.innerHTML = spinnerHTML('Building shift summary');
  _shiftModalCleanup = openAccessibleModal('rider-shift-modal-overlay', 'rider-shift-modal-close');

  const res = await apiGet('my_orders');
  if (!res.success) { body.innerHTML = errorHTML(res.message); return; }

  const today      = new Date().toISOString().slice(0, 10);
  const allOrders  = res.data || [];
  const completed  = allOrders.filter(o => o.status === 'Completed' && o.delivery_date === today);
  const failed     = allOrders.filter(o =>
    (o.status === 'Cancelled' || o.status === 'Failed') && o.delivery_date === today);

  let codCollected = 0;
  completed.forEach(o => {
    if (o.payment_method === 'COD' || o.payment_method === 'Cash on Delivery') {
      codCollected += parseFloat(o.final_total ?? o.estimated_total ?? 0);
    }
  });

  const payload = {
    rider_id:      rSession.user?.user_id,
    rider_name:    `${rSession.user?.first_name} ${rSession.user?.last_name}`,
    shift_date:    today,
    completed:     completed.length,
    failed:        failed.length,
    cod_collected: codCollected.toFixed(2),
    order_ids:     completed.map(o => o.order_id),
    failed_ids:    failed.map(o => o.order_id),
    ts:            Date.now(),
  };

  const qrData = encodeURIComponent(JSON.stringify(payload));
  const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qrData}`;

body.innerHTML = `
    <div class="shift-qr-wrapper">
      <p class="shift-qr-hint">Show this QR code to the hub admin to log your shift handoff.</p>
      <img src="${qrUrl}" alt="Shift summary QR code" class="shift-qr-img">
    </div>

    <div class="shift-details-wrapper">
      <h4 class="shift-details-title">Shift Summary — ${today}</h4>
      <div class="shift-stat-grid">
        <div class="shift-stat-box prepaid">
          <div class="shift-stat-val">${completed.length}</div>
          <div class="shift-stat-label">✅ Delivered</div>
        </div>
        <div class="shift-stat-box failed">
          <div class="shift-stat-val">${failed.length}</div>
          <div class="shift-stat-label">❌ Failed Returns</div>
        </div>
        <div class="shift-stat-box cod">
          <div class="shift-stat-val">${fmtPrice(codCollected)}</div>
          <div class="shift-stat-label">💵 COD to Remit</div>
        </div>
      </div>

      ${failed.length ? `
        <h5 class="shift-failed-title">Failed / Return Items:</h5>
        <ul class="shift-failed-list">
          ${failed.map(o => `<li>${escHtml(o.order_number)} — ${escHtml(o.first_name + ' ' + o.last_name)}</li>`).join('')}
        </ul>` : ''}
    </div>`;

  // Store payload on window so the inline onclick can reference it safely
  window._pendingShiftPayload = payload;

  footer.innerHTML = `
    <button class="btn-outline" type="button" onclick="closeShiftModal()">Close</button>
    <button class="btn-primary" type="button" onclick="submitShiftCheckin(window._pendingShiftPayload)">
      <span aria-hidden="true">✅</span> Submit to Hub
    </button>`;
}

function closeShiftModal() {
  closeAccessibleModal('rider-shift-modal-overlay', document.activeElement, _shiftModalCleanup);
  _shiftModalCleanup = null;
}

async function submitShiftCheckin(payload) {
  const res = await apiPost('shift_checkin', payload);
  if (res.success) {
    toast('Shift check-in submitted! Hand over cash to admin. ✅', 'success');
    closeShiftModal();
  } else {
    toast(res.message || 'Failed to submit shift check-in.', 'error');
  }
}

