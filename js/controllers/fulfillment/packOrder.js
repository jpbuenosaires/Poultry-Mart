// fulfillment/packOrder.js — fulfillment portal: pack order modal (FIFO, split batch, manual override)
'use strict';

/* ════════════════════════════════════════════════════════════
   PACK ORDER MODAL  (FIFO + Split Batch + Manual Override)
═══════════════════════════════════════════════════════════════*/

async function openPackModal(orderId) {
  const overlay = document.getElementById('pack-modal-overlay');
  overlay.style.display = 'flex';
  packState.batchData   = {};
  trapFocus(overlay.querySelector('.modal-box') || overlay);

  // Reset UI
  document.getElementById('pack-modal-meta').textContent      = 'Loading order…';
  document.getElementById('pack-items-list').innerHTML        = spinnerHTML('Loading items');
  document.getElementById('pack-customer-strip').innerHTML    = '';
  document.getElementById('pack-items-subtotal').textContent  = '₱0.00';
  document.getElementById('pack-grand-total-val').textContent = '₱0.00';
  document.getElementById('pack-confirm-btn').disabled        = false;

  const data = await apiGet('order', { id: orderId });
  if (!data.success) {
    document.getElementById('pack-items-list').innerHTML =
      `<p style="color:var(--error)">Failed to load order: ${escHtml(data.message)}</p>`;
    return;
  }

  const order         = data.data;
  packState.order       = order;
  packState.deliveryFee = parseFloat(order.delivery_fee || 0);
  packState.discountAmt = parseFloat(order.discount_amount || 0);

  document.getElementById('pack-modal-meta').innerHTML =
    `Order <strong>${escHtml(order.order_number)}</strong> &nbsp;·&nbsp;
     Delivery: ${fmtDate(order.delivery_date)} &nbsp;·&nbsp; ${escHtml(order.slot_label || '')}`;

  document.getElementById('pack-customer-strip').innerHTML = `
    <div>
      <div class="pack-cs-label">Customer</div>
      <div class="pack-cs-val">${escHtml(order.first_name)} ${escHtml(order.last_name)}</div>
    </div>
    <div>
      <div class="pack-cs-label">Phone</div>
      <div class="pack-cs-val">${escHtml(order.phone || '—')}</div>
    </div>
    <div>
      <div class="pack-cs-label">Address</div>
      <div class="pack-cs-val">
        ${escHtml(order.street || '')}, ${escHtml(order.barangay || '')}, ${escHtml(order.city || '')}
      </div>
    </div>
    <div>
      <div class="pack-cs-label">Payment</div>
      <div class="pack-cs-val">${escHtml(order.payment_method)}</div>
    </div>
    ${order.special_instructions ? `
    <div style="grid-column:1/-1">
      <div class="pack-cs-label">Special Instructions</div>
      <div class="pack-cs-val" style="color:var(--orange)">${escHtml(order.special_instructions)}</div>
    </div>` : ''}`;

  // Pre-fetch FIFO batches for all catch-weight items
  const catchItems     = (order.items || []).filter(i => i.pricing_model === 'catch_weight');
  const uniqueProducts = [...new Set(catchItems.map(i => i.product_id))];
  await Promise.all(uniqueProducts.map(async pid => {
    const bd = await apiGet('batches_for_product', { product_id: pid });
    packState.batchData[pid] = bd.success ? bd.data : [];
  }));

  // Render each item row
  document.getElementById('pack-items-list').innerHTML =
    (order.items || []).map((item, idx) => {
      const isCatch    = item.pricing_model === 'catch_weight';
      const batches    = isCatch ? (packState.batchData[item.product_id] || []) : [];
      const firstBatch = batches[0];
      const estTotal   = parseFloat(item.estimated_weight || 0) * parseInt(item.quantity || 1);

            const batchPill = firstBatch ? `
        <div class="batch-pill" id="batch-pill-${item.order_item_id}">
          📦 Pulling from: Batch #${firstBatch.batch_id}
          (Rcvd: ${fmtDate(firstBatch.batch_date)}) |
          Available: <strong>${fmtKg(firstBatch.remaining_qty)}</strong>
          &nbsp;<button class="batch-change-btn"
            onclick="openBatchOverride(${item.order_item_id}, ${item.product_id})"
            aria-label="Change batch for ${escHtml(item.name)}">[Change Batch]</button>
        </div>
        <div class="batch-remaining-preview" id="batch-remaining-${item.order_item_id}"></div>
        <div class="batch-override-select" id="batch-override-${item.order_item_id}" style="display:none"></div>
        ${isCatch ? `<div class="split-batch-area" id="split-batch-${item.order_item_id}" style="display:none"></div>` : ''}
        ` : '';

      const outOfStockRow = `
        <div class="oos-toggle-row">
          <label class="oos-toggle-label" for="oos-${item.order_item_id}">
            <input type="checkbox" id="oos-${item.order_item_id}" class="oos-checkbox"
              data-item-id="${item.order_item_id}"
              onchange="toggleOutOfStock(${item.order_item_id}, this.checked)"/>
            Mark as Out of Stock
          </label>
        </div>`;

      const unitLabel = item.pricing_model === 'per_piece' ? 'pc' : 'pack';

      return `
        <div class="pack-item-row" id="pack-row-${item.order_item_id}"
          role="group" aria-label="${escHtml(item.name)}">
          <div class="pack-item-info">
            <div class="pack-item-name">
              ${escHtml(item.name)}
              ${isCatch
                ? '<span class="pack-item-catch-tag">⚖ Catch-Weight</span>'
                : `<span class="pack-item-fixed-tag">${item.pricing_model === 'per_piece' ? 'Per Piece' : 'Fixed Pack'}</span>`}
            </div>
            <div class="pack-item-meta">
              Qty: ${item.quantity} &nbsp;·&nbsp;
              ${isCatch
                ? `${fmtPrice(item.price_per_kg || item.unit_price)}/kg &nbsp;·&nbsp; Est. ${item.estimated_weight} kg/pc`
                : `${fmtPrice(item.price_per_kg || item.unit_price)}/${unitLabel}`}
            </div>
            ${batchPill}
            ${outOfStockRow}
          </div>

          <div class="pack-item-weight-group">
            ${isCatch ? `
            <label for="pack-wt-${item.order_item_id}">Actual Weight (kg)</label>
            <input
              type="number"
              id="pack-wt-${item.order_item_id}"
              class="pack-weight-input"
              data-idx="${idx}"
              data-item-id="${item.order_item_id}"
              data-product-id="${item.product_id}"
              data-price="${item.price_per_kg || item.unit_price}"
              data-qty="${item.quantity}"
              data-est="${estTotal}"
              data-first-batch-id="${firstBatch?.batch_id || ''}"
              data-first-batch-avail="${firstBatch?.remaining_qty || 0}"
              value="${estTotal.toFixed(3)}"
              min="0" step="0.001"
              aria-label="Actual weight in kg for ${escHtml(item.name)}"
              oninput="recalcPackTotal(); checkSplitBatch(${item.order_item_id})"
            />` : `
            <div class="pack-fixed-summary"
              id="pack-fixed-${item.order_item_id}"
              data-item-id="${item.order_item_id}"
              data-price="${item.price_per_kg || item.unit_price}"
              data-qty="${item.quantity}"
              data-est="${estTotal}"
              data-oos="0">
              <span style="font-size:.8rem;color:var(--text-muted)">Qty</span>
              <strong>${item.quantity}</strong>
              <span style="font-size:.8rem;color:var(--text-muted)">×</span>
              <strong>${fmtPrice(item.price_per_kg || item.unit_price)}</strong>
            </div>`}
          </div>

          <div class="pack-item-subtotal" id="pack-sub-${item.order_item_id}" aria-live="polite">
            ${fmtPrice(item.estimated_subtotal)}
          </div>
        </div>`;
    }).join('');

  // Discount / delivery fee rows
  const discRow = document.getElementById('pack-discount-row');
  discRow.style.display = packState.discountAmt > 0 ? 'flex' : 'none';
  if (packState.discountAmt > 0)
    document.getElementById('pack-discount-val').textContent = '−' + fmtPrice(packState.discountAmt);
  document.getElementById('pack-delivery-fee').textContent = fmtPrice(packState.deliveryFee);

  recalcPackTotal();
}

/* ── Batch change: opens a select dropdown ─────────────── */
function openBatchOverride(itemId, productId) {
  const batches   = packState.batchData[productId] || [];
  const container = document.getElementById(`batch-override-${itemId}`);
  if (!container) return;

  container.style.display = 'block';
  container.innerHTML = `
    <label class="batch-override-label" for="batch-sel-${itemId}">Choose batch:</label>
    <select id="batch-sel-${itemId}" class="form-input batch-override-sel"
      onchange="applyBatchOverride(${itemId}, ${productId}, this.value)">
      ${batches.map((b, i) => `
        <option value="${b.batch_id}" ${i === 0 ? 'selected' : ''}>
          Batch #${b.batch_id} (${fmtDate(b.batch_date)}) — ${fmtKg(b.remaining_qty)}
          ${i === 0 ? ' — Recommended' : ''}
        </option>`).join('')}
    </select>`;
}

function applyBatchOverride(itemId, productId, batchId) {
  batchId       = parseInt(batchId);
  const batches = packState.batchData[productId] || [];
  const chosen  = batches.find(b => b.batch_id === batchId);
  if (!chosen) return;

  const pill = document.getElementById(`batch-pill-${itemId}`);
  if (pill) {
    pill.innerHTML = `
      📦 Pulling from: Batch #${chosen.batch_id}
      (Rcvd: ${fmtDate(chosen.batch_date)}) | Available: <strong>${fmtKg(chosen.remaining_qty)}</strong>
      &nbsp;<button class="batch-change-btn"
        onclick="openBatchOverride(${itemId}, ${productId})">[Change Batch]</button>`;
  }

  const input = document.getElementById(`pack-wt-${itemId}`);
  if (input) {
    input.dataset.firstBatchId    = chosen.batch_id;
    input.dataset.firstBatchAvail = chosen.remaining_qty;
  }

  document.getElementById(`batch-override-${itemId}`).style.display = 'none';
  checkSplitBatch(itemId);
}

/* ── Split batch UI — N-batch dynamic ──────────────────── */
function checkSplitBatch(itemId) {
  const input    = document.getElementById(`pack-wt-${itemId}`);
  const splitDiv = document.getElementById(`split-batch-${itemId}`);
  const remDiv   = document.getElementById(`batch-remaining-${itemId}`);
  if (!input || !splitDiv) return;

  const parsedSplitWt = parseFloat(input.value);
  const actualWt  = !isNaN(parsedSplitWt) ? parsedSplitWt : 0;
  const avail     = parseFloat(input.dataset.firstBatchAvail) || 0;
  const productId = parseInt(input.dataset.productId);
  const batches   = packState.batchData[productId] || [];

  // Primary-batch remaining preview
  if (remDiv && avail > 0) {
    const afterPack    = Math.max(0, avail - Math.min(actualWt, avail));
    remDiv.textContent = `Remaining after pack: ${afterPack.toFixed(3)} kg`;
    remDiv.className   = 'batch-remaining-preview' +
      (afterPack <= 0 ? ' depleted' : afterPack < LOW_STOCK_THRESHOLD ? ' low' : '');
  }

  // Remove 'avail > 0' requirement so that if the primary batch is fully depleted (0), 
  // the split UI still activates and safely shifts the allocation to subsequent batches.
  if (actualWt > avail && batches.length > 1) {
    input.classList.add('split-needed');

    // Walk batches FIFO and allocate until the requested weight is satisfied
    let remaining = actualWt;
    const rows    = [];
    for (let i = 0; i < batches.length && remaining > 0.0001; i++) {
      const b      = batches[i];
      const bAvail = i === 0 ? avail : parseFloat(b.remaining_qty || 0);
      const take   = Math.min(remaining, bAvail);
      remaining   -= take;
      rows.push({ batch: b, take, bAvail, isFirst: i === 0 });
    }

    splitDiv.style.display = 'block';
    splitDiv.innerHTML = `
      <div class="split-batch-header">⚠️ Split across ${rows.length} batch${rows.length > 1 ? 'es' : ''}:</div>
      ${rows.map((r, i) => `
        <div class="split-batch-row">
          <span class="split-label">
            Batch #${r.batch.batch_id}
            ${r.isFirst ? '(primary — fully allocated)' : `(${fmtKg(r.bAvail)} available)`}
          </span>
          <input type="number"
            id="split-wt-${itemId}-${i}"
            class="split-wt-input"
            value="${r.take.toFixed(3)}"
            step="0.001" min="0"
            data-batch-id="${r.batch.batch_id}"
            ${r.isFirst ? 'readonly aria-readonly="true"' : ''}
            oninput="syncMultiSplitToMain(${itemId}); recalcPackTotal()"
            aria-label="Weight from batch #${r.batch.batch_id}"/>
          <span class="split-unit">kg</span>
        </div>`).join('')}
      ${remaining > 0.0001 ? `
        <div class="split-batch-warning" role="alert"
          style="color:var(--error,#d32f2f);font-size:.82rem;margin-top:.4rem;font-weight:600">
          ⚠ Insufficient stock across all batches: ${remaining.toFixed(3)} kg unallocated.
          Reduce the requested weight or restock before packing.
        </div>` : ''}`;
  } else {
    input.classList.remove('split-needed');
    splitDiv.style.display = 'none';
    splitDiv.innerHTML     = '';
  }

  recalcPackTotal();
}

/** Keep the main weight input in sync when staff adjusts any split-row input. */
function syncMultiSplitToMain(itemId) {
  const input     = document.getElementById(`pack-wt-${itemId}`);
  if (!input) return;
  const productId = parseInt(input.dataset.productId);
  const batches   = packState.batchData[productId] || [];
  let total       = 0;
  batches.forEach((_, i) => {
    const si = document.getElementById(`split-wt-${itemId}-${i}`);
    if (si) total += parseFloat(si.value) || 0;
  });
  input.value = total.toFixed(3);
}

function toggleOutOfStock(itemId, checked) {
  const input    = document.getElementById(`pack-wt-${itemId}`);      // catch-weight
  const fixedDiv = document.getElementById(`pack-fixed-${itemId}`);   // fixed / per-piece
  const row      = document.getElementById(`pack-row-${itemId}`);
  const splitDiv = document.getElementById(`split-batch-${itemId}`);

  if (input) {
    // Catch-weight path — zero the weight input
    if (checked) {
      input.value    = '0';
      input.disabled = true;
      row?.classList.add('oos-active');
      if (splitDiv) splitDiv.style.display = 'none';
    } else {
      input.value    = (parseFloat(input.dataset.est) || 0).toFixed(3);
      input.disabled = false;
      row?.classList.remove('oos-active');
      checkSplitBatch(itemId);
    }
  } else if (fixedDiv) {
    // Fixed-pack / per-piece path — flag the div; recalc reads this flag
    fixedDiv.dataset.oos = checked ? '1' : '0';
    row?.classList.toggle('oos-active', checked);
  }
  recalcPackTotal();
}

function recalcPackTotal() {
  let subtotal = 0;
  (packState.order?.items || []).forEach(item => {
    const isCatch  = item.pricing_model === 'catch_weight';
    const input    = isCatch
      ? document.getElementById(`pack-wt-${item.order_item_id}`)
      : null;
    const fixedDiv = !isCatch
      ? document.getElementById(`pack-fixed-${item.order_item_id}`)
      : null;
    // Skip only if the expected element for this item type is missing from the DOM
    if (isCatch && !input)   return;
    if (!isCatch && !fixedDiv) return;

    const price = parseFloat(item.price_per_kg || item.unit_price) || 0;
    const qty   = parseInt(item.quantity) || 1;
    let sub;
    if (isCatch) {
      const wt = parseFloat(input.value) || 0;
      sub = price * wt;
    } else {
      sub = (fixedDiv.dataset.oos === '1') ? 0 : price * qty;
    }
    subtotal += sub;
    const subEl = document.getElementById(`pack-sub-${item.order_item_id}`);
    if (subEl) subEl.textContent = fmtPrice(sub);
  });

  const grand = Math.max(0, subtotal - packState.discountAmt) + packState.deliveryFee;
  document.getElementById('pack-items-subtotal').textContent  = fmtPrice(subtotal);
  document.getElementById('pack-grand-total-val').textContent = fmtPrice(grand);
}

function closePackModal(event) {
  if (event.target !== event.currentTarget) return;
  const hasInput = (packState.order?.items || []).some(item => {
    const input = document.getElementById(`pack-wt-${item.order_item_id}`);
    if (!input || item.pricing_model !== 'catch_weight') return false;
    return Math.abs(parseFloat(input.value) - parseFloat(input.dataset.est)) > 0.001;
  });
  if (hasInput && !confirm('You have unsaved weight entries. Close anyway? All entries will be lost.')) return;
  closePackModalDirect();
}
function closePackModalDirect() {
  releaseFocusTrap();
  document.getElementById('pack-modal-overlay').style.display = 'none';
  packState.order     = null;
  packState.batchData = {};
}

/* ── Confirm pack: build payload and POST ───────────────── */
async function confirmPackOrder() {
  const order = packState.order;
  if (!order) return;

  const btn = document.getElementById('pack-confirm-btn');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  const items = (order.items || []).map(item => {
    const isCatch = item.pricing_model === 'catch_weight';

    if (!isCatch) {
      const fixedDiv  = document.getElementById(`pack-fixed-${item.order_item_id}`);
      const isOos     = fixedDiv?.dataset.oos === '1';
      return {
        order_item_id:   item.order_item_id,
        pricing_model:   item.pricing_model,
        is_catch_weight: false,
        is_out_of_stock: isOos,
        actual_qty:      isOos ? 0 : parseInt(item.quantity || 1),
        batch_overrides: null,
      };
    }

    const input    = document.getElementById(`pack-wt-${item.order_item_id}`);
    const oosCheck = document.getElementById(`oos-${item.order_item_id}`);
    const isOos    = oosCheck ? oosCheck.checked : false;

    const parsedConfirmWt = parseFloat(input?.value);
    const actualWt = !isNaN(parsedConfirmWt) ? parsedConfirmWt : (parseFloat(item.estimated_weight) * parseInt(item.quantity || 1));
    const batches  = packState.batchData[item.product_id] || [];
    const firstDs  = input?.dataset;

    let batch_overrides = null;
    const avail = parseFloat(firstDs?.firstBatchAvail || 0);
    const bid1  = parseInt(firstDs?.firstBatchId || batches[0]?.batch_id || 0);

    // Collect all N dynamic split inputs that were rendered by checkSplitBatch
    const splitRows = [];
    batches.forEach((b, i) => {
      const si = document.getElementById(`split-wt-${item.order_item_id}-${i}`);
      if (si) splitRows.push({ batch_id: b.batch_id, weight: parseFloat(si.value) || 0 });
    });

    if (splitRows.length > 0) {
      batch_overrides = splitRows.filter(b => b.batch_id && b.weight > 0);
    } else {
      // No split UI rendered — single-batch deduction
      batch_overrides = [{ batch_id: bid1, weight: actualWt }].filter(b => b.batch_id && b.weight > 0);
    }

    return {
      order_item_id:   item.order_item_id,
      actual_weight:   isOos ? 0 : actualWt,
      pricing_model:   item.pricing_model,
      is_catch_weight: true,
      is_out_of_stock: isOos,
      batch_overrides: isOos ? null : batch_overrides,
    };
  });

  const data = await apiPost('pack_order', { order_id: order.order_id, items });
  btn.disabled    = false;
  btn.textContent = '✓ Confirm Pack & Set Final Total';

  if (data.success) {
    toast(`✅ Order ${order.order_number} packed! Final total: ${fmtPrice(data.final_total)}`, 'success');
    if (data.batch_alerts?.length) {
      injectLowStockPanel(data.batch_alerts);
    }
    closePackModalDirect();
    loadQueue();
    loadPacked();
  } else {
    toast(data.message || 'Failed to pack order.', 'error');
  }
}

