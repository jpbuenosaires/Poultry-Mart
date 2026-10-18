// rider/polling.js — rider portal: cancellation polling and refresh helper
'use strict';

/* ════════════════════════════════════════════════════════════
   CANCELLATION POLLING
═══════════════════════════════════════════════════════════════*/

async function pollCancellations() {
  if (!rSession.user || !rSession.orders.active.length) return;
  const res = await apiGet('my_orders');
  if (!res.success) return;

  const freshOrders = res.data || [];
  const cancelledIds = [];

  rSession.orders.active.forEach(local => {
    const fresh = freshOrders.find(o => o.order_id === local.order_id);
    if (fresh && fresh.status === 'Cancelled') {
      cancelledIds.push({ id: local.order_id, num: local.order_number });
    }
  });

  if (cancelledIds.length) {
    // Remove cancelled from local cache
    rSession.orders.active = rSession.orders.active.filter(
      o => !cancelledIds.find(c => c.id === o.order_id));
    updateNavBadge(rSession.orders.active.length);
    cancelledIds.forEach(c => showCancellationAlert(c.num));
  }
}

function showCancellationAlert(orderNum) {
  // Remove any existing alert
  document.getElementById('cancellation-alert-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id    = 'cancellation-alert-overlay';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'cancel-alert-title');
  overlay.setAttribute('aria-live', 'assertive');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(239,68,68,.92);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:2rem;max-width:400px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="font-size:3rem;margin-bottom:.5rem" aria-hidden="true">🚨</div>
      <h2 id="cancel-alert-title" style="color:var(--error,#ef4444);margin:0 0 .75rem;font-size:1.4rem">
        ORDER CANCELLED
      </h2>
      <p style="font-size:1rem;margin-bottom:.5rem">
        <strong>Order ${escHtml(orderNum)}</strong> has been cancelled by the customer or admin.
      </p>
      <p style="font-size:1rem;font-weight:700;color:var(--error,#ef4444);margin-bottom:1.5rem">
        ⛔ ABORT THE DROP-OFF — Return all items to the hub immediately.
      </p>
      <button class="btn-primary" type="button"
        onclick="document.getElementById('cancellation-alert-overlay').remove();refreshCurrentPage();"
        style="min-width:160px">
        Understood — Return to Hub
      </button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('button').focus();
}

/* ════════════════════════════════════════════════════════════
   REFRESH HELPER
═══════════════════════════════════════════════════════════════*/

function refreshCurrentPage() {
  const active = document.querySelector('.portal-nav__btn.active')?.dataset.page;
  if (active === 'dashboard') loadDashboard();
  else if (active === 'active')  loadActiveOrders();
  else if (active === 'history') loadHistory();
}

