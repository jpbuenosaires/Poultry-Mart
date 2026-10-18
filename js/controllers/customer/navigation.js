// customer/navigation.js — customer portal: pricing display helpers and page navigation
'use strict';

/* ════════════════════════════════════════════════════════════
   PRICING MODEL DISPLAY HELPERS  (unchanged from original)
═══════════════════════════════════════════════════════════════*/

function pricingLabel(basePrice, pricingModel) {
  const p = fmtPrice(basePrice);
  if (pricingModel === 'catch_weight') return `${p}<small class="price-unit">/kg</small>`;
  if (pricingModel === 'fixed_pack')   return `${p}<small class="price-unit">/pack</small>`;
  if (pricingModel === 'per_piece')    return `${p}<small class="price-unit">/pc</small>`;
  return p;
}

function pricingModelBadge(pricingModel) {
  if (pricingModel === 'catch_weight') return '<span class="badge-catch">⚖ Catch-Weight</span>';
  if (pricingModel === 'fixed_pack')   return '<span class="badge-pack">📦 Fixed Pack</span>';
  if (pricingModel === 'per_piece')    return '<span class="badge-piece">🔢 Per Piece</span>';
  return '';
}

function lineSubLabel(item) {
  const bp = parseFloat(item.base_price || item.unit_price || 0);
  const ew = parseFloat(item.estimated_weight || 0);
  const pm = item.pricing_model || 'catch_weight';
  if (pm === 'catch_weight') return `${fmtPrice(bp)}/kg · Est. ${ew.toFixed(3)}kg ea.`;
  if (pm === 'fixed_pack')   return `${fmtPrice(bp)}/pack`;
  return `${fmtPrice(bp)}/piece`;
}

/* ════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════*/

function navigate(page, param) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');

  if (page !== state.pageHistory[state.pageHistory.length - 1]) {
    state.pageHistory.push(page);
  }
  window.scrollTo(0, 0);

  if (page === 'home')     loadHome();
  if (page === 'catalog')  loadCatalog(param);
  if (page === 'cart')     renderCart();
  if (page === 'checkout') loadCheckout();
  if (page === 'orders')   loadOrders();
  if (page === 'profile')  loadProfile();
}

function navigateBack() {
  state.pageHistory.pop();
  navigate(state.pageHistory[state.pageHistory.length - 1] || 'home');
}

