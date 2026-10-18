// admin/products.js — admin portal: products page and product/tier modals
'use strict';

/* ════════════════════════════════════════════════════════════
   PRODUCTS
═══════════════════════════════════════════════════════════════*/

async function loadProducts() {
  setLoading('products-table-wrap', 'Loading products…');
  await refreshCategories();
  // Populate category filter dropdown (no-op if already populated)
  const catFilter = document.getElementById('product-cat-filter');
  if (catFilter && catFilter.options.length <= 1) {
    session.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.category_id;
      opt.textContent = c.name;
      catFilter.appendChild(opt);
    });
  }
  const search = document.getElementById('product-search')?.value.trim() || '';
  const categoryId = document.getElementById('product-cat-filter')?.value || '';
  const status = document.getElementById('product-status-filter')?.value || '';
  const res = await apiGet('products', { search, category_id: categoryId, status });
  if (!res.success) { document.getElementById('products-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderProductsTable(res.data || []);
}

function renderProductsTable(products) {
  const wrap = document.getElementById('products-table-wrap');
  if (!products.length) { wrap.innerHTML = emptyStateHTML('🐓', 'No Products', 'No products found.'); return; }
  const rows = products.map(p => `<tr class="${p.status === 'archived' ? 'row-archived' : ''}">
    <td>${productIcon(p.category_name)} ${escHtml(p.name)}</td>
    <td>${escHtml(p.category_name)}</td>
    <td>${fmtPrice(p.base_price)}</td>
    <td><span class="badge badge-model">${escHtml(pricingModelLabel(p.pricing_model))}</span></td>
    <td>${parseFloat(p.stock_qty || 0).toFixed(3)} ${escHtml(p.unit_of_measure || '')}</td>
    <td><span class="status-badge ${p.status === 'active' ? 'status-Completed' : 'status-Cancelled'}">${escHtml(p.status)}</span></td>
    <td>
      <button class="btn-action" onclick="openProductModal(${p.product_id})" title="Edit">✏️</button>
      <button class="btn-action btn-action-${p.is_featured ? 'warn' : 'muted'}" onclick="toggleFeatured(${p.product_id}, this)" title="${p.is_featured ? 'Unfeature' : 'Feature'}">⭐</button>
      <button class="btn-action btn-action-blue" onclick="openTiersModal(${p.product_id})" title="Wholesale Tiers">💲</button>
      <button class="btn-action btn-action-${p.status === 'active' ? 'red' : 'green'}" onclick="archiveProduct(${p.product_id}, '${escHtml(p.status)}')" title="${p.status === 'active' ? 'Archive' : 'Unarchive'}">${p.status === 'active' ? '🗃' : '♻️'}</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Model</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

/* ── Product Modal ──────────────────────────────────────────*/

let _productId = 0;

async function openProductModal(id = 0) {
  _productId = id;
  await refreshCategories();
  const catOpts = session.categories.map(c =>
    `<option value="${c.category_id}">${escHtml(c.name)}</option>`).join('');

  document.getElementById('product-modal-title').textContent = id ? 'Edit Product' : 'Add Product';
  document.getElementById('product-form-body').innerHTML = `
    <div class="form-group"><label>Name *</label><input type="text" id="pf-name" class="form-input" /></div>
    <div class="form-group form-group--spaced"><label>Category *</label><select id="pf-cat" class="form-input"><option value="">— Select —</option>${catOpts}</select></div>
    <div class="form-group form-group--spaced"><label>Base Price (₱) *</label><input type="number" id="pf-price" class="form-input" min="0" step="0.01" /></div>
    <div class="form-group form-group--spaced"><label>Pricing Model *</label>
      <select id="pf-model" class="form-input"><option value="catch_weight">Catch-weight (per kg)</option><option value="fixed_pack">Fixed Pack</option><option value="per_piece">Per Piece</option></select></div>
    <div class="form-group form-group--spaced" id="pf-weight-group"><label>Estimated Weight (kg)</label><input type="number" id="pf-weight" class="form-input" min="0" step="0.001" value="0" /></div>
    <div class="form-group form-group--spaced"><label>Description</label><textarea id="pf-desc" class="form-input" rows="3"></textarea></div>
    <div class="form-group form-group--spaced form-row">
      <label><input type="checkbox" id="pf-featured" /> Featured</label>
      <label for="pf-status">Status</label>
      <select id="pf-status" class="form-input"><option value="active">Active</option><option value="archived">Archived</option></select>
    </div>
    <p id="product-form-error" class="form-error" style="display:none"></p>`;

  document.getElementById('pf-model').addEventListener('change', () => {
    const isCW = document.getElementById('pf-model').value === 'catch_weight';
    document.getElementById('pf-weight-group').style.display = isCW ? '' : 'none';
  });

  if (id > 0) {
    const res = await apiGet('product', { id });
    if (res.success) {
      const p = res.data;
      document.getElementById('pf-name').value = p.name || '';
      document.getElementById('pf-cat').value = p.category_id || '';
      document.getElementById('pf-price').value = p.base_price || '';
      document.getElementById('pf-model').value = p.pricing_model || 'catch_weight';
      document.getElementById('pf-weight').value = p.estimated_weight || 0;
      document.getElementById('pf-desc').value = p.description || '';
      document.getElementById('pf-featured').checked = !!p.is_featured;
      document.getElementById('pf-status').value = p.status || 'active';
      const isCW = p.pricing_model === 'catch_weight';
      document.getElementById('pf-weight-group').style.display = isCW ? '' : 'none';
    }
  }
  openModal('product-modal', 'product-modal-close');
}

async function confirmSaveProduct() {
  const errEl = document.getElementById('product-form-error');
  errEl.style.display = 'none';
  const body = {
    product_id: _productId,
    name: document.getElementById('pf-name').value.trim(),
    category_id: document.getElementById('pf-cat').value,
    base_price: document.getElementById('pf-price').value,
    pricing_model: document.getElementById('pf-model').value,
    estimated_weight: document.getElementById('pf-weight').value || 0,
    description: document.getElementById('pf-desc').value.trim(),
    is_featured: document.getElementById('pf-featured').checked ? 1 : 0,
    status: document.getElementById('pf-status').value,
  };
  if (!body.name || !body.category_id || !body.base_price) {
    errEl.textContent = 'Name, category, and price are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('save_product', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast(_productId ? 'Product updated.' : 'Product added.', 'success');
  closeModal('product-modal');
  loadProducts();
}

async function toggleFeatured(id, btn) {
  const res = await apiPost('toggle_featured', { product_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  const isFeatured = res.is_featured;
  btn.className = `btn-action btn-action-${isFeatured ? 'warn' : 'muted'}`;
  btn.title = isFeatured ? 'Unfeature' : 'Feature';
  toast(isFeatured ? 'Marked as featured.' : 'Removed from featured.', 'success');
}

async function archiveProduct(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'archived' : 'active';
  if (!confirm(`${newStatus === 'archived' ? 'Archive' : 'Restore'} this product?`)) return;
  const res = await apiPost('archive_product', { product_id: id, status: newStatus });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Product status updated.', 'success');
  loadProducts();
}

/* ── Wholesale Tiers Modal ──────────────────────────────────*/

let _tiersProductId = 0;

async function openTiersModal(productId) {
  _tiersProductId = productId;
  document.getElementById('tiers-list').innerHTML = spinnerHTML();
  openModal('tiers-modal', 'tiers-modal-close');
  await loadTiersList();
}

async function loadTiersList() {
  const res = await apiGet('wholesale_tiers', { product_id: _tiersProductId });
  if (!res.success) { document.getElementById('tiers-list').innerHTML = errorHTML(res.message); return; }
  const tiers = res.data || [];
  if (!tiers.length) {
    document.getElementById('tiers-list').innerHTML = '<p class="text-muted">No tiers yet.</p>';
    return;
  }
  const rows = tiers.map(t => `<tr>
    <td>${escHtml(t.min_qty)} ${escHtml(t.tier_unit)}</td>
    <td>${fmtPrice(t.tier_unit_price)}</td>
    <td><button class="btn-action btn-action-red" onclick="deleteTier(${t.tier_id})">✕</button></td>
  </tr>`).join('');
  document.getElementById('tiers-list').innerHTML = `<table class="data-table"><thead><tr><th>Min Qty</th><th>Unit Price</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function saveTier() {
  const errEl = document.getElementById('tier-form-error');
  errEl.style.display = 'none';
  const body = {
    product_id: _tiersProductId,
    min_qty: document.getElementById('tier-min-qty').value,
    tier_unit: document.getElementById('tier-unit').value,
    tier_unit_price: document.getElementById('tier-price').value,
  };
  if (!body.min_qty || !body.tier_unit_price) {
    errEl.textContent = 'Min qty and price are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('save_tier', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Tier saved.', 'success');
  document.getElementById('tier-min-qty').value = '';
  document.getElementById('tier-price').value = '';
  await loadTiersList();
}

async function deleteTier(tierId) {
  if (!confirm('Delete this wholesale tier?')) return;
  const res = await apiPost('delete_tier', { tier_id: tierId, product_id: _tiersProductId });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Tier deleted.', 'success');
  await loadTiersList();
}

