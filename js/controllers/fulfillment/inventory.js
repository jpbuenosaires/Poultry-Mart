// fulfillment/inventory.js — fulfillment portal: inventory page and adjust stock modal
'use strict';

/* ════════════════════════════════════════════════════════════
   PAGE: INVENTORY
═══════════════════════════════════════════════════════════════*/

async function loadInventory() {
  const tbody  = document.getElementById('inventory-tbody');
  const alerts = document.getElementById('inventory-alerts');
  tbody.innerHTML  = '<tr><td colspan="8" class="table-loading">Loading…</td></tr>';
  alerts.innerHTML = '';

  const data = await apiGet('inventory');
  if (!data.success) {
    tbody.innerHTML =
      `<tr><td colspan="8" class="table-loading" style="color:var(--error)">${escHtml(data.message)}</td></tr>`;
    return;
  }
  session.inventory = data.data || [];

  // Build per-product totals for low-stock alerts
  const productMap = {};
  session.inventory.forEach(b => {
    if (!productMap[b.product_id])
      productMap[b.product_id] = { name: b.product_name, total: 0 };
    productMap[b.product_id].total += parseFloat(b.remaining_qty);
  });

  const lowItems = Object.values(productMap).filter(p => p.total < LOW_STOCK_THRESHOLD);
  if (lowItems.length) {
    alerts.innerHTML = lowItems.map(p => `
      <div class="inventory-alert-banner" role="alert">
        <span class="alert-icon">⚠️</span>
        <div class="alert-text">
          <strong>${escHtml(p.name)}</strong>
          <span> — only <strong>${p.total.toFixed(3)} kg</strong> remaining. Restock soon.</span>
        </div>
      </div>`).join('');
  }

  if (!session.inventory.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-loading">No batches found.</td></tr>';
    return;
  }

  tbody.innerHTML = session.inventory.map(b => {
    const remaining = parseFloat(b.remaining_qty);
    const quantity  = parseFloat(b.quantity);
    const pct       = quantity > 0 ? Math.min(100, (remaining / quantity) * 100) : 0;
    const level     = remaining < LOW_STOCK_THRESHOLD ? 'critical' : remaining < 15 ? 'low' : 'ok';
    return `
      <tr>
        <td><strong>${escHtml(b.product_name)}</strong></td>
        <td><span style="font-size:.8rem;color:var(--text-muted)">${escHtml(b.category_name)}</span></td>
        <td><span class="batch-id-tag">#${b.batch_id}</span></td>
        <td>${fmtDate(b.batch_date)}</td>
        <td>${quantity.toFixed(3)} kg</td>
        <td>${remaining.toFixed(3)} kg</td>
        <td>
          <div class="stock-bar-wrap stock-${level}">
            <div class="stock-bar" role="progressbar"
              aria-valuenow="${pct.toFixed(0)}" aria-valuemin="0" aria-valuemax="100">
              <div class="stock-bar-fill" style="width:${pct}%"></div>
            </div>
            <span class="stock-val">${remaining.toFixed(1)} kg</span>
          </div>
        </td>
        <td>
          <button class="btn-action btn-action-muted"
            onclick="openAdjustStockModal(${b.batch_id}, '${escHtml(b.product_name)}', ${remaining})"
            aria-label="Adjust stock for batch ${b.batch_id}">➖ Adjust</button>
        </td>
      </tr>`;
  }).join('');
}

/* ── Adjust Stock Modal ─────────────────────────────────── */
function openAdjustStockModal(batchId, productName, currentQty) {
  adjustState.batchId = batchId;
  document.getElementById('adjust-stock-info').textContent    = `Batch #${batchId} — ${productName}`;
  document.getElementById('adjust-stock-current').value       = currentQty.toFixed(3) + ' kg';
  document.getElementById('adjust-stock-new').value           = '';
  document.getElementById('adjust-notes').value               = '';
  document.getElementById('adjust-stock-error').style.display = 'none';
  const overlay = document.getElementById('adjust-stock-modal-overlay');
  overlay.style.display = 'flex';
  trapFocus(overlay.querySelector('.modal-box') || overlay);
}
function closeAdjustStockModal(event) {
  if (event && event.target !== event.currentTarget) return;
  releaseFocusTrap();
  document.getElementById('adjust-stock-modal-overlay').style.display = 'none';
}

async function confirmAdjustStock() {
  const newQty  = parseFloat(document.getElementById('adjust-stock-new').value);
  const reason  = document.getElementById('adjust-reason').value;
  const notes   = document.getElementById('adjust-notes').value;
  const errEl   = document.getElementById('adjust-stock-error');

  if (isNaN(newQty) || newQty < 0) {
    errEl.textContent   = 'Please enter a valid quantity (0 or more).';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  // ── Pre-flight: verify the batch has no active order allocations that
  //   would be broken by reducing stock below the allocated amount. ────
  const allocData = await apiGet('batch_allocations', { batch_id: adjustState.batchId });
  if (allocData.success && parseFloat(allocData.allocated_qty || 0) > 0) {
    const allocQty = parseFloat(allocData.allocated_qty);
    if (newQty < allocQty) {
      const conflictList = (allocData.conflicting_orders || [])
        .map(o => `#${o.order_number}`)
        .join(', ');
      errEl.innerHTML = `
        <strong>⚠ Adjustment Blocked — Active Allocation Conflict</strong><br/>
        This batch has <strong>${allocQty.toFixed(3)} kg</strong> allocated
        to orders currently in <em>Packed</em> or <em>Out for Delivery</em> status:
        <strong>${escHtml(conflictList || 'see order list')}</strong>.<br/>
        <span style="font-size:.85rem">
          The new physical quantity (<strong>${newQty.toFixed(3)} kg</strong>) is below
          the allocated amount. Fulfil or cancel the conflicting orders before
          reducing this batch.
        </span>`;
      errEl.style.display = 'block';
      return;
    }
  }

  const data = await apiPost('adjust_stock', {
    batch_id:            adjustState.batchId,
    actual_physical_qty: newQty,
    reason_code:         reason,
    notes,
  });

  if (data.success) {
    const dir    = data.variance >= 0 ? '▲' : '▼';
    const varAbs = Math.abs(data.variance).toFixed(3);
    toast(`Stock adjusted. ${dir} ${varAbs} kg variance logged.`, 'success');
    closeAdjustStockModal();
    loadInventory();
  } else {
    errEl.textContent   = data.message || 'Failed.';
    errEl.style.display = 'block';
  }
}

