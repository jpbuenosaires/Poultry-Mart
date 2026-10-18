// customer/orderDetail.js — customer portal: order detail modal, reorder, and edit order modal
'use strict';

/* ════════════════════════════════════════════════════════════
   ORDER DETAIL MODAL  [MAJOR IMPROVEMENT]
═══════════════════════════════════════════════════════════════*/

async function showOrderDetail(orderId) {
  const overlay = document.getElementById('order-modal-overlay');
  const content = document.getElementById('order-modal-content');
  overlay.style.display = 'flex';
  content.innerHTML     = spinnerHTML('Loading order');

  const data = await apiFetch(`${CUSTOMER_API}?action=order&order_id=${orderId}&user_id=${state.user.user_id}`);
  if (!data.success) { content.innerHTML = '<p>Could not load order.</p>'; return; }

  const o         = data.data;
  const isPacked  = ['Packed','Out for Delivery','Arrived at Location','Completed'].includes(o.status);
  const isPending = o.status === 'Pending';
  const isDone    = o.status === 'Completed';

  // Order tracking timeline — handles linear progress AND terminal alternative states
  const timelineSteps = ['Pending','Packed','Out for Delivery','Arrived at Location','Completed'];
  const currentIdx    = timelineSteps.indexOf(o.status);
  const TERMINAL_STATES = {
    'Cancelled':       { icon: '🚫', label: 'This order was cancelled.'              },
    'Failed Delivery': { icon: '❌', label: 'Delivery could not be completed.'       },
  };
  const terminal = TERMINAL_STATES[o.status];
  const timelineHTML = terminal
    ? `<div class="order-cancelled-banner">${terminal.icon} ${terminal.label}
         ${o.cancellation_reason ? `<p class="cancel-reason-note" style="margin-top:.4rem;font-size:.85rem;color:var(--text-muted)">${escHtml(o.cancellation_reason)}</p>` : ''}
       </div>`
    : `<div class="order-timeline">
      ${timelineSteps.map((step, idx) => {
        let cls = 'timeline-step';
        if (idx < currentIdx)  cls += ' step-done';
        if (idx === currentIdx) cls += ' step-active';
        const icons = { 'Pending':'🕐', 'Packed':'📦', 'Out for Delivery':'🚴', 'Arrived at Location':'📍', 'Completed':'✅' };
        return `<div class="${cls}">
          <div class="timeline-dot">${icons[step] || '●'}</div>
          <div class="timeline-label">${step}</div>
        </div>`;
      }).join('<div class="timeline-connector"></div>')}
    </div>`;

  // [NEW] Dispatch / delivery timestamps
  let timestampsHTML = '';
  if (o.dispatched_at || o.delivered_at) {
    timestampsHTML = `<div class="order-timestamps">`;
    if (o.dispatched_at) timestampsHTML += `<div class="ts-row"><span>🚴 Dispatched:</span><span>${fmtDateTime(o.dispatched_at)}</span></div>`;
    if (o.delivered_at)  timestampsHTML += `<div class="ts-row"><span>✅ Delivered:</span><span>${fmtDateTime(o.delivered_at)}</span></div>`;
    timestampsHTML += `</div>`;
  }

  // [NEW] Proof of delivery
  const podHTML = isDone && o.proof_of_delivery_url ? `
    <div class="pod-section">
      <h4>📸 Proof of Delivery</h4>
      <a href="${escHtml(o.proof_of_delivery_url)}" target="_blank" rel="noopener" class="pod-link">
        View Photo →
      </a>
    </div>` : '';

  // [NEW] Payment verification status
  let payStatusHTML = '';
  if (o.payment_method !== 'COD') {
    const verifiedAt = o.pay_verified_at;
    const payStatus  = o.pay_status || 'Unpaid';
    
    let gcashInfoHTML = '';
    if (o.payment_method === 'GCash') {
        const refCode = o.gcash_reference ? `<code style="background:var(--info-pale);color:var(--info-text);padding:.15rem .4rem;border-radius:4px;font-size:.8rem;font-weight:700">${escHtml(o.gcash_reference)}</code>` : '';
        const screenshot = o.gcash_screenshot ? `<a href="${escHtml(o.gcash_screenshot)}" target="_blank" style="text-decoration:none;font-size:.85rem;margin-left:.5rem">🖼 View Receipt</a>` : '';
        if (refCode || screenshot) {
            gcashInfoHTML = `<div style="margin-top:.4rem">${refCode}${screenshot}</div>`;
        }
    }

    payStatusHTML = `
      <div class="pay-verify-row" style="flex-direction:column;align-items:flex-start">
        <div style="display:flex;justify-content:space-between;width:100%">
          <span>💙 GCash Payment:</span>
          <span class="${payStatus === 'Paid' ? 'pay-verified' : 'pay-unverified'}">
            ${payStatus === 'Paid'
              ? `✅ Verified ${verifiedAt ? '(' + fmtDate(verifiedAt) + ')' : ''}`
              : '⏳ Pending verification by finance team'}
          </span>
        </div>
        ${gcashInfoHTML}
      </div>`;
  }

  // [NEW] Action buttons for completed orders
  let actionButtons = '';
  if (isDone) {
    // Review buttons per item
    const reviewBtns = (o.items || []).map(i => `
      <button class="btn-outline btn-sm" style="margin:.25rem"
        onclick="openReviewModal(${i.product_id}, ${o.order_id}, '${escHtml(i.name)}')">
        ⭐ Review: ${escHtml(i.name)}
      </button>`).join('');

    // Dispute button (one per order) + status if already filed
    let disputeSection = '';
    if (o.dispute) {
    const dStatusMap = { 'Open': '🟡 Open', 'Under Review': '🔵 Under Review', 'Resolved': '🟢 Resolved', 'Rejected': '🔴 Rejected' };
      // [NEW] Show resolved_at if available
      const resolvedStr = o.dispute.resolved_at
        ? ` · Resolved: ${fmtDateTime(o.dispute.resolved_at)}`
        : '';
      disputeSection = `<div class="dispute-status-row">
        📋 Dispute: <strong>${dStatusMap[o.dispute.dispute_status] || o.dispute.dispute_status}</strong>
        <span style="color:var(--text-muted);font-size:.8rem"> — filed ${fmtDate(o.dispute.created_at)}${escHtml(resolvedStr)}</span>
      </div>`;
    } else {
      disputeSection = `<button class="btn-outline btn-sm btn-danger-outline" style="margin:.25rem"
        onclick="openDisputeModal(${o.order_id})">🚨 Report Issue</button>`;
    }

    actionButtons = `
      <div class="modal-action-section">
        <h4 style="margin-bottom:.5rem">Post-Order Actions</h4>
        <div class="modal-review-btns">${reviewBtns}</div>
        ${disputeSection}
      </div>`;
  }

// Cancel button (Pending only)
  const cancelBtn = (isPending && state.user?.user_id == o.user_id)
    ? `<button class="btn-danger" style="margin-top:1rem;width:100%;justify-content:center"
        onclick="openCancelModal(${o.order_id})">Cancel Order</button>`
    : '';

  // Edit button (Pending only) — passes the full order object as JSON
  const editBtn = (isPending && state.user?.user_id == o.user_id)
    ? `<button class="btn-outline full-width" style="margin-top:.5rem;justify-content:center"
        onclick='openEditOrderModal(${JSON.stringify(o)})'>✏️ Edit Order</button>`
    : '';

  // Reorder button (all statuses except Pending, since Pending is already active)
  const reorderBtn = !isPending
    ? `<button id="reorder-btn-${o.order_id}" class="btn-outline full-width"
        style="margin-top:.75rem;justify-content:center"
        onclick="reorderFromOrder(${o.order_id})">🛒 Reorder</button>`
    : '';

  content.innerHTML = `
    <div class="modal-order-header">
      <h3>${o.order_number}</h3>
      <div style="margin-top:.4rem"><span class="status-badge status-${o.status.replace(/\s+/g, '-')}">${o.status}</span></div>
      <div style="font-size:.85rem;color:var(--text-muted);margin-top:.4rem">
        Delivery: ${fmtDate(o.delivery_date)} · ${o.slot_label || ''}<br/>Payment: ${o.payment_method}
      </div>
      ${o.street ? `<div style="font-size:.85rem;color:var(--text-muted);margin-top:.4rem">📍 ${o.street}, ${o.barangay}, ${o.city}</div>` : ''}
    </div>

    ${timelineHTML}
    ${timestampsHTML}
    ${payStatusHTML}
    ${podHTML}

    <div class="modal-items">
      <h4 style="margin-bottom:.5rem">Items</h4>
      ${(o.items || []).map(i => {
        const pm = i.pricing_model || 'catch_weight';
        return `<div class="modal-item">
          <span>${i.name} ×${i.quantity}<small style="display:block;color:var(--text-muted);font-size:.75rem">${pricingModelBadge(pm)}</small></span>
          <span>
          ${isPacked && i.actual_weight && pm === 'catch_weight'
              ? `<div class="weight-comparison-col">
                   <div class="weight-comparison">
                     <span class="weight-est" title="Estimated weight">~${parseFloat(i.estimated_weight || 0).toFixed(3)} kg</span>
                     <span class="weight-arrow">→</span>
                     <span class="weight-actual" title="Actual weight">${parseFloat(i.actual_weight).toFixed(3)} kg</span>
                   </div>
                   <div style="font-weight:700;color:var(--green)">${fmtPrice(i.final_subtotal)}</div>
                 </div>`
              : isPacked && pm !== 'catch_weight' && i.final_subtotal
                ? `<span style="color:var(--green);font-weight:700">${fmtPrice(i.final_subtotal)}</span>`
                : `<span style="color:var(--text-muted)">~${fmtPrice(i.estimated_subtotal)}</span>`}
          </span>
        </div>`;
      }).join('')}
    </div>

    <div class="modal-totals">
      <div class="summary-row"><span>Delivery Fee</span><span>${fmtPrice(o.delivery_fee)}</span></div>
      ${o.discount_amount > 0 ? `<div class="summary-row" style="color:var(--green)"><span>Discount</span><span>−${fmtPrice(o.discount_amount)}</span></div>` : ''}
      ${isPacked && o.final_total
        ? `<div class="summary-row total"><span>✓ Final Total</span><span style="color:var(--green)">${fmtPrice(o.final_total)}</span></div>
           <p style="font-size:.78rem;color:var(--text-muted);margin-top:.5rem">✓ Weighed and confirmed by staff</p>`
        : `<div class="summary-row total"><span>Estimated Total</span><span>${fmtPrice(o.estimated_total)}</span></div>
           <p style="font-size:.78rem;color:var(--orange);margin-top:.5rem">⚖ Final total confirmed after packing</p>`}
    </div>

${actionButtons}
    ${editBtn}
    ${cancelBtn}
    ${reorderBtn}`;
}

/**
 * Reorder: bulk-add all items from a past order into the current cart.
 * Skips archived products silently and reports a summary toast.
 */
async function reorderFromOrder(orderId) {
  if (!state.user) { navigate('auth'); return; }

  const data = await apiFetch(`${CUSTOMER_API}?action=order&order_id=${orderId}&user_id=${state.user.user_id}`);
  if (!data.success) { toast('Could not load order details.', 'error'); return; }

  const items   = data.data.items || [];
  const btn     = document.getElementById(`reorder-btn-${orderId}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }

  let added = 0, skipped = 0;
  for (const item of items) {
    try {
      const existingQty = state.cart.find(i => i.product_id == item.product_id)?.quantity || 0;
      const newQty = parseInt(existingQty) + parseInt(item.quantity);
      const res = await apiFetch(apiUrl('cart_add'), {
        method: 'POST',
        body:   JSON.stringify({ user_id: state.user.user_id, product_id: item.product_id, quantity: newQty }),
      });
      if (res.success) added++; else skipped++;
    } catch (_) { skipped++; }
  }

  // Refresh cart state
  const cartData = await apiFetch(`${CUSTOMER_API}?action=cart&user_id=${state.user.user_id}`);
  if (cartData.success) { state.cart = cartData.data?.items || []; updateCartBadge(); }

  if (btn) { btn.disabled = false; btn.textContent = '🛒 Reorder'; }
  closeOrderModal();

  const msg = skipped > 0
    ? `Added ${added} item(s) to cart. ${skipped} item(s) are no longer available.`
    : `Added ${added} item(s) to cart! 🛒`;
  toast(msg, added > 0 ? 'success' : 'error');
  if (added > 0) navigate('cart');
}

function closeOrderModal() {
  document.getElementById('order-modal-overlay').style.display = 'none';
}

/** Open the Edit Order modal pre-filled with the current order values. */
function openEditOrderModal(o) {
  document.getElementById('eo-order-id').value  = o.order_id;
  document.getElementById('eo-date').value       = o.delivery_date || '';
  const paySelect = document.getElementById('eo-payment');
  paySelect.value = o.payment_method || 'COD';
  paySelect.disabled = true; // Disabled to prevent switching to/from GCash without receipt upload
  paySelect.title = "Payment method cannot be changed after order placement. Please contact support.";
  document.getElementById('eo-notes').value      = o.special_instructions || '';
  document.getElementById('eo-error').style.display = 'none';

  // Populate slots and zones from cached checkoutMeta
  const slotSel = document.getElementById('eo-slot');
  const zoneSel = document.getElementById('eo-zone');
  const meta    = state.checkoutMeta;

  if (meta?.slots) {
    slotSel.innerHTML = meta.slots.map(s =>
      `<option value="${s.slot_id}" ${s.slot_id == o.slot_id ? 'selected' : ''}>${s.slot_label}</option>`
    ).join('');
  }
  if (meta?.zones) {
    zoneSel.innerHTML = meta.zones.map(z =>
      `<option value="${z.zone_id}" ${z.zone_id == o.zone_id ? 'selected' : ''}>${z.municipality_name} – ₱${parseFloat(z.delivery_fee).toFixed(2)}</option>`
    ).join('');
  }

  // Ensure checkoutMeta is loaded if it wasn't already
  if (!meta) {
    apiFetch(apiUrl('checkout_meta')).then(d => {
      if (d.success) {
        state.checkoutMeta = d.data;
        openEditOrderModal(o); // re-open with data
      }
    });
    return;
  }

  document.getElementById('edit-order-modal-overlay').style.display = 'flex';
}

function closeEditOrderModal() {
  document.getElementById('edit-order-modal-overlay').style.display = 'none';
}

async function submitEditOrder() {
  if (!state.user) return;
  const orderId = parseInt(document.getElementById('eo-order-id').value);
  const date    = document.getElementById('eo-date').value;
  const slotId  = parseInt(document.getElementById('eo-slot').value) || 0;
  const zoneId  = parseInt(document.getElementById('eo-zone').value) || 0;
  const pm      = document.getElementById('eo-payment').value;
  const notes   = document.getElementById('eo-notes').value.trim();
  const errEl   = document.getElementById('eo-error');
  errEl.style.display = 'none';

  if (!date) { errEl.textContent = 'Please select a delivery date.'; errEl.style.display = 'block'; return; }

  const data = await apiFetch(apiUrl('edit_order'), {
    method: 'POST',
    body:   JSON.stringify({
      user_id: state.user.user_id, order_id: orderId,
      delivery_date: date, slot_id: slotId, zone_id: zoneId,
      payment_method: pm, special_instructions: notes,
    }),
  });

  if (data.success) {
    toast('Order updated successfully! ✓', 'success');
    closeEditOrderModal();
    showOrderDetail(orderId); // refresh the detail modal
  } else {
    errEl.textContent   = data.message;
    errEl.style.display = 'block';
  }
}

