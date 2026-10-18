// customer/orders.js — customer portal: orders list page and filters
'use strict';

/* ════════════════════════════════════════════════════════════
   ORDERS PAGE
═══════════════════════════════════════════════════════════════*/

async function loadOrders() {
  const el = document.getElementById('orders-list');
  el.innerHTML = spinnerHTML('Loading orders');
  if (!state.user) {
    el.innerHTML = `<div class="empty-state"><span>🔐</span><h3>Sign in to see your orders</h3><br/>
      <button class="btn-primary" onclick="navigate('auth')">Sign In</button></div>`;
    return;
  }
  const data = await apiFetch(`${CUSTOMER_API}?action=orders&user_id=${state.user.user_id}`);
  if (!data.success) {
    // 401 = PHP session expired while JS state still holds the user object
    if (data.message && data.message.toLowerCase().includes('unauthorized')) {
      state.user = null;
      state.cart = [];
      state.notifications = [];
      updateAuthUI();
      updateCartBadge();
      el.innerHTML = `<div class="empty-state"><span>🔒</span><h3>Session expired</h3>
        <p>Your session has timed out. Please sign in again to view your orders.</p><br/>
        <button class="btn-primary" onclick="navigate('auth')">Sign In</button></div>`;
    } else {
      el.innerHTML = '<p class="empty-state">Could not load orders. Please try again.</p>';
    }
    return;
  }

const orders = data.data || [];
  state.allOrders = orders; // cache for client-side filtering

  renderOrderList(orders);
}

/** Render an array of order objects into #orders-list. */
function renderOrderList(orders) {
  const el = document.getElementById('orders-list');
  if (!orders.length) {
    el.innerHTML = `<div class="empty-state"><span>📦</span><h3>No orders found</h3><p>Try adjusting your filters, or place your first order.</p><br/>
      <button class="btn-primary" onclick="navigate('catalog')">Start Shopping</button></div>`;
    return;
  }

  const STATUS_ICON = {
    'Pending':             '🕐',
    'Packed':              '📦',
    'Out for Delivery':    '🚴',
    'Arrived at Location': '📍',
    'Completed':           '✅',
    'Cancelled':           '🚫',
  };

  el.innerHTML = '<div class="orders-list-inner">' + orders.map(o => {
    const isPacked    = ['Packed','Out for Delivery','Arrived at Location','Completed'].includes(o.status);
    const amount      = isPacked && o.final_total ? o.final_total : o.estimated_total;
    const amtLabel    = isPacked && o.final_total ? 'Final Total' : 'Est. Total';
    const statusClass = 'status-' + o.status.replace(/\s+/g, '-');
    const icon        = STATUS_ICON[o.status] || '📦';
    const payIcon2    = o.payment_method === 'GCash' ? '💙' : '💵';
    return `
      <div class="order-card" onclick="showOrderDetail(${o.order_id})" role="button" tabindex="0"
           onkeydown="if(event.key==='Enter')showOrderDetail(${o.order_id})">
        <div class="order-card-icon" aria-hidden="true">${icon}</div>
        <div class="order-card-body">
          <div class="order-card-top">
            <span class="order-number">${escHtml(o.order_number)}</span>
            <span class="status-badge ${statusClass}">${escHtml(o.status)}</span>
          </div>
          <div class="order-card-meta">
            <span>📅 ${fmtDate(o.delivery_date)}</span>
            <span>${payIcon2} ${escHtml(o.payment_method)}</span>
          </div>
        </div>
        <div class="order-card-amount">
          <div class="amount-main">${fmtPrice(amount)}</div>
          <div class="amount-label">${amtLabel}</div>
        </div>
        <div class="order-card-chevron" aria-hidden="true">›</div>
      </div>`;
  }).join('') + '</div>';
}

/** Apply status + date-range filters to the cached order list. */
function applyOrderFilters() {
  if (!state.allOrders) return;
  const statusVal = document.getElementById('order-filter-status')?.value ?? '';
  const fromVal   = document.getElementById('order-filter-from')?.value   ?? '';
  const toVal     = document.getElementById('order-filter-to')?.value     ?? '';

  const filtered = state.allOrders.filter(o => {
    if (statusVal && o.status !== statusVal) return false;
    if (fromVal   && o.delivery_date < fromVal) return false;
    if (toVal     && o.delivery_date > toVal)   return false;
    return true;
  });
  renderOrderList(filtered);
}

/** Reset all filter inputs and re-render the full list. */
function clearOrderFilters() {
  const s = document.getElementById('order-filter-status');
  const f = document.getElementById('order-filter-from');
  const t = document.getElementById('order-filter-to');
  if (s) s.value = '';
  if (f) f.value = '';
  if (t) t.value = '';
  renderOrderList(state.allOrders || []);
}

