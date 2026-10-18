// customer/catalog.js — customer portal: home page, product cards, catalog listing, search and filters
'use strict';

/* ════════════════════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════════════════════*/

async function loadHome() {
  await Promise.all([loadFeaturedProducts(), loadCategoriesGrid(), loadStoreFooterHours()]);
}

async function loadFeaturedProducts() {
  const el = document.getElementById('home-featured');
  el.innerHTML = spinnerHTML('Loading products');
  // Use a dedicated home-only fetch so state.products is not pre-populated
  // with unpaginated data that would confuse the catalog's pagination state.
  const data = await apiFetch(`${CUSTOMER_API}?action=products_with_stock&sort=featured&page=1&page_size=24`);
  const allProducts = data.success ? (data.data || []) : [];
  const featured = allProducts.filter(p => p.is_featured == 1).slice(0, 4);
  el.innerHTML = featured.length
    ? featured.map(renderProductCard).join('')
    : '<p style="color:var(--text-muted)">No featured products available.</p>';
}

async function loadCategoriesGrid() {
  const el = document.getElementById('home-categories-grid');
  if (!el) return;
  if (!state.categories.length) {
    const data = await apiFetch(apiUrl('categories'));
    if (data.success) state.categories = data.data;
  }
  el.innerHTML = state.categories.map(c => `
    <div class="category-card" onclick="navigate('catalog','${c.name.replace(/'/g, "\\'")}')">
      <span class="cat-icon">${CAT_ICONS[c.name] || '🐓'}</span>
      <span class="cat-name">${c.name}</span>
      <span class="cat-count">${c.product_count} items</span>
    </div>`).join('');
}

/* ════════════════════════════════════════════════════════════
   PRODUCT CARD  [IMPROVED — stock badge, wholesale badge]
═══════════════════════════════════════════════════════════════*/

function renderProductCard(p) {
  const icon      = productIcon(p.category_name);
  const pm        = p.pricing_model || 'catch_weight';
  const basePrice = parseFloat(p.base_price || 0);
  const estWeight = parseFloat(p.estimated_weight || 1);
  const stock     = parseFloat(p.remaining_qty ?? state.stockMap[p.product_id] ?? 999);

  let estLine = '';
  if (pm === 'catch_weight')
    estLine = `<div class="product-card-meta">Est. ~${fmtPrice(basePrice * estWeight)} per piece</div>`;
  else if (pm === 'fixed_pack')
    estLine = `<div class="product-card-meta">Declared weight: ${estWeight * 1000}g per pack</div>`;
  else
    estLine = `<div class="product-card-meta">Sold individually</div>`;

  // [NEW] Stock badge logic
  let stockBadge = '';
  if (stock === 0) {
    stockBadge = '<span class="badge-out-of-stock">Out of Stock</span>';
  } else if (stock <= LOW_STOCK_THRESHOLD) {
    stockBadge = `<span class="badge-low-stock">⚠ Only ${stock % 1 === 0 ? stock : stock.toFixed(1)} left</span>`;
  }

  // [NEW] Wholesale teaser badge
  const tierCount = parseInt(p.wholesale_tier_count || 0);
  const wholesaleBadge = tierCount > 0
    ? `<span class="badge-wholesale">🏷 Bulk Discounts</span>`
    : '';

  const isOutOfStock = stock === 0;

  const imgs      = getProductImgs(p);
  const mainImg   = imgs[0] || '';
  const imgHTML   = mainImg
    ? `<img src="${mainImg}" alt="${escHtml(p.name)}" class="product-card-photo" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const fbIcon    = `<span class="product-card-icon-fallback" ${mainImg ? 'style="display:none"' : ''}>${icon}</span>`;

  return `
    <div class="product-card ${isOutOfStock ? 'product-card-oos' : ''}" onclick="loadProductDetail(${p.product_id})">
      <div class="product-card-img">
        ${imgHTML}${fbIcon}
        <div class="product-card-badges product-card-badges--overlay">
          ${p.is_featured == 1 ? '<span class="badge-featured">⭐ Featured</span>' : ''}
          ${pricingModelBadge(pm)}
          ${stockBadge}
          ${wholesaleBadge}
        </div>
      </div>
      <div class="product-card-body">
        <div class="product-card-cat">${p.category_name}</div>
        <div class="product-card-title">${p.name}</div>
        <div class="star-row">
          ${starsHTML(p.avg_rating || 0)}
          <span class="star-count">(${p.review_count || 0})</span>
        </div>
        <div class="product-card-price">${pricingLabel(basePrice, pm)}</div>
        ${estLine}
      </div>
      <div class="product-card-footer">
        <button class="btn-primary" ${isOutOfStock ? 'disabled' : ''}
          onclick="event.stopPropagation();${isOutOfStock ? '' : `addToCart(${p.product_id})`}">
          ${isOutOfStock ? 'Out of Stock' : '+ Add to Cart'}
        </button>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════════════════════
   CATALOG PAGE
═══════════════════════════════════════════════════════════════*/

// Catalog pagination state
const CATALOG_PAGE_SIZE = 24;
let _catalogPage    = 1;
let _catalogHasMore = false;
let _catalogLoading = false;

async function loadCatalog(categoryFilter) {
  // Reset pagination state
  _catalogPage    = 1;
  _catalogHasMore = false;
  _catalogLoading = false;
  state.products  = [];
  
  // Show loading immediately to prevent empty state flicker
  const grid = document.getElementById('catalog-grid');
  const emptyEl = document.getElementById('catalog-empty');
  if (grid) grid.innerHTML = spinnerHTML('Loading products');
  if (emptyEl) emptyEl.style.display = 'none';// Clear previous products to force fresh load
  

  const cd = await apiFetch(apiUrl('categories'));
  if (cd.success) state.categories = cd.data;
  buildCategoryFilter(categoryFilter);

  if (categoryFilter) {
    const radio = document.querySelector(`input[name="cat-filter"][value="${categoryFilter}"]`);
    if (radio) radio.checked = true;
  }

  await _fetchCatalogPage(1);
  if (state.user) {
    const stockData = await apiFetch(`${CUSTOMER_API}?action=cart_stock&user_id=${state.user.user_id}`);
    if (stockData.success) Object.assign(state.stockMap, stockData.data || {});
  }
  filterProducts();
}

/** Fetch one page of products and append to state.products. */
async function _fetchCatalogPage(page) {
  if (_catalogLoading) return;
  _catalogLoading = true;
  const sort   = document.getElementById('catalog-sort')?.value || 'featured';
  const search = document.getElementById('catalog-search')?.value?.trim() || '';
  const catId  = state.categories.find(c =>
    c.name === document.querySelector('input[name="cat-filter"]:checked')?.value
  )?.category_id || '';

  const url  = `${CUSTOMER_API}?action=products_with_stock&sort=${encodeURIComponent(sort)}`
             + `&page=${page}&page_size=${CATALOG_PAGE_SIZE}`
             + (catId  ? `&category_id=${catId}`          : '')
             + (search ? `&search=${encodeURIComponent(search)}` : '');
const data = await apiFetch(url);

  if (data.success) {
    // Ensure data.data is always an array to prevent errors
    const products = Array.isArray(data.data) ? data.data : [];
    state.products  = page === 1 ? products : [...state.products, ...products];
    _catalogHasMore = data.has_more ?? false;
    _catalogPage    = page;
    
    // Debug: log if we got zero products unexpectedly
    if (page === 1 && products.length === 0) {
      console.warn('[Catalog] API returned zero products. Check filters or stock levels.');
    }
  } else {
    // Show error for any failed page
    const grid = document.getElementById('catalog-grid');
    if (page === 1 && grid) {
      grid.innerHTML = `<div class="table-empty" role="alert" style="padding:2rem">
        <span style="font-size:2rem">⚠️</span>
        <p>${escHtml(data.message || 'Failed to load products. Please try again.')}</p>
        <button class="btn-outline" style="margin-top:1rem" onclick="loadCatalog()">Retry</button>
      </div>`;
    } else if (page > 1) {
      console.error('[Catalog] Pagination failed:', data.message);
      toast('Failed to load more products.', 'error');
    }
  }
  _catalogLoading = false;
  _renderLoadMoreBtn();
}

function _renderLoadMoreBtn() {
  const existing = document.getElementById('catalog-load-more');
  if (existing) existing.remove();
  if (!_catalogHasMore) return;
  const btn = document.createElement('div');
  btn.id = 'catalog-load-more';
  btn.style.cssText = 'text-align:center;padding:1.5rem 0';
  btn.innerHTML = `<button class="btn-outline" onclick="loadMoreCatalog()">Load More Products</button>`;
  document.getElementById('catalog-grid')?.after(btn);
}

async function loadMoreCatalog() {
  await _fetchCatalogPage(_catalogPage + 1);
  filterProducts(); // re-render with the expanded list
}

function buildCategoryFilter(selected) {
  const list = document.getElementById('cat-filter-list');
  list.innerHTML = `
    <label class="filter-label">
      <input type="radio" name="cat-filter" value="" ${!selected ? 'checked' : ''} onchange="debouncedFilterProducts()" /> All
    </label>` +
    state.categories.map(c => `
      <label class="filter-label">
        <input type="radio" name="cat-filter" value="${c.name}" ${selected === c.name ? 'checked' : ''} onchange="debouncedFilterProducts()" />
        ${CAT_ICONS[c.name] || '🐓'} ${c.name}
      </label>`).join('');
}
// Debounce helper — triggers a full server-side search on every keystroke after 350 ms.
let _filterDebounceTimer = null;
function debouncedFilterProducts() {
  clearTimeout(_filterDebounceTimer);
  _filterDebounceTimer = setTimeout(async () => {
    _catalogPage    = 1;
    _catalogHasMore = false;
    state.products  = [];
    await _fetchCatalogPage(1);
    filterProducts();
  }, 350);
}

function filterProducts() {
  const search      = (document.getElementById('catalog-search')?.value || '').toLowerCase();
  const catFilter   = document.querySelector('input[name="cat-filter"]:checked')?.value || '';
  const modelFilter = document.querySelector('input[name="model-filter"]:checked')?.value || '';
  const sort        = document.getElementById('catalog-sort')?.value || 'featured';
  const grid        = document.getElementById('catalog-grid');
  const empty       = document.getElementById('catalog-empty');
  const count       = document.getElementById('catalog-count');
  const catBanner = document.getElementById('category-description-banner');
  if (catBanner) {
    const selectedCat = catFilter ? state.categories.find(c => c.name === catFilter) : null;
    if (selectedCat?.description) {
      catBanner.innerHTML = `
        <span class="cat-desc-icon" aria-hidden="true">${CAT_ICONS[selectedCat.name] || '🐓'}</span>
        <div>
          <strong class="cat-desc-title">${escHtml(selectedCat.name)}</strong>
          <p class="cat-desc-text">${escHtml(selectedCat.description)}</p>
        </div>`;
      catBanner.style.display = 'flex';
    } else {
      catBanner.style.display = 'none';
    }
  }
  let filtered = [...state.products];
  if (catFilter)   filtered = filtered.filter(p => p.category_name === catFilter);
  if (modelFilter) filtered = filtered.filter(p => p.pricing_model === modelFilter);
  if (search)      filtered = filtered.filter(p =>
    p.name.toLowerCase().includes(search) || p.description?.toLowerCase().includes(search));

  filtered.sort((a, b) => {
    const pa = parseFloat(a.base_price || 0);
    const pb = parseFloat(b.base_price || 0);
    if (sort === 'az')         return a.name.localeCompare(b.name);
    if (sort === 'za')         return b.name.localeCompare(a.name);
    if (sort === 'price_asc')  return pa - pb;
    if (sort === 'price_desc') return pb - pa;
    return b.is_featured - a.is_featured;
  });

  count.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''} found`;
  if (!filtered.length) { grid.innerHTML = ''; empty.style.display = 'block'; }
  else { empty.style.display = 'none'; grid.innerHTML = filtered.map(renderProductCard).join(''); }
}

let _globalSearchTimer = null;
function debouncedGlobalSearch(val) {
  clearTimeout(_globalSearchTimer);
  _globalSearchTimer = setTimeout(() => globalSearch(val), 400);
}

function globalSearch(val) {
  toggleSearch();
  navigate('catalog');
  setTimeout(async () => {
    const inp = document.getElementById('catalog-search');
    if (inp) inp.value = val;
    _catalogPage    = 1;
    _catalogHasMore = false;
    state.products  = [];
    await _fetchCatalogPage(1);
    filterProducts();
  }, 100);
}

