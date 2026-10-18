// customer/cartPage.js — customer portal: cart page rendering
'use strict';

/* ════════════════════════════════════════════════════════════
   CART PAGE  [IMPROVED — direct qty input in cart]
═══════════════════════════════════════════════════════════════*/

function renderCart() {
  const container = document.getElementById('cart-items-container');
  const summary   = document.getElementById('cart-summary');

  if (!state.user) {
    if (!state.cart.length) {
      container.innerHTML = `<div class="empty-state"><span>🛒</span><h3>Your cart is empty</h3><p>Start shopping to add items.</p><br/>
        <button class="btn-primary" onclick="navigate('catalog')">Browse Products</button></div>`;
      summary.innerHTML = '';
      return;
    }
    // Fall through to render the guest cart below
  }
  if (!state.cart.length) {
    container.innerHTML = `<div class="empty-state"><span>🛒</span><h3>Your cart is empty</h3><p>Start shopping to add items.</p><br/>
      <button class="btn-primary" onclick="navigate('catalog')">Browse Products</button></div>`;
    summary.innerHTML = '';
    return;
  }

  const subtotal = state.cart.reduce((s, i) => s + estimatedSubtotal(
    i.pricing_model || 'catch_weight', i.quantity, resolveWholesalePrice(i), i.estimated_weight || 1), 0);

  container.innerHTML = state.cart.map(item => {
const pm         = item.pricing_model || 'catch_weight';
    const lineEst    = estimatedSubtotal(pm, item.quantity, resolveWholesalePrice(item), item.estimated_weight || 1);
    const stock      = state.stockMap[item.product_id] ?? null;
    const isOOS      = stock !== null && stock === 0;
    const isLow      = stock !== null && stock > 0 && stock <= LOW_STOCK_THRESHOLD;
    const maxQty     = stock !== null && stock > 0 ? Math.floor(stock) : 999;
    // [NEW] Archived and price-change flags (from CartService patch)
    const isArchived = item.product_status === 'archived';
    const hasChange  = item.price_changed == 1;
 
    let stockNote = '';
    if (isArchived) {
      stockNote = `<div class="cart-stock-warn warn-oos">🚫 This item has been discontinued — please remove it to continue</div>`;
    } else {
      if (hasChange) {
        stockNote += `<div class="cart-price-changed-warn">💲 Price updated: was ${fmtPrice(item.unit_price_snapshot)}, now ${fmtPrice(item.base_price)}</div>`;
      }
      if (isOOS)      stockNote += `<div class="cart-stock-warn warn-oos">⛔ Out of stock — please remove this item</div>`;
      else if (isLow) stockNote += `<div class="cart-stock-warn warn-low">⚠ Only ${stock % 1 === 0 ? stock : stock.toFixed(1)} left</div>`;
    }

    return `
      <div class="cart-item ${isOOS || isArchived ? 'cart-item-oos' : ''}">
        <div class="cart-item-img">${(([img, icon2]) =>
          img ? `<img src="${img}" alt="${escHtml(item.name)}" class="cart-item-photo" loading="lazy"
                      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                 <span class="cart-item-icon-fallback" style="display:none">${icon2}</span>`
              : `<span class="cart-item-icon-fallback">${icon2}</span>`
        )([getProductImgs(item)[0] || '', productIcon(item.category_name || '')])}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-sub">${lineSubLabel(item)}</div>
          ${stockNote}
          <div class="cart-item-actions">
            <button class="qty-btn" onclick="updateCartQty(${item.product_id}, ${parseInt(item.quantity) - 1})"
              ${item.quantity <= 1 || isOOS ? 'disabled' : ''}>−</button>
            <!-- [NEW] Direct quantity input in cart -->
            <input type="number" class="qty-input-direct" value="${item.quantity}" min="1" max="${maxQty}"
              ${isOOS ? 'disabled' : ''}
              onblur="handleCartQtyInput(${item.product_id}, this)"
              onkeydown="if(event.key==='Enter')this.blur()" />
            <button class="qty-btn" onclick="updateCartQty(${item.product_id}, ${parseInt(item.quantity) + 1})"
              ${isOOS || parseInt(item.quantity) >= maxQty ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="cart-item-price">${fmtPrice(lineEst)}</div>
          <div class="cart-item-sub" style="margin-top:.25rem">${pm === 'catch_weight' ? 'estimated' : 'fixed'}</div>
          <button class="btn-danger" style="margin-top:.5rem" onclick="removeFromCart(${item.product_id})">Remove</button>
        </div>
      </div>`;
  }).join('');

  const hasCatchWeight = state.cart.some(i => (i.pricing_model || 'catch_weight') === 'catch_weight');
  const hasArchived    = state.cart.some(i => i.product_status === 'archived');
  const hasOOS         = state.cart.some(i => {
    const stock = state.stockMap[i.product_id];
    return i.product_status === 'archived' || (stock !== undefined && stock === 0);
  });

summary.innerHTML = `
    <h3>Order Summary</h3>
    <div class="summary-row"><span>Subtotal (est.)</span><span>${fmtPrice(subtotal)}</span></div>
    <div class="summary-row" style="color:var(--text-muted);font-size:.85rem"><span>Delivery Fee</span><span>Calculated at checkout</span></div>
    <div class="summary-row total"><span>Est. Subtotal</span><span>${fmtPrice(subtotal)}</span></div>
    ${hasCatchWeight ? `<div class="catch-weight-disclaimer">
      ⚖️ <strong>Catch-Weight Notice:</strong> Some items are priced by actual weight.
      Your final total will be confirmed after packing.</div>` : ''}
    ${hasArchived
      ? `<div class="catch-weight-disclaimer" style="background:var(--red-light,#fff0f0);border-color:var(--red)">
           🚫 Some items are no longer available. Remove them to continue.</div>`
      : hasOOS
        ? `<div class="catch-weight-disclaimer" style="background:var(--red-light,#fff0f0);border-color:var(--red)">
             ⛔ Some items are out of stock. Remove them before checking out.</div>`
        : ''}
    <button class="btn-primary full-width" onclick="navigate('checkout')" style="margin-top:.75rem"
      ${hasArchived || hasOOS ? 'disabled' : ''}>Proceed to Checkout →</button>
    <button class="btn-ghost-dark" style="width:100%;margin-top:.5rem" onclick="navigate('catalog')">Continue Shopping</button>
    <button class="btn-danger" style="width:100%;margin-top:.5rem;opacity:.8"
      onclick="clearEntireCart()">🗑 Empty Cart</button>`;
}

