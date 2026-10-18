// fulfillment/activeDispatch.js — fulfillment portal: active dispatch page
'use strict';

/* ════════════════════════════════════════════════════════════
   PAGE: ACTIVE DISPATCH
═══════════════════════════════════════════════════════════════*/

async function loadDispatch() {
  const list = document.getElementById('dispatch-list');
  list.innerHTML = spinnerHTML('Loading active deliveries');

  const data = await apiGet('orders', { status: 'Out for Delivery', page: 1 });
  if (!data.success) {
    list.innerHTML = emptyStateHTML('⚠️', 'Error', data.message);
    return;
  }
  session.orders.dispatch = data.data || [];
  updateDispatchBadge();
  renderDispatch();
}

function filterDispatch() { renderDispatch(); }

function updateDispatchBadge() {
  const b = document.getElementById('nav-badge-dispatch');
  const n = session.orders.dispatch.length;
  if (b) b.textContent = n > 0 ? n : '';
}

function renderDispatch() {
  const list      = document.getElementById('dispatch-list');
  const searchVal = (document.getElementById('dispatch-search')?.value || '').toLowerCase();
  const orders    = session.orders.dispatch.filter(o =>
    !searchVal ||
    o.order_number.toLowerCase().includes(searchVal) ||
    `${o.first_name} ${o.last_name}`.toLowerCase().includes(searchVal));

  if (!orders.length) {
    list.innerHTML = emptyStateHTML(
      '🛵', 'No active deliveries',
      'All riders have returned or no orders dispatched yet.');
    return;
  }

  list.innerHTML = orders.map(o => `
    <article class="dispatch-card" aria-label="Dispatched order ${escHtml(o.order_number)}">
      <div class="dispatch-status-indicator" aria-hidden="true">🛵</div>
      <div class="dispatch-info">
        <div class="dispatch-order-num">${escHtml(o.order_number)}</div>
        <div class="dispatch-customer">${escHtml(o.first_name + ' ' + o.last_name)}</div>
        <div class="dispatch-meta">
          📅 ${fmtDate(o.delivery_date)} &nbsp;·&nbsp;
          📍 ${escHtml(o.zone_city || '—')}
          &nbsp;·&nbsp; ${escHtml(o.slot_label || '—')}
        </div>
      </div>
      <div class="dispatch-total">
        <div>${fmtPrice(o.final_total)}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">Final</div>
      </div>
      <div class="btn-actions-row">
        <button class="btn-action btn-action-green"
          onclick="markDelivered(${o.order_id}, '${escHtml(o.order_number)}')"
          aria-label="Mark order ${escHtml(o.order_number)} as delivered">✅ Mark Delivered</button>
        <button class="btn-action btn-action-muted"
          onclick="openDetailModal(${o.order_id})">👁 Details</button>
      </div>
    </article>`).join('');
}

async function markDelivered(orderId, orderNum) {
  if (!confirm(`Mark order ${orderNum} as delivered and completed?`)) return;
  const data = await apiPost('complete_delivery', { order_id: orderId });
  if (data.success) {
    toast(`Order ${orderNum} marked as delivered! ✅`, 'success');
    loadDispatch();
    loadAllOrders();
  } else {
    toast(data.message || 'Failed.', 'error');
  }
}

