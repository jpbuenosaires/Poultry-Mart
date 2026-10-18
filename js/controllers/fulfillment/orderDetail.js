// fulfillment/orderDetail.js — fulfillment portal: read-only order detail modal
'use strict';

/* ════════════════════════════════════════════════════════════
   ORDER DETAIL MODAL (read-only)
═══════════════════════════════════════════════════════════════*/

async function openDetailModal(orderId) {
  const overlay = document.getElementById('detail-modal-overlay');
  const content = document.getElementById('detail-modal-content');
  overlay.style.display = 'flex';
  trapFocus(overlay.querySelector('.modal-box') || overlay);
  content.innerHTML     = spinnerHTML('Loading order');

  const data = await apiGet('order', { id: orderId });
  if (!data.success) {
    content.innerHTML = `<p style="color:var(--error)">${escHtml(data.message)}</p>`;
    return;
  }

  const o        = data.data;
  const isPacked = ['Packed', 'Out for Delivery', 'Arrived at Location', 'Completed'].includes(o.status);
  const items    = o.items || [];
  let itemsTotal = 0;

  const itemRows = items.map(i => {
    const sub = isPacked && i.final_subtotal
      ? parseFloat(i.final_subtotal)
      : parseFloat(i.estimated_subtotal);
    itemsTotal += sub;
    return `
      <tr>
        <td>
          ${escHtml(i.name)}
          ${i.pricing_model === 'catch_weight'
            ? '<span style="font-size:.7rem;color:var(--orange);font-weight:700;margin-left:.3rem">⚖</span>'
            : ''}
        </td>
        <td style="text-align:center">${i.quantity}</td>
        <td>
          ${i.pricing_model === 'catch_weight'
            ? (isPacked && i.actual_weight
                ? `<strong>${parseFloat(i.actual_weight).toFixed(3)} kg</strong>`
                : `~${i.estimated_weight} kg`)
            : `${i.quantity} ${i.pricing_model === 'per_piece' ? 'pc' : 'pack'}`}
        </td>
        <td>${i.pricing_model === 'catch_weight'
          ? fmtPrice(i.price_per_kg || i.unit_price) + '/kg'
          : fmtPrice(i.price_per_kg || i.unit_price) + '/' + (i.pricing_model === 'per_piece' ? 'pc' : 'pack')}</td>
        <td style="text-align:right;font-weight:700">
          ${isPacked && i.final_subtotal
            ? `<span style="color:var(--green)">${fmtPrice(i.final_subtotal)}</span>`
            : fmtPrice(i.estimated_subtotal)}
        </td>
        ${o.status === 'Pending'
          ? `<td>
               <button class="btn-action btn-action-muted" style="font-size:.72rem"
                 onclick="markItemOos(${o.order_id}, ${i.order_item_id}, '${escHtml(i.name)}')"
                 aria-label="Mark ${escHtml(i.name)} as out of stock">🚫 OOS</button>
             </td>`
          : '<td></td>'}
      </tr>`;
  }).join('');

  const riderInfo    = o.rider_first
    ? `${o.rider_first} ${o.rider_last} ${o.rider_phone ? `(${o.rider_phone})` : ''}`
    : 'Not assigned';
  const dispatchedAt = o.dispatched_at ? fmtDateTime(o.dispatched_at) : '—';
  const deliveredAt  = o.delivered_at  ? fmtDateTime(o.delivered_at)  : '—';
  const hasPod       = o.proof_of_delivery_url;

  content.innerHTML = `
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
            ${escHtml(o.addr_label || '')}: ${escHtml(o.street)},
            ${escHtml(o.barangay)}, ${escHtml(o.city)}, ${escHtml(o.province)}
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
        ${hasPod ? `
        <div class="detail-info-item" style="grid-column:1/-1">
          <div class="detail-info-label">Proof of Delivery</div>
          <div class="detail-info-val">
            <button class="btn-action btn-action-blue"
              onclick="openPodModal('${escHtml(o.proof_of_delivery_url)}', '${escHtml(o.order_number)}')">
              📸 View Photo
            </button>
          </div>
        </div>` : ''}
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
            <th></th>
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

    <div style="display:flex;gap:.75rem;margin-top:1rem;flex-wrap:wrap">
      ${o.status === 'Pending'
        ? `<button class="btn-primary"
             onclick="closeDetailModalDirect(); openPackModal(${o.order_id})">⚖ Pack This Order</button>` : ''}
      ${o.status === 'Packed'
        ? `<button class="btn-primary"
             onclick="closeDetailModalDirect(); openAssignModal(${o.order_id}, '${escHtml(o.order_number)}')">
             🛵 Assign Rider</button>
           <button class="btn-outline"
             onclick="closeDetailModalDirect(); openDispatchModal(${o.order_id}, '${escHtml(o.order_number)}')">
             🚀 Dispatch</button>` : ''}
      ${o.status === 'Out for Delivery'
        ? `<button class="btn-primary"
             onclick="closeDetailModalDirect(); markDelivered(${o.order_id}, '${escHtml(o.order_number)}')">
             ✅ Mark Delivered</button>` : ''}
    </div>`;
}

async function markItemOos(orderId, itemId, itemName) {
  if (!confirm(`Mark "${itemName}" as Out of Stock? This will zero the item and recalculate the order total.`))
    return;
  closeDetailModalDirect();

  const data = await apiPost('mark_out_of_stock', {
    order_id:      orderId,
    order_item_id: itemId,
  });
  if (data.success) {
    toast(`"${itemName}" marked Out of Stock. New total: ${fmtPrice(data.new_total)}`, 'warning');
    loadQueue();
    loadAllOrders();
  } else {
    toast(data.message || 'Failed.', 'error');
  }
}

function closeDetailModal(event) {
  if (event.target === event.currentTarget) closeDetailModalDirect();
}
function closeDetailModalDirect() {
  releaseFocusTrap();
  document.getElementById('detail-modal-overlay').style.display = 'none';
}

