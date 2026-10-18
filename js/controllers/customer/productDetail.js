// customer/productDetail.js — customer portal: product detail page and wholesale price helper
'use strict';

/* ════════════════════════════════════════════════════════════
   PRODUCT DETAIL  [IMPROVED — direct qty input, stock aware]
═══════════════════════════════════════════════════════════════*/

async function loadProductDetail(productId) {
  navigate('detail');
  state.detailQty = 1;
  const el = document.getElementById('detail-content');
  el.innerHTML = spinnerHTML('Loading product');

  const [detailData, stockData] = await Promise.all([
    apiFetch(`${CUSTOMER_API}?action=product&id=${productId}`),
    apiFetch(`${CUSTOMER_API}?action=product_stock&product_id=${productId}`),
  ]);

  if (!detailData.success) { el.innerHTML = '<p>Product not found.</p>'; return; }

  const p          = detailData.data;
  state.currentProduct = p;
  const stock      = stockData.success ? parseFloat(stockData.data.remaining_qty) : null;
  if (stock !== null) state.stockMap[productId] = stock;

  const icon       = productIcon(p.category_name);
  const pm         = p.pricing_model || 'catch_weight';
  const basePrice  = parseFloat(p.base_price || 0);
  const estWeight  = parseFloat(p.estimated_weight || 1);
  const isOOS      = stock !== null && stock === 0;
  const isLowStock = stock !== null && stock > 0 && stock <= LOW_STOCK_THRESHOLD;

  // Stock warning banner
  let stockNotice = '';
  if (isOOS) {
    stockNotice = `<div class="stock-notice stock-notice-oos">⛔ This item is currently out of stock.</div>`;
  } else if (isLowStock) {
    stockNotice = `<div class="stock-notice stock-notice-low">⚠️ Only ${stock % 1 === 0 ? stock : stock.toFixed(1)} units remaining — order soon!</div>`;
  }

  let priceInfoHTML = '';
  if (pm === 'catch_weight')
    priceInfoHTML = `<div style="margin-top:.5rem;font-size:.85rem;color:var(--text-muted)">
      Est. weight: ~${estWeight}kg &nbsp;|&nbsp; Est. price: ~${fmtPrice(basePrice * estWeight)}/pc</div>`;
  else if (pm === 'fixed_pack')
    priceInfoHTML = `<div style="margin-top:.5rem;font-size:.85rem;color:var(--text-muted)">
      Declared pack weight: ${(estWeight * 1000).toFixed(0)}g</div>`;
  else
    priceInfoHTML = `<div style="margin-top:.5rem;font-size:.85rem;color:var(--text-muted)">
      Avg. weight per piece: ~${(estWeight * 1000).toFixed(0)}g</div>`;

  const cwNote = pm === 'catch_weight' ? `
    <div class="catch-weight-note">
      <strong>⚖ Catch-Weight Item</strong><br/>
      Your order will be weighed by our staff before packaging.
      The final price may differ slightly from the estimate shown.
    </div>` : '';

  const reviewsHTML = !(p.reviews || []).length
    ? '<p style="color:var(--text-muted);font-size:.9rem">No reviews yet.</p>'
    : p.reviews.map(r => `
        <div class="review-card">
          <div class="review-meta">
            <div class="star-row">${starsHTML(r.rating)}</div>
            <span class="reviewer-name">${r.first_name} ${r.last_name.charAt(0)}.</span>
            <span class="review-date">${r.created_at?.split(' ')[0] || ''}</span>
          </div>
          <div class="review-text">${r.review_text || ''}</div>
        </div>`).join('');

  const tiersHTML = (p.wholesale_tiers || []).length > 0 ? `
    <div class="wholesale-tiers">
      <h4>Wholesale Pricing</h4>
      <div class="tiers-list">
        ${p.wholesale_tiers.map(t => `
          <div class="tier-row">
            <span>Buy ${t.min_qty}+ ${t.tier_unit || 'pcs'}</span>
            <strong>${fmtPrice(t.tier_unit_price || t.price_per_kg)}/${t.tier_unit || 'kg'}</strong>
          </div>`).join('')}
      </div>
    </div>` : '';

  const qtyUnit     = pm === 'per_piece' ? 'pieces' : pm === 'fixed_pack' ? 'packs' : 'pieces';
  const maxQty      = stock !== null && stock > 0 ? Math.floor(stock) : 999;

  // ── build detail gallery ──────────────────────────────────────
  const detailImgs = getProductImgs(p);
  let galleryHTML;
  if (detailImgs.length) {
    const thumbsHTML = detailImgs.map((url, i) => `
      <button class="detail-thumb ${i === 0 ? 'detail-thumb--active' : ''}"
              onclick="switchDetailImg(this,'${url.replace(/'/g,"\\'")}',${p.product_id})"
              aria-label="View photo ${i + 1}">
        <img src="${url}" alt="${escHtml(p.name)} photo ${i + 1}" loading="lazy"
             onerror="this.parentElement.style.display='none'">
      </button>`).join('');
    galleryHTML = `
      <div class="detail-gallery" id="detail-gallery-${p.product_id}">
        <div class="detail-gallery-main">
          <img id="detail-main-img-${p.product_id}"
               src="${detailImgs[0]}" alt="${escHtml(p.name)}" loading="eager"
               onerror="this.style.display='none';document.getElementById('detail-gallery-icon-${p.product_id}').style.display='flex'">
          <span class="detail-gallery-icon-fallback" id="detail-gallery-icon-${p.product_id}"
                style="display:none">${icon}</span>
        </div>
        ${detailImgs.length > 1 ? `<div class="detail-gallery-thumbs">${thumbsHTML}</div>` : ''}
      </div>`;
  } else {
    galleryHTML = `<div class="detail-image-box">${icon}</div>`;
  }

  el.innerHTML = `
    <div>${galleryHTML}</div>
    <div>
      <div class="detail-badges">
        ${p.is_featured == 1 ? '<span class="badge-featured">⭐ Featured</span>' : ''}
        ${pricingModelBadge(pm)}
      </div>
      <div class="detail-category">${p.category_name}</div>
      <h2 class="detail-title">${p.name}</h2>
      <div class="star-row" style="margin-bottom:1rem;font-size:1rem">
        ${starsHTML(p.avg_rating || 0)}
        <span style="color:var(--text-muted)">${parseFloat(p.avg_rating || 0).toFixed(1)} (${p.review_count} review${p.review_count != 1 ? 's' : ''})</span>
      </div>
      ${stockNotice}
      <div class="detail-price-box">
        <div class="price-label">Base Price</div>
        <div class="price-main">${pricingLabel(basePrice, pm)}</div>
        ${priceInfoHTML}
      </div>
      ${cwNote}
      <p class="detail-desc">${p.description || ''}</p>
      ${tiersHTML}
      <div class="qty-selector">
        <button class="qty-btn" onclick="changeDetailQty(-1)" ${isOOS ? 'disabled' : ''}>−</button>
        <!-- [NEW] Direct text input for quantity -->
        <input type="number" id="detail-qty" class="qty-input-direct" value="1" min="1"
          max="${maxQty}" ${isOOS ? 'disabled' : ''}
          onchange="onDetailQtyInput(this)"
          onkeydown="if(event.key==='Enter')this.blur()" />
        <button class="qty-btn" onclick="changeDetailQty(1)" ${isOOS ? 'disabled' : ''}>+</button>
        <span style="font-size:.85rem;color:var(--text-muted)">${qtyUnit}</span>
      </div>
      <button class="btn-primary btn-lg" ${isOOS ? 'disabled' : ''} onclick="addToCart(${p.product_id}, state.detailQty)">
        ${isOOS ? '⛔ Out of Stock' : '🛒 Add to Cart'}
      </button>
      <div class="reviews-section">
        <h3>Customer Reviews</h3>
        ${reviewsHTML}
      </div>
    </div>`;
}

function changeDetailQty(delta) {
  const p       = state.currentProduct;
  const stock   = p ? (state.stockMap[p.product_id] ?? 999) : 999;
  const max     = stock > 0 ? Math.floor(stock) : 999;
  state.detailQty = Math.max(1, Math.min(max, state.detailQty + delta));
  const inp = document.getElementById('detail-qty');
  if (inp) inp.value = state.detailQty;
}

function onDetailQtyInput(inputEl) {
  const p     = state.currentProduct;
  const stock = p ? (state.stockMap[p.product_id] ?? 999) : 999;
  const max   = stock > 0 ? Math.floor(stock) : 999;
  let val     = parseInt(inputEl.value, 10);
  if (isNaN(val) || val < 1) val = 1;
  if (val > max) { val = max; toast(`Max ${max} units available.`, 'error'); }
  state.detailQty = val;
  inputEl.value   = val;
}

/**
 * Swap the main gallery image when a thumbnail is clicked.
 * @param {HTMLElement} thumbBtn  - the clicked thumb <button>
 * @param {string}      url       - new main image URL
 * @param {number}      productId
 */
function switchDetailImg(thumbBtn, url, productId) {
  const mainImg = document.getElementById(`detail-main-img-${productId}`);
  if (mainImg) { mainImg.src = url; mainImg.style.display = ''; }
  const iconFb  = document.getElementById(`detail-gallery-icon-${productId}`);
  if (iconFb) iconFb.style.display = 'none';
  document.querySelectorAll(`#detail-gallery-${productId} .detail-thumb`)
    .forEach(b => b.classList.remove('detail-thumb--active'));
  thumbBtn.classList.add('detail-thumb--active');
}

/* ════════════════════════════════════════════════════════════
   WHOLESALE PRICING HELPER
═══════════════════════════════════════════════════════════════*/

/**
 * Evaluate an item's wholesale_tiers against its current quantity and return
 * the correct unit price (tier_unit_price or price_per_kg).
 * Falls back to base_price when no tier applies.
 */
function resolveWholesalePrice(item) {
  const tiers = item.wholesale_tiers;
  if (!tiers || !tiers.length) return parseFloat(item.base_price || 0);
  const qty    = parseFloat(item.quantity || 1);
  const sorted = [...tiers].sort((a, b) => parseFloat(b.min_qty) - parseFloat(a.min_qty));
  const match  = sorted.find(t => qty >= parseFloat(t.min_qty));
  if (match) return parseFloat(match.tier_unit_price || match.price_per_kg || item.base_price || 0);
  return parseFloat(item.base_price || 0);
}

