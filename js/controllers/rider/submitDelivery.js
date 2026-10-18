// rider/submitDelivery.js — rider portal: submit complete order
'use strict';

/* ── Submit complete order ──────────────────────────────── */

async function submitCompleteOrder() {
  const btn   = document.getElementById('complete-confirm-btn');
  const errEl = document.getElementById('complete-error');
  const order = rModal.order;
  if (!order) return;

  errEl.hidden    = true;
  btn.disabled    = true;
  btn.textContent = 'Verifying…';

  // Pre-flight: confirm order is still assigned to this rider and out for delivery
  try {
    const check = await apiGet('order', { id: order.order_id });
    if (check.success) {
      const live = check.data;
      if (live.status === 'Cancelled') {
        errEl.textContent = 'This order has been cancelled. Please return to hub.';
        errEl.hidden = false;
        btn.disabled = false;
        btn.innerHTML = '<span aria-hidden="true">✅</span> Confirm Delivery Complete';
        showCancellationAlert(order.order_number);
        return;
      }
      if (live.status === 'Completed') {
        errEl.textContent = 'This order has already been marked as Completed.';
        errEl.hidden = false;
        btn.disabled = false;
        btn.innerHTML = '<span aria-hidden="true">✅</span> Confirm Delivery Complete';
        return;
      }
      if (!['Out for Delivery', 'Arrived at Location'].includes(live.status)) {
        errEl.textContent = `Order status changed to "${live.status}". Cannot complete now.`;
        errEl.hidden = false;
        btn.disabled = false;
        btn.innerHTML = '<span aria-hidden="true">✅</span> Confirm Delivery Complete';
        return;
      }
    }
  } catch { /* network check failed — proceed optimistically */ }

  btn.textContent = 'Processing…';

  // FIX: Send base64 data-URI so the server can decode and save it as a file.
  // The data-URI format (data:<mime>;base64,<data>) is what the patched
  // rider_api.php expects. We no longer embed raw base64 directly in JSON
  // to stay within the VARCHAR(500) proof_of_delivery_url column — the API
  // now writes the image to disk and stores only the short file path.
  const proof_url = rModal.podData
    ? `data:${rModal.podMime};base64,${rModal.podData}`
    : '';

  // Capture geolocation for backend audit trail
  let delivery_lat = null;
  let delivery_lng = null;
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }));
    delivery_lat = pos.coords.latitude;
    delivery_lng = pos.coords.longitude;
  } catch { /* geolocation unavailable — proceed without coordinates */ }

  let res;
  try {
    res = await apiPost('complete_order', {
      order_id: order.order_id,
      proof_url,
      delivery_lat,
      delivery_lng,
    });
  } catch {
    res = { success: false, _network: true };
  }

  if (!res.success && res._network) {
    offlineQueueAdd('complete_order', { order_id: order.order_id, proof_url, delivery_lat, delivery_lng });
    closeCompleteModal();
    toast('No signal — delivery saved offline. Will sync when connected. 📶', 'warning');
    return;
  }

  if (res.success) {
    closeCompleteModal();
    toast('Delivery completed! 🎉', 'success');
    refreshCurrentPage();
    loadDashboard();
  } else {
    errEl.textContent = res.message || 'Failed to complete order.';
    errEl.hidden      = false;
    btn.disabled      = false;
    btn.innerHTML     = '<span aria-hidden="true">✅</span> Confirm Delivery Complete';
  }
}

