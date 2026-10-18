// fulfillment/returns.js — fulfillment portal: returns and restock page
'use strict';

/* ════════════════════════════════════════════════════════════
   PAGE: RETURNS & RESTOCK
═══════════════════════════════════════════════════════════════*/

async function loadReturns() {
  const list = document.getElementById('returns-list');
  list.innerHTML = spinnerHTML('Loading failed deliveries…');

  const data = await apiGet('orders', { status: 'Cancelled', page: 1 });
  if (!data.success) {
    list.innerHTML = emptyStateHTML('⚠️', 'Error loading returns', data.message);
    return;
  }

  const orders = data.data || [];
  const badge  = document.getElementById('nav-badge-returns');
  if (badge) {
    badge.textContent = orders.length > 0 ? orders.length : '';
    badge.setAttribute('aria-label', `${orders.length} failed deliveries awaiting review`);
  }

  if (!orders.length) {
    list.innerHTML = emptyStateHTML('✅', 'No pending returns', 'All failed deliveries have been processed.');
    return;
  }

  session.orders.returns = orders;
  renderReturns();
}

function filterReturns() {
  renderReturns();
}

function renderReturns() {
  const list      = document.getElementById('returns-list');
  const searchVal = (document.getElementById('returns-search')?.value || '').toLowerCase();
  const orders    = (session.orders.returns || []).filter(o =>
    !searchVal ||
    o.order_number.toLowerCase().includes(searchVal) ||
    `${o.first_name} ${o.last_name}`.toLowerCase().includes(searchVal));

  if (!orders.length) {
    list.innerHTML = emptyStateHTML('🔍', 'No matching returns', 'Try a different search.');
    return;
  }

  list.innerHTML = orders.map(o => `
    <article class="queue-card" aria-label="Returned order ${escHtml(o.order_number)}">
      <header class="queue-card-header">
        <span class="queue-order-num">${escHtml(o.order_number)}</span>
        <span class="queue-delivery-badge" style="background:var(--error-bg,#fff0f0);color:var(--error,#d32f2f)">
          ↩ Failed Delivery
        </span>
        <div class="queue-card-header-actions">
          <button class="btn-action btn-action-muted" onclick="openDetailModal(${o.order_id})"
            aria-label="View details for order ${escHtml(o.order_number)}">👁 View</button>
        </div>
      </header>
      <div class="queue-card-body">
        <div class="queue-customer-col">
          <div class="queue-col-label">Customer</div>
          <div class="queue-customer-name">${escHtml(o.first_name)} ${escHtml(o.last_name)}</div>
          <div class="queue-customer-detail">
            ${escHtml(o.payment_method)} &nbsp;·&nbsp; ${escHtml(o.slot_label || 'No slot')}
          </div>
        </div>
        <div class="queue-items-col">
          <div class="queue-col-label">Rider Note</div>
          <div style="font-size:.85rem;color:var(--text-muted)">
            ${escHtml(o.failed_delivery_reason || 'No reason provided')}
          </div>
        </div>
        <div class="queue-action-col">
          <div class="queue-est-total">
            <span>Final Total</span>
            <strong>${fmtPrice(o.final_total)}</strong>
          </div>
          <button class="btn-primary" style="background:var(--green,#16a34a)"
            onclick="confirmRestockReturn(${o.order_id}, '${escHtml(o.order_number)}')"
            aria-label="Restock goods from order ${escHtml(o.order_number)}">
            📦 Restock to Inventory
          </button>
          <button class="btn-outline" style="border-color:var(--error,#d32f2f);color:var(--error,#d32f2f)"
            onclick="confirmMarkSpoiled(${o.order_id}, '${escHtml(o.order_number)}')"
            aria-label="Mark goods from order ${escHtml(o.order_number)} as spoiled">
            🚫 Mark as Spoiled
          </button>
        </div>
      </div>
    </article>`).join('');
}

async function confirmRestockReturn(orderId, orderNum) {
  if (!confirm(`Restock all returned goods from order ${orderNum} back to inventory?\nThis will restore batch quantities and mark the order as Restocked.`))
    return;
  const data = await apiPost('restock_return', { order_id: orderId, action: 'restock' });
  if (data.success) {
    toast(`Order ${orderNum} goods restocked to inventory. ✅`, 'success');
    loadReturns();
    loadInventory();
  } else {
    toast(data.message || 'Restock failed.', 'error');
  }
}

async function confirmMarkSpoiled(orderId, orderNum) {
  if (!confirm(`Mark all returned goods from order ${orderNum} as spoiled?\nThis will log a spoilage adjustment and cannot be undone.`))
    return;
  const data = await apiPost('restock_return', { order_id: orderId, action: 'spoiled' });
  if (data.success) {
    toast(`Order ${orderNum} goods marked as spoiled and logged. 🚫`, 'warning');
    loadReturns();
    loadInventory();
  } else {
    toast(data.message || 'Failed to mark as spoiled.', 'error');
  }
}

function openPodModal(url, orderNum) {
  document.getElementById('pod-modal-img').src           = url;
  document.getElementById('pod-modal-caption').textContent = `Proof of delivery — Order ${orderNum}`;
  document.getElementById('pod-modal-overlay').style.display = 'flex';
}
function closePodModal(event) {
  if (!event || event.target === event.currentTarget)
    document.getElementById('pod-modal-overlay').style.display = 'none';
}

