// admin/inventory.js — admin portal: inventory and stock batches
'use strict';

/* ════════════════════════════════════════════════════════════
   INVENTORY
═══════════════════════════════════════════════════════════════*/

async function loadInventory() {
  setLoading('inventory-table-wrap', 'Loading inventory…');
  await refreshCategories();
  const res = await apiGet('inventory');
  if (!res.success) { document.getElementById('inventory-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderInventoryTable(res.data || []);
}

function renderInventoryTable(batches) {
  const wrap = document.getElementById('inventory-table-wrap');
  if (!batches.length) { wrap.innerHTML = emptyStateHTML('📦', 'No Batches', 'No stock batches found.'); return; }
  const rows = batches.map(b => {
    const remaining = parseFloat(b.remaining_qty || 0);
    const original = parseFloat(b.quantity || 0);
    const pct = original > 0 ? Math.round((remaining / original) * 100) : 0;
    const rowClass = remaining === 0 ? 'row-oos' : pct <= 20 ? 'row-low-stock' : '';
    const barClass = pct <= 20 ? 'stock-bar--low' : 'stock-bar--ok';
    return `<tr class="${rowClass}">
      <td>${escHtml(b.product_name)}</td>
      <td>${escHtml(b.category_name)}</td>
      <td>${fmtDate(b.batch_date)}</td>
      <td>${parseFloat(b.quantity).toFixed(3)} ${escHtml(b.batch_unit)}</td>
      <td>
        <div class="stock-bar-wrap"><div class="stock-bar ${barClass}" style="width:${pct}%"></div></div>
        ${remaining.toFixed(3)} ${escHtml(b.batch_unit)} (${pct}%)
      </td>
      <td>${fmtDateTime(b.created_at)}</td>
      <td>
        <button class="btn-action" onclick="openAdjustModal(${b.batch_id}, '${escHtml(b.product_name)}', ${remaining})">➖ Adjust</button>
      </td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Product</th><th>Category</th><th>Batch Date</th><th>Original Qty</th><th>Remaining</th><th>Added</th><th>Action</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

/* ── Add Batch ──────────────────────────────────────────────*/

async function openAddBatchModal() {
  await refreshCategories();
  const prodRes = await apiGet('products', { status: 'active' });
  const opts = (prodRes.data || []).map(p =>
    `<option value="${p.product_id}">${escHtml(p.name)}</option>`).join('');
  document.getElementById('batch-product-select').innerHTML = `<option value="">— Select Product —</option>${opts}`;
  document.getElementById('batch-date-input').value = new Date().toISOString().slice(0, 10);
  document.getElementById('batch-qty-input').value = '';
  document.getElementById('batch-add-error').style.display = 'none';
  openModal('add-batch-modal', 'batch-add-modal-close');
}

async function confirmAddBatch() {
  const errEl = document.getElementById('batch-add-error');
  errEl.style.display = 'none';
  const body = {
    product_id: document.getElementById('batch-product-select').value,
    batch_date: document.getElementById('batch-date-input').value,
    quantity: document.getElementById('batch-qty-input').value,
  };
  if (!body.product_id || !body.batch_date || !body.quantity) {
    errEl.textContent = 'All fields are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('add_batch', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Batch added to inventory.', 'success');
  closeModal('add-batch-modal');
  loadInventory();
}

/* ── Adjust Stock ───────────────────────────────────────────*/

let _adjustBatchId = 0;

function openAdjustModal(batchId, productName, currentQty) {
  _adjustBatchId = batchId;
  document.getElementById('adjust-stock-title').textContent = `Adjust: ${productName}`;
  document.getElementById('adjust-stock-current').value = currentQty;
  document.getElementById('adjust-stock-new').value = '';
  document.getElementById('adjust-notes').value = '';
  document.getElementById('adjust-stock-error').style.display = 'none';
  openModal('adjust-stock-modal', 'adjust-modal-close');
}

async function confirmAdjust() {
  const errEl = document.getElementById('adjust-stock-error');
  errEl.style.display = 'none';
  const body = {
    batch_id: _adjustBatchId,
    new_qty: document.getElementById('adjust-stock-new').value,
    reason_code: document.getElementById('adjust-reason').value,
    notes: document.getElementById('adjust-notes').value.trim(),
  };
  if (body.new_qty === '') { errEl.textContent = 'New quantity is required.'; errEl.style.display = ''; return; }
  const res = await apiPost('adjust_stock', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast(`Stock adjusted. Variance: ${res.data?.variance}`, 'success');
  closeModal('adjust-stock-modal');
  loadInventory();
}

