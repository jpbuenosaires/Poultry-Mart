// admin/orders.js — admin portal: orders list, detail, and order action modals
'use strict';

/* ════════════════════════════════════════════════════════════
   ORDERS
═══════════════════════════════════════════════════════════════*/

async function loadOrders() {
  setLoading('orders-table-wrap', 'Loading orders…');
  const { page, status, search } = session.orders;
  const res = await apiGet('orders', { status, search, page, limit: 30 });
  if (!res.success) { document.getElementById('orders-table-wrap').innerHTML = errorHTML(res.message); return; }
  session.orders.list = res.data.orders;
  session.orders.total = res.data.total;
  session.orders.pages = res.data.pages;
  renderOrdersTable(res.data);
}

function renderOrdersTable(data) {
  const wrap = document.getElementById('orders-table-wrap');
  const orders = data.orders || [];
  if (!orders.length) {
    wrap.innerHTML = emptyStateHTML('📦', 'No Orders', 'No orders match your filter.');
    document.getElementById('orders-pagination').innerHTML = '';
    return;
  }

  const isPacked = s => ['Packed','Out for Delivery','Arrived at Location','Completed'].includes(s);
  // Urgency: only flag Pending orders due today or tomorrow (matches fulfillment/utils.js)
  const checkUrgent = (d, status) => status === 'Pending' && (isToday(d) || isTomorrow(d));

  const cards = orders.map(o => {
    const name     = `${escHtml(o.first_name)} ${escHtml(o.last_name)}`;
    const total    = isPacked(o.status) && o.final_total
      ? `<strong style="color:var(--primary);font-family:var(--font-display)">${fmtPrice(o.final_total)}</strong>`
      : fmtPrice(o.estimated_total);
    const estTotal = fmtPrice(o.estimated_total);
    const urgent   = checkUrgent(o.delivery_date, o.status);

    let actions = `<button class="btn-outline" onclick="openOrderDetail(${o.order_id})" title="View details" aria-label="View details for order ${escHtml(o.order_number)}">👁 View Details</button>`;
    
    if (o.status === 'Pending') {
      actions += `<button class="btn-primary" onclick="openPackModal(${o.order_id})" title="Pack order">📦 Pack Order</button>`;
    } else if (o.status === 'Packed') {
      actions += `<button class="btn-action-blue" onclick="openAssignModal(${o.order_id})" title="Assign rider">🛵 Assign Rider</button>`;
    }
    // P4-02: Add Arrived at Location transition button
    if (o.status === 'Out for Delivery') {
      actions += `<button class="btn-action-blue" onclick="markArrivedAtLocation(${o.order_id})" title="Mark arrived">📍 Arrived</button>`;
    }
    if (['Packed','Out for Delivery','Arrived at Location'].includes(o.status)) {
      actions += `<button class="btn-action-green" onclick="markDelivered(${o.order_id})" title="Mark delivered">✅ Mark Delivered</button>`;
    }
    if (o.status !== 'Cancelled' && o.status !== 'Completed') {
      actions += `<button class="btn-action-red" onclick="openCancelModal(${o.order_id},'${escHtml(o.order_number)}')" title="Cancel">✕ Cancel Order</button>`;
    }
    actions += `<button class="btn-action-muted" onclick="printPackingSlip(${o.order_id})" title="Print slip">🖨 Print Slip</button>`;

    return `
      <article class="queue-card ${urgent ? 'priority-urgent' : 'priority-normal'}" style="margin-bottom: 1rem">
        <header class="queue-card-header">
          <span class="queue-order-num">${escHtml(o.order_number)}</span>
          ${statusBadge(o.status)}
          ${payBadge(o.pay_status)}
          <span class="queue-delivery-badge" style="margin-left:auto">${deliveryLabel(o.delivery_date)}</span>
          ${urgent ? '<span class="queue-urgency-badge">Urgent</span>' : ''}
        </header>
        <div class="queue-card-body">
          <div class="queue-customer-col" style="flex: 2">
            <div class="queue-col-label">Customer Details</div>
            <div class="queue-customer-name">${name}</div>
            <div class="queue-customer-detail">
              ${escHtml(o.email || '')} <br/>
              ${escHtml(o.payment_method)}
            </div>
          </div>
          <div class="queue-items-col" style="flex: 2">
            <div class="queue-col-label">Order Totals</div>
            <div class="queue-customer-detail" style="font-size: 0.95rem">
              <div style="margin-bottom: .25rem;">Est. Total: <span style="float:right">${estTotal}</span></div>
              <div style="margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid var(--border)">
                <strong>Final Total:</strong> <span style="float:right">${total}</span>
              </div>
            </div>
          </div>
          <div class="queue-action-col">
            ${actions}
          </div>
        </div>
      </article>
    `;
  }).join('');

  wrap.innerHTML = `<div class="orders-card-list">${cards}</div>`;
  
  renderPagination('orders-pagination', session.orders.page, data.pages, (p) => {
    session.orders.page = p;
    loadOrders();
  });
}


function filterOrders() {
  session.orders.page = 1;
  session.orders.status = document.getElementById('order-filter-status').value;
  session.orders.search = document.getElementById('order-search').value.trim();
  loadOrders();
}

async function openOrderDetail(id) {
  document.getElementById('order-detail-body').innerHTML = spinnerHTML();
  openModal('order-detail-modal', 'order-modal-close');
  const res = await apiGet('order', { id });
  if (!res.success) { document.getElementById('order-detail-body').innerHTML = errorHTML(res.message); return; }
  session.currentOrder = res.data;
  renderOrderDetail(res.data);
}

function renderOrderDetail(o) {
  const isPacked = ['Packed', 'Out for Delivery', 'Arrived at Location', 'Completed'].includes(o.status);
  const items    = o.items || [];
  let itemsTotal = 0;

  const itemRows = items.map(i => {
    const isCW = i.is_catch_weight == 1 || i.pricing_model === 'catch_weight';
    const sub = isPacked && i.final_subtotal
      ? parseFloat(i.final_subtotal)
      : parseFloat(i.estimated_subtotal);
    itemsTotal += sub;
    return `
      <tr>
        <td>
          ${escHtml(i.name)}
          ${isCW ? '<span style="font-size:.7rem;color:var(--orange);font-weight:700;margin-left:.3rem">⚖</span>' : ''}
        </td>
        <td style="text-align:center">${i.quantity}</td>
        <td>
          ${isCW
            ? (isPacked && i.actual_weight
                ? `<strong>${parseFloat(i.actual_weight).toFixed(3)} kg</strong>`
                : `~${parseFloat(i.estimated_weight || 0).toFixed(3)} kg`)
            : `${i.quantity} ${i.pricing_model === 'per_piece' ? 'pc' : 'pack'}`}
        </td>
        <td>${isCW
          ? fmtPrice(i.price_per_kg || i.unit_price) + '/kg'
          : fmtPrice(i.price_per_kg || i.unit_price) + '/' + (i.pricing_model === 'per_piece' ? 'pc' : 'pack')}</td>
        <td style="text-align:right;font-weight:700">
          ${isPacked && i.final_subtotal
            ? `<span style="color:var(--green)">${fmtPrice(i.final_subtotal)}</span>`
            : fmtPrice(i.estimated_subtotal)}
        </td>
      </tr>`;
  }).join('');

  const riderInfo = o.rider_first
    ? `${o.rider_first} ${o.rider_last} ${o.rider_phone ? `(${o.rider_phone})` : ''}`
    : 'Not assigned';
  const dispatchedAt = o.dispatched_at ? fmtDateTime(o.dispatched_at) : '—';
  const deliveredAt  = o.delivered_at  ? fmtDateTime(o.delivered_at)  : '—';

  document.getElementById('order-detail-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap">
      <h2 style="font-size:1.2rem;margin:0">${escHtml(o.order_number)}</h2>
      ${statusBadge(o.status)} ${payBadge(o.pay_status)}
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Customer &amp; Delivery</div>
      <div class="detail-info-grid">
        <div class="detail-info-item">
          <div class="detail-info-label">Customer</div>
          <div class="detail-info-val">${escHtml(o.first_name)} ${escHtml(o.last_name)}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Phone</div>
          <div class="detail-info-val">${escHtml(o.phone || '—')}</div>
        </div>
        <div class="detail-info-item" style="grid-column:1/-1">
          <div class="detail-info-label">Address</div>
          <div class="detail-info-val">
            ${escHtml(o.street)}, ${escHtml(o.barangay)}, ${escHtml(o.city)}, ${escHtml(o.province || 'Albay')}
          </div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Delivery Date</div>
          <div class="detail-info-val">${fmtDate(o.delivery_date)}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Time Slot</div>
          <div class="detail-info-val">${escHtml(o.slot_label || '—')}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Payment Method</div>
          <div class="detail-info-val">${escHtml(o.payment_method)}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Rider</div>
          <div class="detail-info-val">${escHtml(riderInfo)}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Dispatched At</div>
          <div class="detail-info-val">${dispatchedAt}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Delivered At</div>
          <div class="detail-info-val">${deliveredAt}</div>
        </div>
        ${o.special_instructions ? `
        <div class="detail-info-item" style="grid-column:1/-1">
          <div class="detail-info-label">Special Instructions</div>
          <div class="detail-info-val" style="color:var(--orange)">${escHtml(o.special_instructions)}</div>
        </div>` : ''}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Items (${items.length})</div>
      <table class="detail-items-table">
        <thead>
          <tr>
            <th>Product</th>
            <th style="text-align:center">Qty</th>
            <th>Weight</th>
            <th>Price/kg</th>
            <th style="text-align:right">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="detail-total-rows">
        <div class="detail-total-row"><span>Items</span><span>${fmtPrice(itemsTotal)}</span></div>
        ${o.discount_amount > 0
          ? `<div class="detail-total-row" style="color:var(--green)">
               <span>Discount</span><span>−${fmtPrice(o.discount_amount)}</span>
             </div>` : ''}
        <div class="detail-total-row">
          <span>Delivery Fee</span><span>${fmtPrice(o.delivery_fee)}</span>
        </div>
        ${isPacked && o.final_total
          ? `<div class="detail-total-row grand">
               <span>✓ Final Total</span><span>${fmtPrice(o.final_total)}</span>
             </div>`
          : `<div class="detail-total-row grand">
               <span>Estimated Total</span><span>${fmtPrice(o.estimated_total)}</span>
             </div>`}
      </div>
    </div>

    <div class="modal-actions" style="margin-top:1.5rem">
      ${o.status === 'Pending' ? `<button class="btn-primary" onclick="closeModal('order-detail-modal');openPackModal(${o.order_id})">📦 Pack Order</button>` : ''}
      ${o.status === 'Packed' ? `<button class="btn-primary" onclick="closeModal('order-detail-modal');openAssignModal(${o.order_id})">🛵 Assign Rider</button>` : ''}
      <button class="btn-outline" onclick="printPackingSlip(${o.order_id})">🖨 Print Slip</button>
      <button class="btn-outline" onclick="printItemLabels(${o.order_id})">🏷 Print Labels</button>
    </div>`;
}

/* ── Pack Order ─────────────────────────────────────────────*/

let _packOrderId = 0;

async function openPackModal(id) {
  _packOrderId = id;
  document.getElementById('pack-modal-body').innerHTML = spinnerHTML();
  openModal('pack-order-modal', 'pack-modal-close');
  const res = await apiGet('order', { id });
  if (!res.success) { document.getElementById('pack-modal-body').innerHTML = errorHTML(res.message); return; }
  session.currentOrder = res.data;
  renderPackModal(res.data);
}

function renderPackModal(o) {
  const rows = (o.items || []).map(it => {
    const isCW = it.is_catch_weight == 1;
    return `<div class="pack-item-row" data-item-id="${it.order_item_id}" data-unit-price="${it.unit_price}" data-pricing-model="${escHtml(it.pricing_model)}" data-qty="${it.quantity}">
      <div class="pack-item-name">${productIcon(it.category_name)} ${escHtml(it.name)}</div>
      <div class="pack-item-controls">
        ${isCW ? `<label>Actual Weight (kg)<input type="number" class="form-input pack-weight-input" data-item="${it.order_item_id}" min="0" step="0.001" placeholder="${parseFloat(it.estimated_weight || 0).toFixed(3)}" oninput="recalcPackTotal()" /></label>` : `<span class="text-muted">Qty: ${escHtml(it.quantity)}</span>`}
        <label class="oos-toggle-label"><input type="checkbox" class="oos-checkbox" data-item="${it.order_item_id}" onchange="recalcPackTotal()" /> Out of Stock</label>
      </div>
    </div>`;
  }).join('');

  document.getElementById('pack-modal-body').innerHTML = `
    <div class="pack-items-fieldset">${rows}</div>
    <div class="pack-total-strip">Est. Final Total: <strong id="pack-running-total">${fmtPrice(o.estimated_total)}</strong></div>
    <p id="pack-error" class="form-error" style="display:none"></p>`;
}

function recalcPackTotal() {
  let total = 0;
  document.querySelectorAll('.pack-item-row').forEach(row => {
    const oos = row.querySelector('.oos-checkbox')?.checked;
    if (oos) return;
    const model = row.dataset.pricingModel;
    const qty = parseFloat(row.dataset.qty || 1);
    const price = parseFloat(row.dataset.unitPrice || 0);
    if (model === 'catch_weight') {
      const w = parseFloat(row.querySelector('.pack-weight-input')?.value || 0);
      total += w * price;
    } else {
      total += qty * price;
    }
  });
  const el = document.getElementById('pack-running-total');
  if (el) el.textContent = fmtPrice(total);
}

async function confirmPackOrder() {
  const errEl = document.getElementById('pack-error');
  errEl.style.display = 'none';

  const items = [];
  document.querySelectorAll('.pack-item-row').forEach(row => {
    const itemId = parseInt(row.dataset.itemId);
    const oos = row.querySelector('.oos-checkbox')?.checked ? 1 : 0;
    const wInp = row.querySelector('.pack-weight-input');
    const weight = wInp ? parseFloat(wInp.value || 0) : null;
    items.push({ order_item_id: itemId, actual_weight: weight, is_oos: oos });
  });

  const res = await apiPost('pack_order', { order_id: _packOrderId, items });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Order packed successfully!', 'success');
  closeModal('pack-order-modal');
  loadOrders();
  loadSidebarCounts();
}

/* ── Edit Order ─────────────────────────────────────────────*/

let _editOrderId = 0;

async function openEditOrderModal(id) {
  _editOrderId = id;
  document.getElementById('edit-order-body').innerHTML = spinnerHTML();
  openModal('edit-order-modal', 'edit-modal-close');
  const res = await apiGet('order', { id });
  if (!res.success) { document.getElementById('edit-order-body').innerHTML = errorHTML(res.message); return; }
  const o = res.data;
  document.getElementById('edit-order-body').innerHTML = `
    <div class="form-group"><label>Delivery Date</label><input type="date" id="edit-delivery-date" class="form-input" value="${escHtml(o.delivery_date?.slice(0, 10) || '')}" /></div>
    <div class="form-group form-group--spaced"><label>Promo Code</label><input type="text" id="edit-promo-code" class="form-input" value="${escHtml(o.promo_code || '')}" placeholder="Leave blank to remove" /></div>
    <p id="edit-order-error" class="form-error" style="display:none"></p>`;
}

async function confirmEditOrder() {
  const errEl = document.getElementById('edit-order-error');
  errEl.style.display = 'none';
  const res = await apiPost('edit_order', {
    order_id: _editOrderId,
    delivery_date: document.getElementById('edit-delivery-date').value,
    promo_code: document.getElementById('edit-promo-code').value.trim(),
  });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Order updated.', 'success');
  closeModal('edit-order-modal');
  loadOrders();
}

/* ── Cancel Order ───────────────────────────────────────────*/

let _cancelOrderId = 0;

function openCancelModal(id, orderNum) {
  _cancelOrderId = id;
  document.getElementById('cancel-order-num').textContent = orderNum;
  document.getElementById('cancel-reason-input').value = '';
  document.getElementById('cancel-error').style.display = 'none';
  openModal('cancel-order-modal', 'cancel-modal-close');
}

async function confirmCancel() {
  const reason = document.getElementById('cancel-reason-input').value.trim();
  const errEl = document.getElementById('cancel-error');
  if (!reason) { errEl.textContent = 'Please enter a reason.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';
  const res = await apiPost('cancel_order', { order_id: _cancelOrderId, reason });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Order cancelled.', 'success');
  closeModal('cancel-order-modal');
  loadOrders();
  loadSidebarCounts();
}

/* ── Status Override ────────────────────────────────────────*/

let _statusOrderId = 0;

function openStatusModal(id) {
  _statusOrderId = id;
  document.getElementById('status-override-error').style.display = 'none';
  openModal('status-override-modal', 'status-modal-close');
}

async function confirmStatusOverride() {
  const newStatus = document.getElementById('status-select').value;
  const errEl = document.getElementById('status-override-error');
  if (!newStatus) { errEl.textContent = 'Select a status.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';
  const res = await apiPost('update_status', { order_id: _statusOrderId, status: newStatus });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Status updated.', 'success');
  closeModal('status-override-modal');
  loadOrders();
}

/* ── Assign Rider ───────────────────────────────────────────*/

let _assignOrderId = 0;

async function openAssignModal(id) {
  _assignOrderId = id;
  document.getElementById('assign-rider-error').style.display = 'none';
  await refreshRiders();
  populateRiderSelect('assign-rider-select');
  openModal('assign-rider-modal', 'assign-modal-close');
}

async function confirmAssign() {
  const riderId = document.getElementById('assign-rider-select').value;
  const errEl = document.getElementById('assign-rider-error');
  if (!riderId) { errEl.textContent = 'Select a rider.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';
  const res = await apiPost('assign_rider', { order_id: _assignOrderId, rider_id: riderId });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Rider assigned.', 'success');
  closeModal('assign-rider-modal');
  loadOrders();
}

/* ── Batch Assign ───────────────────────────────────────────*/

let _batchOrderIds = [];
let _batchZoneLabel = '';

async function openBatchAssignModal(orderIds, zoneLabel) {
  _batchOrderIds = orderIds;
  _batchZoneLabel = zoneLabel;
  document.getElementById('batch-assign-zone-label').textContent = zoneLabel;
  document.getElementById('batch-assign-error').style.display = 'none';
  await refreshRiders();
  populateRiderSelect('batch-rider-select');
  openModal('batch-assign-modal', 'batch-modal-close');
}

async function confirmBatchAssign() {
  const riderId = document.getElementById('batch-rider-select').value;
  const errEl = document.getElementById('batch-assign-error');
  if (!riderId) { errEl.textContent = 'Select a rider.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';
  const res = await apiPost('batch_assign_riders', { order_ids: _batchOrderIds, rider_id: riderId });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast(`Batch assigned to rider for zone: ${_batchZoneLabel}.`, 'success');
  closeModal('batch-assign-modal');
  loadOrders();
}

/* ── Dispatch ───────────────────────────────────────────────*/

let _dispatchOrderId = 0;
let _dispatchOrderNum = '';

function openDispatchModal(id, orderNum) {
  _dispatchOrderId = id;
  _dispatchOrderNum = orderNum;
  document.getElementById('dispatch-confirm-msg').textContent = `Send order ${orderNum} out for delivery?`;
  openModal('dispatch-confirm-modal', 'dispatch-modal-close');
}

async function confirmDispatch() {
  const res = await apiPost('dispatch_order', { order_id: _dispatchOrderId });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Order dispatched!', 'success');
  closeModal('dispatch-confirm-modal');
  loadOrders();
}

/* ── Mark Arrived at Location ──────────────────────────────*/

async function markArrivedAtLocation(id) {
  if (!confirm('Mark this order as Arrived at Location?')) return;
  const res = await apiPost('update_status', { order_id: id, status: 'Arrived at Location' });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Order marked as Arrived at Location.', 'success');
  loadOrders();
}

/* ── Mark Delivered ─────────────────────────────────────────*/

async function markDelivered(id) {
  if (!confirm('Mark this order as delivered / completed?')) return;
  const res = await apiPost('update_status', { order_id: id, status: 'Completed' });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Order marked as delivered.', 'success');
  loadOrders();
}

async function markArrivedAtLocation(id) {
  if (!confirm('Mark this order as Arrived at Location?')) return;
  const res = await apiPost('update_status', { order_id: id, status: 'Arrived at Location' });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Order marked as Arrived at Location.', 'success');
  loadOrders();
}

async function confirmMarkDelivered(id) { await markDelivered(id); }

