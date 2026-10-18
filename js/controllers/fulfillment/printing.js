// fulfillment/printing.js — fulfillment portal: thermal labels and packing slip printing
'use strict';

/* ── Thermal labels (40×60mm) ───────────────────────────── */
function printItemLabels() {
  const order = packState.order;
  if (!order) return;

  const labelsHtml = (order.items || []).map(item => {
    const isCatch = item.pricing_model === 'catch_weight';
    const input   = isCatch ? document.getElementById(`pack-wt-${item.order_item_id}`) : null;
    const price   = parseFloat(item.price_per_kg || item.unit_price);
    const qty     = parseInt(item.quantity || 1);
    let sub, wtDisplay;
    if (isCatch) {
      const parsedLabelWt = parseFloat(input?.value);
      const wt  = !isNaN(parsedLabelWt) ? parsedLabelWt : (parseFloat(item.estimated_weight) * qty);
      sub        = price * wt;
      wtDisplay  = wt.toFixed(3) + ' kg';
    } else {
      sub        = price * qty;
      wtDisplay  = `${qty} ${item.pricing_model === 'per_piece' ? 'pc' : 'pack'}`;
    }
    return `
      <div class="thermal-label">
        <div class="tl-brand">🐓 PoultryMart</div>
        <div class="tl-product">${escHtml(item.name)}</div>
        <div class="tl-order">${escHtml(order.order_number)}</div>
        <div class="tl-weight">${wtDisplay}</div>
        <div class="tl-price">${fmtPrice(sub)}</div>
        <div class="tl-customer">${escHtml(order.first_name)} ${escHtml(order.last_name)}</div>
        <div class="tl-date">${fmtDate(order.delivery_date)}</div>
      </div>`;
  }).join('');

  const labelsEl = document.getElementById('thermal-labels');
  labelsEl.innerHTML = labelsHtml;
  document.getElementById('print-slip').innerHTML = '';
  labelsEl.setAttribute('data-print-mode', 'active');

  const afterPrint = () => {
    labelsEl.removeAttribute('data-print-mode');
    window.removeEventListener('afterprint', afterPrint);
  };
  window.addEventListener('afterprint', afterPrint);
  // Double rAF ensures the browser has completed layout of the injected
  // thermal-label DOM before handing off to the OS print spooler.
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

/* ── Packing slip ───────────────────────────────────────── */
function printPackingSlip() {
  const order = packState.order;
  if (!order) return;

  let subtotal = 0;
  const itemRows = (order.items || []).map(item => {
    const isCatch = item.pricing_model === 'catch_weight';
    const input   = isCatch ? document.getElementById(`pack-wt-${item.order_item_id}`) : null;
    const price   = parseFloat(item.price_per_kg || item.unit_price);
    const qty     = parseInt(item.quantity || 1);
    const unitSuffix = item.pricing_model === 'per_piece' ? 'pc' : 'pack';
    let sub, wtDisplay, priceDisplay;
    if (isCatch) {
      const parsedSlipWt = parseFloat(input?.value);
      const wt   = !isNaN(parsedSlipWt) ? parsedSlipWt : (parseFloat(item.estimated_weight) * qty);
      sub          = price * wt;
      wtDisplay    = wt.toFixed(3) + ' kg';
      priceDisplay = fmtPrice(price) + '/kg';
    } else {
      sub          = price * qty;
      wtDisplay    = `${qty} ${unitSuffix}`;
      priceDisplay = fmtPrice(price) + '/' + unitSuffix;
    }
    subtotal += sub;
    return `<tr>
      <td>${escHtml(item.name)}</td>
      <td>${qty}</td>
      <td>${wtDisplay}</td>
      <td>${priceDisplay}</td>
      <td>${fmtPrice(sub)}</td>
    </tr>`;
  }).join('');

  const grand = Math.max(0, subtotal - packState.discountAmt) + packState.deliveryFee;
  const now   = new Date().toLocaleString('en-PH');

  document.getElementById('print-slip').innerHTML = `
    <div class="slip-header">
      <div class="slip-brand">🐓 PoultryMart</div>
      <div class="slip-portal">Fulfillment Packing Slip</div>
    </div>
    <hr class="slip-hr"/>
    <div class="slip-title">Order: ${escHtml(order.order_number)}</div>
    <div class="slip-meta-grid">
      <div class="slip-meta-item">
        <div class="slip-meta-label">Customer</div>
        <div class="slip-meta-val">${escHtml(order.first_name)} ${escHtml(order.last_name)}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Phone</div>
        <div class="slip-meta-val">${escHtml(order.phone || '—')}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Delivery Date</div>
        <div class="slip-meta-val">${fmtDate(order.delivery_date)}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Time Slot</div>
        <div class="slip-meta-val">${escHtml(order.slot_label || '—')}</div>
      </div>
      <div class="slip-meta-item" style="grid-column:1/-1">
        <div class="slip-meta-label">Address</div>
        <div class="slip-meta-val">
          ${escHtml(order.street || '')}, ${escHtml(order.barangay || '')},
          ${escHtml(order.city || '')}, ${escHtml(order.province || '')}
        </div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Payment</div>
        <div class="slip-meta-val">${escHtml(order.payment_method)}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Printed</div>
        <div class="slip-meta-val">${now}</div>
      </div>
    </div>
    <hr class="slip-hr"/>
    <table class="slip-items-table">
      <thead>
        <tr><th>Product</th><th>Qty</th><th>Actual Wt.</th><th>Price/kg</th><th>Subtotal</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr class="slip-hr"/>
    <div class="slip-totals">
      <div class="slip-total-row"><span>Items Subtotal</span><span>${fmtPrice(subtotal)}</span></div>
      ${packState.discountAmt > 0
        ? `<div class="slip-total-row">
             <span>Discount</span><span>−${fmtPrice(packState.discountAmt)}</span>
           </div>` : ''}
      <div class="slip-total-row"><span>Delivery Fee</span><span>${fmtPrice(packState.deliveryFee)}</span></div>
      <div class="slip-total-row slip-grand-row">
        <span>FINAL TOTAL</span><span>${fmtPrice(grand)}</span>
      </div>
    </div>
    ${order.special_instructions
      ? `<div class="slip-notes">
           <strong>Special Instructions:</strong> ${escHtml(order.special_instructions)}
         </div>` : ''}
    <div class="slip-footer">
      PoultryMart · Fresh Poultry Delivered in Albay<br/>
      Packed by: ${escHtml(session.user?.first_name || '')} ${escHtml(session.user?.last_name || '')}
    </div>`;

  document.getElementById('thermal-labels').innerHTML   = '';
  document.getElementById('prep-sheet-print').innerHTML = '';

  const slipEl      = document.getElementById('print-slip');
  slipEl.setAttribute('data-print-mode', 'active');
  const afterPrint2 = () => {
    // Clean up the injected slip markup after printing so it doesn't
    // linger in screen layout or affect subsequent print jobs.
    slipEl.innerHTML = '';
    slipEl.removeAttribute('data-print-mode');
    window.removeEventListener('afterprint', afterPrint2);
  };
  window.addEventListener('afterprint', afterPrint2);
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

