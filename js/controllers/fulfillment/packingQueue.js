// fulfillment/packingQueue.js — fulfillment portal: packing queue page
'use strict';

/* ════════════════════════════════════════════════════════════
   PAGE: PACKING QUEUE
═══════════════════════════════════════════════════════════════*/

async function loadQueue() {
  const list = document.getElementById('queue-list');
  list.innerHTML = spinnerHTML('Loading orders…');
  selectedQueueOrders.clear();

  const data = await apiGet('orders', { status: 'Pending', page: 1 });
  if (!data.success) {
    list.innerHTML = emptyStateHTML('⚠️', 'Could not load orders', data.message);
    return;
  }

  session.orders.queue = data.data || [];
  updateQueueBadge(session.orders.queue.length);
  renderQueue();
}

function filterQueue() { renderQueue(); }

function renderQueue() {
  const list      = document.getElementById('queue-list');
  const dateVal   = document.getElementById('queue-date-filter')?.value  || '';
  const searchVal = (document.getElementById('queue-search')?.value || '').toLowerCase();

  const orders = session.orders.queue
    .filter(o => {
      const matchDate   = !dateVal   || (o.delivery_date || '').startsWith(dateVal);
      const matchSearch = !searchVal ||
        o.order_number.toLowerCase().includes(searchVal) ||
        `${o.first_name} ${o.last_name}`.toLowerCase().includes(searchVal);
      return matchDate && matchSearch;
    })
    .sort((a, b) => {
      const ua = isToday(a.delivery_date) ? 0 : isTomorrow(a.delivery_date) ? 1 : 2;
      const ub = isToday(b.delivery_date) ? 0 : isTomorrow(b.delivery_date) ? 1 : 2;
      return ua !== ub ? ua - ub : (a.delivery_date || '').localeCompare(b.delivery_date || '');
    });

  const todayCount = orders.filter(o => isToday(o.delivery_date)).length;
  const tomCount   = orders.filter(o => isTomorrow(o.delivery_date)).length;

  document.getElementById('queue-summary-bar').innerHTML = `
    <div class="queue-stat-pill" role="status">
      <span class="qsp-icon">📦</span><span>Pending:</span><span class="qsp-val">${orders.length}</span>
    </div>
    <div class="queue-stat-pill" role="status">
      <span class="qsp-icon">🔴</span><span>Today:</span><span class="qsp-val">${todayCount}</span>
    </div>
    <div class="queue-stat-pill" role="status">
      <span class="qsp-icon">🟡</span><span>Tomorrow:</span><span class="qsp-val">${tomCount}</span>
    </div>
    <div class="queue-stat-pill" role="status" style="margin-left:auto">
      <span class="qsp-icon">☑️</span><span>Selected:</span>
      <span class="qsp-val" id="selected-count">0</span>
    </div>`;

  if (!orders.length) {
    list.innerHTML = emptyStateHTML('✅', 'No pending orders', 'The packing queue is empty!');
    return;
  }
  list.innerHTML = orders.map(renderQueueCard).join('');
}

function renderQueueCard(o) {
  const urgent  = isUrgent(o.delivery_date);
  const label   = deliveryLabel(o.delivery_date);
  const name    = `${o.first_name} ${o.last_name}`;
  const checked = selectedQueueOrders.has(o.order_id);

  return `
    <article class="queue-card ${urgent ? 'priority-urgent' : 'priority-normal'}"
      aria-label="Order ${escHtml(o.order_number)} for ${escHtml(name)}">
      <header class="queue-card-header">
        <label class="queue-checkbox-wrap" aria-label="Select order ${escHtml(o.order_number)} for prep sheet">
          <input type="checkbox" class="queue-checkbox" data-order-id="${o.order_id}"
            ${checked ? 'checked' : ''} onchange="toggleQueueSelect(${o.order_id}, this.checked)"/>
        </label>
        <span class="queue-order-num">${escHtml(o.order_number)}</span>
        <span class="queue-delivery-badge">${label}</span>
        ${urgent ? '<span class="queue-urgency-badge">Urgent</span>' : ''}
        <div class="queue-card-header-actions">
          <button class="btn-action btn-action-muted" onclick="openDetailModal(${o.order_id})"
            aria-label="View details for order ${escHtml(o.order_number)}">👁 View</button>
        </div>
      </header>

      <div class="queue-card-body">
        <div class="queue-customer-col">
          <div class="queue-col-label">Customer</div>
          <div class="queue-customer-name">${escHtml(name)}</div>
          <div class="queue-customer-detail">
            ${escHtml(o.email || '')} <br/>
            ${escHtml(o.payment_method)} &nbsp;·&nbsp; ${escHtml(o.slot_label || 'No slot')}
          </div>
        </div>
        <div class="queue-items-col">
          <div class="queue-col-label">Items</div>
          <div id="queue-items-${o.order_id}" class="queue-items-list-wrap">
            <span style="color:var(--text-muted);font-size:.82rem">Loading…</span>
          </div>
        </div>
        <div class="queue-action-col">
          <div class="queue-est-total">
            <span>Estimated Total</span>
            <strong>${fmtPrice(o.estimated_total)}</strong>
          </div>
          <button class="btn-primary" onclick="openPackModal(${o.order_id})"
            aria-label="Pack order ${escHtml(o.order_number)}">⚖ Pack Order</button>
          <button class="btn-outline btn-sm" onclick="openDetailModal(${o.order_id})">View Details</button>
        </div>
      </div>
    </article>`;
}

function toggleQueueSelect(orderId, checked) {
  if (checked) selectedQueueOrders.add(orderId);
  else         selectedQueueOrders.delete(orderId);
  const el = document.getElementById('selected-count');
  if (el) el.textContent = selectedQueueOrders.size;
}

function toggleSelectAll() {
  const visibleCheckboxes = document.querySelectorAll('.queue-checkbox');
  const allChecked = [...visibleCheckboxes].every(cb => cb.checked);
  visibleCheckboxes.forEach(cb => {
    const oid = parseInt(cb.dataset.orderId);
    cb.checked = !allChecked;
    if (!allChecked) selectedQueueOrders.add(oid);
    else             selectedQueueOrders.delete(oid);
  });
  const el = document.getElementById('selected-count');
  if (el) el.textContent = selectedQueueOrders.size;
  const btn = document.getElementById('select-all-btn');
  if (btn) btn.textContent = allChecked ? '☑️ Select All' : '🔲 Deselect All';
}

async function loadQueueCardItems(orderId) {
  const el = document.getElementById(`queue-items-${orderId}`);
  if (!el || el.dataset.loaded) return;
  el.dataset.loaded = 'true';

  const data = await apiGet('order', { id: orderId });
  if (!data.success || !el) return;

  const items = data.data.items || [];
  if (!items.length) {
    el.innerHTML = '<span style="color:var(--text-muted);font-size:.82rem">No items</span>';
    return;
  }
  const shown = items.slice(0, 3);
  el.innerHTML = `
    <ul class="queue-items-list">
      ${shown.map(i => `
        <li>
          <span>${escHtml(i.name)}</span>
          <span style="color:var(--text-muted)">×${i.quantity}</span>
          ${i.pricing_model === 'catch_weight' ? '<span class="queue-item-catch">⚖</span>' : ''}
        </li>`).join('')}
    </ul>
    ${items.length > 3
      ? `<p class="queue-items-more">+${items.length - 3} more item${items.length - 3 > 1 ? 's' : ''}</p>`
      : ''}`;
}

function updateQueueBadge(count) {
  const b = document.getElementById('nav-badge-queue');
  if (b) {
    if (count > 0) {
      b.textContent = count;
      b.style.display = 'inline-flex'; // Use flex to match the CSS alignment
    } else {
      b.style.display = 'none';        // Only hide if the count is 0
    }
    b.setAttribute('aria-label', `${count} pending orders`);
  }
}

