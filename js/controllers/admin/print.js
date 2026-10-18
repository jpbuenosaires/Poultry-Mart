// admin/print.js — admin portal: print helpers
'use strict';

/* ════════════════════════════════════════════════════════════
   PRINT HELPERS
═══════════════════════════════════════════════════════════════*/

async function printPackingSlip(orderId) {
  const res = await apiGet('order', { id: orderId });
  if (!res.success) { toast(res.message, 'error'); return; }
  const o   = res.data;
  const now = new Date().toLocaleString('en-PH');

  let subtotal = 0;
  const itemRows = (o.items || []).map(it => {
    const isCW       = it.is_catch_weight == 1 || it.pricing_model === 'catch_weight';
    const price      = parseFloat(it.price_per_kg || it.unit_price || 0);
    const qty        = parseInt(it.quantity || 1);
    const unitSuffix = it.pricing_model === 'per_piece' ? 'pc' : 'pack';
    let sub, wtDisplay, priceDisplay;
    if (isCW) {
      const wt     = parseFloat(it.actual_weight || it.estimated_weight || 0) * qty;
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
      <td>${escHtml(it.name)}</td>
      <td>${qty}</td>
      <td>${wtDisplay}</td>
      <td>${priceDisplay}</td>
      <td>${fmtPrice(sub)}</td>
    </tr>`;
  }).join('');

  const discount = parseFloat(o.discount_amount || 0);
  const delivery = parseFloat(o.delivery_fee    || 0);
  const grand    = Math.max(0, subtotal - discount) + delivery;

  document.getElementById('thermal-labels').innerHTML   = '';
  document.getElementById('prep-sheet-print').innerHTML = '';

  const slipEl = document.getElementById('print-slip');
  slipEl.innerHTML = `
    <div class="slip-header">
      <div class="slip-brand">🐓 PoultryMart</div>
      <div class="slip-portal">Admin Packing Slip</div>
    </div>
    <hr class="slip-hr"/>
    <div class="slip-title">Order: ${escHtml(o.order_number)}</div>
    <div class="slip-meta-grid">
      <div class="slip-meta-item">
        <div class="slip-meta-label">Customer</div>
        <div class="slip-meta-val">${escHtml(o.first_name)} ${escHtml(o.last_name)}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Phone</div>
        <div class="slip-meta-val">${escHtml(o.phone || '—')}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Delivery Date</div>
        <div class="slip-meta-val">${fmtDate(o.delivery_date)}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Time Slot</div>
        <div class="slip-meta-val">${escHtml(o.slot_label || '—')}</div>
      </div>
      <div class="slip-meta-item" style="grid-column:1/-1">
        <div class="slip-meta-label">Address</div>
        <div class="slip-meta-val">${escHtml(o.street || '')}, ${escHtml(o.barangay || '')}, ${escHtml(o.city || '')}, ${escHtml(o.province || 'Albay')}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Payment</div>
        <div class="slip-meta-val">${escHtml(o.payment_method || '—')}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Status</div>
        <div class="slip-meta-val">${escHtml(o.status || '—')}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Rider</div>
        <div class="slip-meta-val">${o.rider_first ? escHtml(o.rider_first) + ' ' + escHtml(o.rider_last) : 'Not yet assigned'}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Printed</div>
        <div class="slip-meta-val">${now}</div>
      </div>
    </div>
    <hr class="slip-hr"/>
    <table class="slip-items-table">
      <thead><tr><th>Product</th><th>Qty</th><th>Weight/Units</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr class="slip-hr"/>
    <div class="slip-totals">
      <div class="slip-total-row"><span>Items Subtotal</span><span>${fmtPrice(subtotal)}</span></div>
      ${discount > 0 ? `<div class="slip-total-row"><span>Discount</span><span>−${fmtPrice(discount)}</span></div>` : ''}
      <div class="slip-total-row"><span>Delivery Fee</span><span>${fmtPrice(delivery)}</span></div>
      <div class="slip-total-row slip-grand-row"><span>FINAL TOTAL</span><span>${fmtPrice(grand)}</span></div>
    </div>
    ${o.special_instructions ? `<div class="slip-notes"><strong>Special Instructions:</strong> ${escHtml(o.special_instructions)}</div>` : ''}
    <div class="slip-footer">PoultryMart · Fresh Poultry Delivered in Albay</div>`;

  slipEl.setAttribute('data-print-mode', 'active');
  const afterPrint2 = () => {
    slipEl.innerHTML = '';
    slipEl.removeAttribute('data-print-mode');
    window.removeEventListener('afterprint', afterPrint2);
  };
  window.addEventListener('afterprint', afterPrint2);
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

async function printItemLabels(orderId) {
  const res = await apiGet('order', { id: orderId });
  if (!res.success) { toast(res.message, 'error'); return; }
  const o = res.data;

  const labelsHtml = (o.items || []).map(it => {
    const isCW  = it.is_catch_weight == 1 || it.pricing_model === 'catch_weight';
    const price = parseFloat(it.price_per_kg || it.unit_price || 0);
    const qty   = parseInt(it.quantity || 1);
    let sub, wtDisplay;
    if (isCW) {
      const wt = parseFloat(it.actual_weight || it.estimated_weight || 0) * qty;
      sub       = price * wt;
      wtDisplay = wt.toFixed(3) + ' kg';
    } else {
      sub       = price * qty;
      wtDisplay = `${qty} ${it.pricing_model === 'per_piece' ? 'pc' : 'pack'}`;
    }
    return `
      <div class="thermal-label">
        <div class="tl-brand">🐓 PoultryMart</div>
        <div class="tl-product">${escHtml(it.name)}</div>
        <div class="tl-order">${escHtml(o.order_number)}</div>
        <div class="tl-weight">${wtDisplay}</div>
        <div class="tl-price">${fmtPrice(sub)}</div>
        <div class="tl-customer">${escHtml(o.first_name)} ${escHtml(o.last_name)}</div>
        <div class="tl-date">Deliver: ${fmtDate(o.delivery_date)}</div>
      </div>`;
  }).join('');

  document.getElementById('print-slip').innerHTML        = '';
  document.getElementById('prep-sheet-print').innerHTML  = '';

  const labelsEl = document.getElementById('thermal-labels');
  labelsEl.innerHTML = labelsHtml;
  labelsEl.setAttribute('data-print-mode', 'active');

  const afterPrint3 = () => {
    labelsEl.innerHTML = '';
    labelsEl.removeAttribute('data-print-mode');
    window.removeEventListener('afterprint', afterPrint3);
  };
  window.addEventListener('afterprint', afterPrint3);
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

