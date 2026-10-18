// rider/deliveryCards.js — rider portal: delivery card rendering
'use strict';

/* ════════════════════════════════════════════════════════════
   DELIVERY CARD RENDERING
═══════════════════════════════════════════════════════════════*/

/** Check if the order's time-slot window has already passed. */
function timeWindowWarning(o) {
  const endTimeStr = o.slot_end_time || '';
  if (!endTimeStr || !isToday(o.delivery_date)) return '';
  const [h, m] = endTimeStr.split(':').map(Number);
  const endDate = new Date();
  endDate.setHours(h, m, 0, 0);
  if (new Date() > endDate) {
    return `
      <div class="time-window-warning" role="alert" aria-live="assertive">
        <span aria-hidden="true">⏰</span>
        <strong>Time window passed</strong> — Customer's slot ended at ${fmtTime12(endTimeStr)}.
      </div>`;
  }
  return '';
}

function renderDeliveryCard(o) {
  const urgent   = isUrgent(o.delivery_date);
  const priority = ['Out for Delivery', 'Arrived at Location'].includes(o.status)
    ? 'priority-active'
    : urgent ? 'priority-urgent' : 'priority-normal';

  const finalAmt   = o.final_total ?? o.estimated_total;
  const mapsUrl    = buildMapsUrl(o);
  const actionBtns = renderCardActions(o);

  return `
    <article class="delivery-card ${priority}" aria-labelledby="card-title-${o.order_id}">
      ${timeWindowWarning(o)}
      <div class="delivery-card-header">
        <span class="delivery-order-num" id="card-title-${o.order_id}">${escHtml(o.order_number)}</span>
        ${statusBadge(o.status)}
        ${o.slot_label
          ? `<span class="delivery-slot-badge"><span aria-hidden="true">🕐</span> ${escHtml(o.slot_label)}</span>`
          : ''}
        ${urgent
          ? `<span class="delivery-urgency-badge" aria-label="Urgency: ${deliveryLabel(o.delivery_date)}">
               <span aria-hidden="true">⚡</span> ${deliveryLabel(o.delivery_date)}
             </span>`
          : `<span class="delivery-slot-badge" aria-label="Delivery date: ${deliveryLabel(o.delivery_date)}">
               ${deliveryLabel(o.delivery_date)}
             </span>`}
        <div class="delivery-card-header-actions">
          <button class="btn-outline btn-sm" type="button"
            onclick="openOrderModal(${o.order_id})"
            aria-label="View details for order ${escHtml(o.order_number)}">Details</button>
        </div>
      </div>

      <div class="delivery-card-body">
        <div class="delivery-customer-col">
          <div class="delivery-col-label" aria-hidden="true">Customer</div>
          <div class="delivery-customer-name">${escHtml(o.first_name + ' ' + o.last_name)}</div>
          <div class="delivery-customer-phone">
            ${o.phone ? `
              <a href="tel:${escHtml(o.phone)}" class="btn-outline btn-sm"
                style="margin-right:.25rem"
                aria-label="Call ${escHtml(o.first_name)} at ${escHtml(o.phone)}">
                <span aria-hidden="true">📞</span> Call
              </a>
              <a href="sms:${escHtml(o.phone)}" class="btn-outline btn-sm"
                aria-label="Send SMS to ${escHtml(o.first_name)} at ${escHtml(o.phone)}">
                <span aria-hidden="true">💬</span> SMS
              </a>
              <span class="sr-only">${escHtml(o.phone)}</span>
            ` : `<span class="text-muted">No phone</span>`}
          </div>
        </div>

        <div class="delivery-address-col">
          <div class="delivery-col-label" aria-hidden="true">Delivery Address</div>
          <address class="delivery-address-text">
            ${escHtml(o.street)},<br>
            ${escHtml(o.barangay)}, ${escHtml(o.city)},<br>
            ${escHtml(o.province)}
          </address>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.35rem">
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
              class="btn-outline btn-sm delivery-map-link"
              aria-label="Navigate to order ${escHtml(o.order_number)} in Google Maps (opens new tab)">
              <span aria-hidden="true">🗺️</span> Google Maps
            </a>
            <a href="https://waze.com/ul?q=${encodeURIComponent([o.street,o.barangay,o.city,o.province].filter(Boolean).join(', '))}&navigate=yes"
              target="_blank" rel="noopener noreferrer"
              class="btn-outline btn-sm"
              aria-label="Navigate to order ${escHtml(o.order_number)} in Waze (opens new tab)">
              <span aria-hidden="true">🚗</span> Waze
            </a>
          </div>
        </div>
      </div>

      <div class="delivery-card-footer">
        <div>
          <div class="delivery-total" aria-label="Order total: ${fmtPrice(finalAmt)}">
            ${fmtPrice(finalAmt)}
          </div>
          <div class="delivery-pay-method">
            <span aria-hidden="true">${payIcon(o.payment_method)}</span>
            ${escHtml(o.payment_method)} · ${payBadge(o.pay_status)}
          </div>
        </div>
        <div class="delivery-footer-actions">${actionBtns}</div>
      </div>
    </article>`;
}

/** Render action buttons appropriate for the order's current status. */
function renderCardActions(o) {
  const num = escHtml(o.order_number);

  if (o.status === 'Packed') {
    return `
      <button class="btn-primary btn-sm" type="button"
        onclick="confirmStartDelivery(${o.order_id}, '${num}')"
        aria-label="Start delivery for order ${num}">
        <span aria-hidden="true">🚴</span> Start Delivery
      </button>`;
  }

  if (o.status === 'Out for Delivery') {
    return `
      <button class="btn-outline btn-sm" type="button"
        onclick="undoStatus(${o.order_id}, 'Packed', '${num}')"
        aria-label="Undo — revert order ${num} back to Packed">
        <span aria-hidden="true">↩️</span> Undo
      </button>
      <button class="btn-outline btn-sm" type="button"
        onclick="markArrived(${o.order_id})"
        aria-label="Mark arrived at location for order ${num}">
        <span aria-hidden="true">📍</span> Mark Arrived
      </button>
      <button class="btn-primary btn-sm" type="button"
        onclick="openCompleteModal(${o.order_id})"
        aria-label="Complete delivery for order ${num}">
        <span aria-hidden="true">✅</span> Complete
      </button>
      <button class="btn-danger btn-sm" type="button"
        onclick="openIssueModal(${o.order_id})"
        aria-label="Report failed delivery for order ${num}">
        <span aria-hidden="true">⚠️</span> Report Issue
      </button>`;
  }

  if (o.status === 'Arrived at Location') {
    return `
      <button class="btn-outline btn-sm" type="button"
        onclick="undoStatus(${o.order_id}, 'Out for Delivery', '${num}')"
        aria-label="Undo — revert order ${num} back to Out for Delivery">
        <span aria-hidden="true">↩️</span> Undo
      </button>
      <button class="btn-primary btn-sm" type="button"
        onclick="openCompleteModal(${o.order_id})"
        aria-label="Complete delivery for order ${num}">
        <span aria-hidden="true">✅</span> Complete Delivery
      </button>
      <button class="btn-danger btn-sm" type="button"
        onclick="openIssueModal(${o.order_id})"
        aria-label="Report failed delivery for order ${num}">
        <span aria-hidden="true">⚠️</span> Report Issue
      </button>`;
  }

  return '';
}

