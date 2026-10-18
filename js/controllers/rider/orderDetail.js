// rider/orderDetail.js — rider portal: order detail modal
'use strict';

/* ════════════════════════════════════════════════════════════
   ORDER DETAIL MODAL
═══════════════════════════════════════════════════════════════*/

async function openOrderModal(orderId) {
  const body = document.getElementById('rider-modal-body');
  body.innerHTML = spinnerHTML('Loading order details');
  _orderModalCleanup = openAccessibleModal('rider-order-modal-overlay', 'rider-modal-close');

  const res = await apiGet('order', { id: orderId });
  if (!res.success) { body.innerHTML = errorHTML(res.message); return; }

  const o    = res.data;
  rModal.order = o;

  const finalAmt = o.final_total ?? o.estimated_total;
  const mapsUrl  = buildMapsUrl(o);

  const itemRows = (o.items || []).map(item => `
    <tr>
      <td class="item-name-cell">${escHtml(item.name)}</td>
      <td>${escHtml(String(item.quantity))}</td>
      <td>${item.price_per_kg ? fmtPrice(item.price_per_kg) + '/kg' : '—'}</td>
      <td class="item-weight-actual">
        ${item.actual_weight
          ? parseFloat(item.actual_weight).toFixed(3) + ' kg'
          : '<span class="text-muted">—</span>'}
      </td>
      <td class="text-right">
        <strong>${fmtPrice(item.final_subtotal ?? item.estimated_subtotal)}</strong>
      </td>
    </tr>`).join('');

  body.innerHTML = `
    <section class="detail-section" aria-labelledby="detail-status-title">
      <h3 class="detail-section-title" id="detail-status-title">Order Status</h3>
      ${detailRow('Status', statusBadge(o.status))}
      ${detailRow('Delivery Date', fmtDate(o.delivery_date))}
      ${o.slot_label ? detailRow('Time Slot', `<span aria-hidden="true">🕐</span> ${escHtml(o.slot_label)}`) : ''}
      ${o.dispatched_at ? detailRow('Dispatched', fmtDateTime(o.dispatched_at)) : ''}
    </section>

    <section class="detail-section" aria-labelledby="detail-customer-title">
      <h3 class="detail-section-title" id="detail-customer-title">Customer</h3>
      ${detailRow('Name', escHtml(o.first_name + ' ' + o.last_name))}
      ${detailRow('Phone', o.phone ? `
        <a href="tel:${escHtml(o.phone)}" class="btn-outline btn-sm" style="margin-right:.25rem"
          aria-label="Call ${escHtml(o.first_name)} at ${escHtml(o.phone)}">
          <span aria-hidden="true">📞</span> Call
        </a>
        <a href="sms:${escHtml(o.phone)}" class="btn-outline btn-sm"
          aria-label="Send SMS to ${escHtml(o.first_name)} at ${escHtml(o.phone)}">
          <span aria-hidden="true">💬</span> SMS
        </a>
        <span style="margin-left:.5rem;color:var(--text-muted,#6b7280);font-size:.85rem">${escHtml(o.phone)}</span>
      ` : '—')}
    </section>

    <section class="detail-section" aria-labelledby="detail-address-title">
      <h3 class="detail-section-title" id="detail-address-title">Delivery Address</h3>
      <address class="detail-address">
        ${escHtml(o.street)},<br>
        ${escHtml(o.barangay)}, ${escHtml(o.city)}<br>
        ${escHtml(o.province)}
      </address>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.5rem">
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
          class="btn-outline btn-sm delivery-map-link"
          aria-label="Navigate in Google Maps (opens new tab)">
          <span aria-hidden="true">🗺️</span> Google Maps
        </a>
        <a href="https://waze.com/ul?q=${encodeURIComponent([o.street,o.barangay,o.city,o.province].filter(Boolean).join(', '))}&navigate=yes"
          target="_blank" rel="noopener noreferrer"
          class="btn-outline btn-sm"
          aria-label="Navigate in Waze (opens new tab)">
          <span aria-hidden="true">🚗</span> Waze
        </a>
      </div>
      ${o.special_instructions ? `
        <div class="detail-row" style="margin-top:.5rem">
          <span class="detail-row-label">Special Instructions</span>
          <span class="detail-row-value special-instructions">
            ${escHtml(o.special_instructions)}
          </span>
        </div>` : ''}
    </section>

    <section class="detail-section" aria-labelledby="detail-items-title">
      <h3 class="detail-section-title" id="detail-items-title">Order Items</h3>
      <div class="rider-table-wrap" tabindex="0" role="region" aria-label="Order items table">
        <table class="order-items-table" aria-label="Items in this order">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Qty</th>
              <th scope="col">Price</th>
              <th scope="col">Actual Wt.</th>
              <th scope="col" class="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
    </section>

    <section class="detail-section" aria-labelledby="detail-payment-title">
      <h3 class="detail-section-title" id="detail-payment-title">Payment Summary</h3>
      ${o.estimated_total !== o.final_total && o.final_total
        ? detailRow('Est. Subtotal', fmtPrice(o.estimated_total)) : ''}
      ${parseFloat(o.discount_amount) > 0
        ? detailRow(
            `Discount${o.promo_code ? ' (' + escHtml(o.promo_code) + ')' : ''}`,
            `<span style="color:var(--error)">−${fmtPrice(o.discount_amount)}</span>`)
        : ''}
      ${parseFloat(o.delivery_fee) > 0
        ? detailRow('Delivery Fee', fmtPrice(o.delivery_fee)) : ''}
      <div class="detail-row total-row"
        aria-label="${o.final_total ? 'Final' : 'Estimated'} total: ${fmtPrice(finalAmt)}">
        <span class="detail-row-label">${o.final_total ? 'Final Total' : 'Estimated Total'}</span>
        <span class="detail-row-value">${fmtPrice(finalAmt)}</span>
      </div>
      ${detailRow('Payment Method', `<span aria-hidden="true">${payIcon(o.payment_method)}</span> ${escHtml(o.payment_method)}`)}
      ${detailRow('Payment Status', payBadge(o.pay_status))}
    </section>

    ${o.proof_of_delivery_url ? `
    <section class="detail-section" aria-labelledby="detail-pod-title">
      <h3 class="detail-section-title" id="detail-pod-title">Proof of Delivery</h3>
      <img src="${escHtml(o.proof_of_delivery_url)}"
        alt="Proof of delivery photo for order ${escHtml(o.order_number)}"
        class="pod-image">
    </section>` : ''}`;

  renderModalFooter(o);
  document.getElementById('rider-modal-title').textContent = 'Order ' + o.order_number;
}

function renderModalFooter(o) {
  const footer  = document.getElementById('rider-modal-footer');
  const actions = [];

  if (o.status === 'Packed') {
    actions.push(`
      <button class="btn-primary" type="button"
        onclick="confirmStartDelivery(${o.order_id}, '${escHtml(o.order_number)}')">
        <span aria-hidden="true">🚴</span> Start Delivery
      </button>`);
  }
  if (o.status === 'Out for Delivery') {
    actions.push(`
      <button class="btn-outline" type="button"
        onclick="undoStatus(${o.order_id}, 'Packed', '${escHtml(o.order_number)}')">
        <span aria-hidden="true">↩️</span> Undo
      </button>
      <button class="btn-outline" type="button" onclick="markArrived(${o.order_id})">
        <span aria-hidden="true">📍</span> Mark Arrived
      </button>
      <button class="btn-primary" type="button" onclick="openCompleteModal(${o.order_id})">
        <span aria-hidden="true">✅</span> Complete Delivery
      </button>
      <button class="btn-danger" type="button" onclick="openIssueModal(${o.order_id})">
        <span aria-hidden="true">⚠️</span> Report Issue
      </button>`);
  }
  if (o.status === 'Arrived at Location') {
    actions.push(`
      <button class="btn-outline" type="button"
        onclick="undoStatus(${o.order_id}, 'Out for Delivery', '${escHtml(o.order_number)}')">
        <span aria-hidden="true">↩️</span> Undo
      </button>
      <button class="btn-primary" type="button" onclick="openCompleteModal(${o.order_id})">
        <span aria-hidden="true">✅</span> Complete Delivery
      </button>
      <button class="btn-danger" type="button" onclick="openIssueModal(${o.order_id})">
        <span aria-hidden="true">⚠️</span> Report Issue
      </button>`);
  }

  footer.innerHTML = `
    <button class="btn-outline" type="button" onclick="closeOrderModal()">Close</button>
    ${actions.join('')}`;
}

function closeOrderModal() {
  closeAccessibleModal('rider-order-modal-overlay', document.activeElement, _orderModalCleanup);
  _orderModalCleanup = null;
  rModal.order   = null;
  rModal.podData = null;
  rModal.podMime = null;
}

