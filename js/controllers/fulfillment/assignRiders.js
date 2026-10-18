// fulfillment/assignRiders.js — fulfillment portal: assign riders page and assign/batch/dispatch modals
'use strict';

/* ════════════════════════════════════════════════════════════
   PAGE: ASSIGN RIDERS
═══════════════════════════════════════════════════════════════*/

async function loadPacked() {
  const list = document.getElementById('packed-list');
  list.innerHTML = spinnerHTML('Loading packed orders…');

  const data = await apiGet('orders', { status: 'Packed', page: 1 });
  if (!data.success) {
    list.innerHTML = emptyStateHTML('⚠️', 'Error loading orders', data.message);
    return;
  }
  session.orders.packed = data.data || [];
  zoneViewActive ? renderZoneView() : renderPacked();
}

function filterPacked() { zoneViewActive ? renderZoneView() : renderPacked(); }

function toggleZoneView() {
  zoneViewActive = !zoneViewActive;
  const btn = document.getElementById('zone-view-btn');
  btn.textContent = zoneViewActive ? '📋 List View' : '🗺️ Zone View';
  btn.setAttribute('aria-pressed', String(zoneViewActive));
  zoneViewActive ? renderZoneView() : renderPacked();
}

function renderPacked() {
  const list      = document.getElementById('packed-list');
  const searchVal = (document.getElementById('packed-search')?.value || '').toLowerCase();
  const orders    = session.orders.packed.filter(o =>
    !searchVal ||
    o.order_number.toLowerCase().includes(searchVal) ||
    `${o.first_name} ${o.last_name}`.toLowerCase().includes(searchVal));

  if (!orders.length) {
    list.innerHTML = emptyStateHTML(
      '✅', 'No packed orders awaiting assignment',
      'Pack orders first to assign them to riders.');
    return;
  }

  list.innerHTML = orders.map(o => `
    <article class="packed-card" aria-label="Packed order ${escHtml(o.order_number)}">
      <div class="packed-info">
        <div class="packed-order-num">${escHtml(o.order_number)}</div>
        <div class="packed-customer">
          ${escHtml(o.first_name + ' ' + o.last_name)} &nbsp;·&nbsp; ${escHtml(o.payment_method)}
        </div>
        <div class="packed-meta">
          📅 ${fmtDate(o.delivery_date)} &nbsp;·&nbsp; 📍 ${escHtml(o.zone_city || '—')}
        </div>
      </div>
      <div class="packed-final">
        <div class="packed-final-amount">${fmtPrice(o.final_total)}</div>
        <div class="packed-final-label">Final Total</div>
      </div>
      <div class="btn-actions-row">
        <button class="btn-action btn-action-blue"
          onclick="openDispatchModal(${o.order_id}, '${escHtml(o.order_number)}')">🚀 Dispatch</button>
        <button class="btn-action btn-action-blue"
          onclick="openAssignModal(${o.order_id}, '${escHtml(o.order_number)}')">🛵 Assign Rider</button>
        <button class="btn-action btn-action-muted"
          onclick="openDetailModal(${o.order_id})">👁 Details</button>
        <button class="btn-action btn-action-muted"
          onclick="openPackModal(${o.order_id})">⚖ Re-Pack</button>
      </div>
    </article>`).join('');
}

function renderZoneView() {
  const list   = document.getElementById('packed-list');
  const orders = session.orders.packed;
  if (!orders.length) { renderPacked(); return; }

  // Group by zone
  const zones = {};
  orders.forEach(o => {
    const zkey = o.zone_city || 'Unassigned Zone';
    if (!zones[zkey]) zones[zkey] = { label: zkey, orders: [], ids: [] };
    zones[zkey].orders.push(o);
    zones[zkey].ids.push(o.order_id);
  });

  list.innerHTML = Object.values(zones).map(z => `
    <div class="zone-group-card">
      <div class="zone-group-header">
        <div>
          <span class="zone-group-icon">📍</span>
          <strong>${escHtml(z.label)}</strong>
          <span class="zone-order-count">${z.orders.length} order${z.orders.length > 1 ? 's' : ''}</span>
        </div>
        <button class="btn-action btn-action-blue zone-batch-btn"
          onclick="openBatchAssignModal(${JSON.stringify(z.ids)}, '${escHtml(z.label)}')"
          aria-label="Batch assign all orders in ${escHtml(z.label)} to one rider">
          🛵 Assign All to One Rider
        </button>
      </div>
      <div class="zone-order-list">
        ${z.orders.map(o => `
          <div class="zone-order-row">
            <span class="zone-order-num">${escHtml(o.order_number)}</span>
            <span>${escHtml(o.first_name)} ${escHtml(o.last_name)}</span>
            <span>${escHtml(o.slot_label || '—')}</span>
            <span>${fmtPrice(o.final_total)}</span>
            <button class="btn-action btn-action-muted btn-sm"
              onclick="openAssignModal(${o.order_id}, '${escHtml(o.order_number)}')">🛵 Assign</button>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

/* ── Assign Rider Modal ─────────────────────────────────── */
async function openAssignModal(orderId, orderNum) {
  assignState.orderId        = orderId;
  assignState.orderNum       = orderNum;
  assignState.currentRiderId = null;

  const overlay = document.getElementById('assign-modal-overlay');
  overlay.style.display = 'flex';

  const infoEl = document.getElementById('assign-modal-order-info');
  infoEl.textContent = `Loading order details for ${orderNum}…`;
  document.getElementById('assign-error').style.display = 'none';

  const data = await apiGet('order', { id: orderId });
  if (data.success && data.data.rider_id) {
    assignState.currentRiderId = data.data.rider_id;
    const rName = `${data.data.rider_first || ''} ${data.data.rider_last || ''}`.trim();
    infoEl.innerHTML = `
      Assigning a rider for order <strong>${escHtml(orderNum)}</strong><br/>
      <span role="alert" style="
        display:inline-block;margin-top:.4rem;padding:.35rem .65rem;
        background:var(--warning-bg,#fff8e1);border:1px solid var(--warning,#f59e0b);
        border-radius:var(--radius-sm,4px);font-size:.85rem;color:var(--warning-dark,#b45309)">
        ⚠ Currently assigned to: <strong>${escHtml(rName)}</strong>.
        Re-assigning will revoke their active order notification.
      </span>`;
  } else {
    infoEl.textContent = `Assigning a rider for order ${orderNum}`;
  }

  document.getElementById('rider-select').innerHTML =
    '<option value="">— Choose a rider —</option>' +
    session.riders.map(r =>
      `<option value="${r.user_id}"
         ${r.user_id === assignState.currentRiderId ? 'disabled title="Currently assigned"' : ''}>
         ${escHtml(r.first_name)} ${escHtml(r.last_name)}${r.phone ? ' · ' + r.phone : ''}
       </option>`).join('');

  trapFocus(overlay.querySelector('.modal-box') || overlay);
}
function closeAssignModal(event) {
  if (event.target === event.currentTarget) closeAssignModalDirect();
}
function closeAssignModalDirect() {
  releaseFocusTrap();
  document.getElementById('assign-modal-overlay').style.display = 'none';
}

async function confirmAssignRider() {
  const riderId = parseInt(document.getElementById('rider-select').value);
  const errEl   = document.getElementById('assign-error');
  if (!riderId) {
    errEl.textContent   = 'Please select a rider.';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  const data = await apiPost('assign_rider', {
    order_id:          assignState.orderId,
    rider_id:          riderId,
    previous_rider_id: assignState.currentRiderId || null,
    notify_revoke:     !!assignState.currentRiderId,
  });
  if (data.success) {
    toast(`Rider assigned to ${assignState.orderNum}! 🛵`, 'success');
    closeAssignModalDirect();
    loadPacked();
  } else {
    errEl.textContent   = data.message || 'Failed to assign rider.';
    errEl.style.display = 'block';
  }
}

/* ── Batch Assign Modal ─────────────────────────────────── */
function openBatchAssignModal(orderIds, zoneLabel) {
  batchAssignState.orderIds  = orderIds;
  batchAssignState.zoneLabel = zoneLabel;
  document.getElementById('batch-assign-subtitle').textContent =
    `${orderIds.length} orders in "${zoneLabel}"`;
  document.getElementById('batch-assign-error').style.display = 'none';

  const ordersInZone = session.orders.packed.filter(o => orderIds.includes(o.order_id));
  document.getElementById('batch-assign-orders').innerHTML = ordersInZone.map(o =>
    `<div class="zone-mini-order">
       ${escHtml(o.order_number)} — ${escHtml(o.first_name)} ${escHtml(o.last_name)}
     </div>`).join('');

  document.getElementById('batch-rider-select').innerHTML =
    '<option value="">— Choose a rider —</option>' +
    session.riders.map(r =>
      `<option value="${r.user_id}">${escHtml(r.first_name)} ${escHtml(r.last_name)}</option>`
    ).join('');

  document.getElementById('batch-assign-modal-overlay').style.display = 'flex';
}
function closeBatchAssignModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('batch-assign-modal-overlay').style.display = 'none';
}

async function confirmBatchAssign() {
  const riderId = parseInt(document.getElementById('batch-rider-select').value);
  const errEl   = document.getElementById('batch-assign-error');
  if (!riderId) {
    errEl.textContent   = 'Please select a rider.';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  const data = await apiPost('batch_assign_riders', {
    order_ids: batchAssignState.orderIds,
    rider_id:  riderId,
  });
  if (data.success) {
    toast(`${data.assigned} orders assigned to rider! 🛵`, 'success');
    document.getElementById('batch-assign-modal-overlay').style.display = 'none';
    loadPacked();
  } else {
    errEl.textContent   = data.message || 'Failed to assign.';
    errEl.style.display = 'block';
  }
}

/* ── Dispatch from Assign page ──────────────────────────── */
async function openDispatchModal(orderId, orderNum) {
  const overlay = document.getElementById('dispatch-confirm-overlay');
  const msgEl   = document.getElementById('dispatch-confirm-msg');
  const btn     = document.getElementById('dispatch-confirm-btn');

  overlay.style.display = 'flex';
  msgEl.textContent     = `Verifying payment status for order ${orderNum}…`;
  btn.disabled          = true;
  btn.onclick           = null;

  const data = await apiGet('order', { id: orderId });
  if (!data.success) {
    msgEl.textContent = 'Unable to verify order details. Please refresh and try again.';
    return;
  }

  const order          = data.data;
  const DIGITAL_METHODS = ['gcash', 'maya', 'paymaya', 'bank transfer', 'online payment', 'e-wallet'];
  const methodLower    = (order.payment_method || '').toLowerCase();
  const isDigital      = DIGITAL_METHODS.some(m => methodLower.includes(m));
  const isCleared      = ['Verified', 'Paid'].includes(order.pay_status);

  if (isDigital && !isCleared) {
    msgEl.innerHTML = `
      <div role="alert" style="
        background:var(--error-bg,#fff0f0);
        border:2px solid var(--error,#d32f2f);
        border-radius:var(--radius-md,8px);
        padding:.9rem 1rem;
        text-align:left">
        <strong style="color:var(--error,#d32f2f);font-size:1rem;display:block;margin-bottom:.4rem">
          🚫 Payment Clearance Required
        </strong>
        Order <strong>${escHtml(orderNum)}</strong> uses
        <strong>${escHtml(order.payment_method)}</strong>
        and is currently
        <strong style="color:var(--error,#d32f2f)">${escHtml(order.pay_status || 'Unpaid')}</strong>.
        <br/><br/>
        <span style="font-size:.85rem;color:var(--text-muted,#666)">
          Digital payments must be marked <strong>Verified</strong> or <strong>Paid</strong>
          before dispatch. Contact a <strong>Super Admin</strong> for financial clearance before
          proceeding.
        </span>
      </div>`;
    // btn stays disabled — dispatch is blocked
    return;
  }

  msgEl.textContent = `Dispatch order ${orderNum} for delivery now? This will notify the customer.`;
  btn.disabled      = false;
  btn.onclick       = () => confirmDispatch(orderId, orderNum);
}

function closeDispatchConfirm(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('dispatch-confirm-overlay').style.display = 'none';
}

async function confirmDispatch(orderId, orderNum) {
  document.getElementById('dispatch-confirm-overlay').style.display = 'none';
  const data = await apiPost('dispatch_order', { order_id: orderId });
  if (data.success) {
    toast(`Order ${orderNum} dispatched! 🛵`, 'success');
    loadPacked();
    loadDispatch();
    updateDispatchBadge();
  } else {
    toast(data.message || 'Failed to dispatch.', 'error');
  }
}


