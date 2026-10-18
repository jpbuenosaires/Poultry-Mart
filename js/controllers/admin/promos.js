// admin/promos.js — admin portal: promo codes page
'use strict';

/* ════════════════════════════════════════════════════════════
   PROMOS
═══════════════════════════════════════════════════════════════*/

async function loadPromos() {
  setLoading('promos-table-wrap', 'Loading promos…');
  const res = await apiGet('promos');
  if (!res.success) { document.getElementById('promos-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderPromosTable(res.data || []);
}

function renderPromosTable(promos) {
  const wrap = document.getElementById('promos-table-wrap');
  if (!promos.length) { wrap.innerHTML = emptyStateHTML('🏷', 'No Promos', 'No promo codes yet.'); return; }
  const rows = promos.map(p => `<tr>
    <td><strong>${escHtml(p.code)}</strong></td>
    <td>${escHtml(p.discount_type === 'percentage' ? p.discount_value + '%' : fmtPrice(p.discount_value))}</td>
    <td>${fmtPrice(p.min_order_value || 0)}</td>
    <td>${p.valid_from ? fmtDate(p.valid_from) : '—'} → ${p.valid_to ? fmtDate(p.valid_to) : '—'}</td>
    <td>${escHtml(p.times_used ?? 0)} / ${p.usage_limit ?? '∞'}</td>
    <td><span class="status-badge ${p.is_active ? 'status-Completed' : 'status-Cancelled'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
    <td>
      <button class="btn-action" onclick='openPromoModal(${JSON.stringify(p)})'>✏️</button>
      <button class="btn-action btn-action-${p.is_active ? 'red' : 'green'}" onclick="togglePromo(${p.promo_id}, ${p.is_active}, this)">${p.is_active ? 'Disable' : 'Enable'}</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Code</th><th>Discount</th><th>Min Order</th><th>Valid</th><th>Usage</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

let _promoId = 0;

function openPromoModal(promoObj = null) {
  _promoId = promoObj?.promo_id ?? 0;
  document.getElementById('promo-modal-title').textContent = _promoId ? 'Edit Promo' : 'Add Promo';
  document.getElementById('prom-code').value = promoObj?.code || '';
  document.getElementById('prom-type').value = promoObj?.discount_type || 'flat';
  document.getElementById('prom-value').value = promoObj?.discount_value || '';
  document.getElementById('prom-min').value = promoObj?.min_order_value || 0;
  document.getElementById('prom-from').value = promoObj?.valid_from?.slice(0, 10) || '';
  document.getElementById('prom-to').value = promoObj?.valid_to?.slice(0, 10) || '';
  document.getElementById('prom-limit').value = promoObj?.usage_limit ?? '';
  document.getElementById('prom-active').checked = promoObj?.is_active ?? true;
  document.getElementById('promo-form-error').style.display = 'none';
  updatePromoTypeLabel();
  openModal('promo-modal', 'promo-modal-close');
}

function updatePromoTypeLabel() {
  const type = document.getElementById('prom-type')?.value;
  const lbl = document.getElementById('prom-value-label');
  if (lbl) lbl.textContent = type === 'percentage' ? 'Discount %' : 'Discount Amount (₱)';
}

async function confirmSavePromo() {
  const errEl = document.getElementById('promo-form-error');
  errEl.style.display = 'none';
  const body = {
    promo_id: _promoId,
    code: document.getElementById('prom-code').value.trim().toUpperCase(),
    discount_type: document.getElementById('prom-type').value,
    discount_value: document.getElementById('prom-value').value,
    min_order_value: document.getElementById('prom-min').value || 0,
    valid_from: document.getElementById('prom-from').value || null,
    valid_to: document.getElementById('prom-to').value || null,
    usage_limit: document.getElementById('prom-limit').value || null,
    is_active: document.getElementById('prom-active').checked ? 1 : 0,
  };
  if (!body.code || !body.discount_value) {
    errEl.textContent = 'Code and discount value are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('save_promo', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast(_promoId ? 'Promo updated.' : 'Promo created.', 'success');
  closeModal('promo-modal');
  loadPromos();
}

async function togglePromo(id, currentActive, btn) {
  const newActive = currentActive ? 0 : 1;
  const res = await apiPost('save_promo', { promo_id: id, is_active: newActive, _toggle_only: 1 });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast(newActive ? 'Promo enabled.' : 'Promo disabled.', 'success');
  loadPromos();
}

