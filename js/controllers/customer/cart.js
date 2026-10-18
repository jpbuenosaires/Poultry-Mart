// customer/cart.js — customer portal: cart API calls, quantity updates, and cart badge
'use strict';

/* ════════════════════════════════════════════════════════════
   CART API
═══════════════════════════════════════════════════════════════*/

async function loadCartFromAPI() {
  if (!state.user) return;
  const data = await apiFetch(`${CUSTOMER_API}?action=cart&user_id=${state.user.user_id}`);
  if (data.success) {
    state.cart = data.data.items || [];
    updateCartBadge();
    await refreshCartStockMap();
  }
}

/**
 * Refresh the stockMap for all products currently in the cart.
 * Called after cart loads / changes so stock warnings stay current.
 */
async function refreshCartStockMap() {
  if (!state.cart.length) return;
  const ids = state.cart.map(i => i.product_id).join(',');
  const data = await apiFetch(`${CUSTOMER_API}?action=cart_stock&user_id=${state.user.user_id}`);
  if (data.success) {
    Object.assign(state.stockMap, data.data || {});
  }
}

async function addToCart(productId, quantity = 1) {
  // Guests can build a local cart — sign-in is only required at final order placement
  if (!state.user) {
    // Stock check still applies (fetch on demand)
    let stock = state.stockMap[productId];
    if (stock === undefined) {
      const sd = await apiFetch(`${CUSTOMER_API}?action=product_stock&product_id=${productId}`);
      if (sd.success) { stock = parseFloat(sd.data.remaining_qty); state.stockMap[productId] = stock; }
    }
    if (stock !== undefined) {
      const existingQty = parseInt(state.cart.find(i => i.product_id == productId)?.quantity || 0, 10);
      const newTotal    = existingQty + parseInt(quantity, 10);
      if (stock === 0) { toast('Sorry, this item is currently out of stock.', 'error'); return; }
      if (newTotal > stock) {
        toast(`Only ${Math.floor(stock)} ${stock === 1 ? 'unit' : 'units'} available.`, 'error');
        return;
      }
    }
    // Fetch product details to hydrate the local cart row
    const pd = await apiFetch(`${CUSTOMER_API}?action=product&id=${productId}`);
    if (!pd.success) { toast('Could not load product details.', 'error'); return; }
    const p = pd.data;
    const existing = state.cart.find(i => i.product_id == productId);
    if (existing) {
      existing.quantity = newTotal;
    } else {
      state.cart.push({
        product_id:       p.product_id,
        name:             p.name,
        base_price:       p.base_price,
        pricing_model:    p.pricing_model,
        estimated_weight: p.estimated_weight,
        unit_of_measure:  p.unit_of_measure,
        category_name:    p.category_name,
        quantity,
        product_status:   'active',
        price_changed:    0,
        unit_price_snapshot: p.base_price,
      });
    }
    updateCartBadge();
    toast('Added to cart! 🛒 Sign in at checkout to place your order.', 'success');
    return;
  }

  // Always resolve stock before allowing add — fetch on demand if not yet in map
  let stock = state.stockMap[productId];
  if (stock === undefined) {
    const sd = await apiFetch(`${CUSTOMER_API}?action=product_stock&product_id=${productId}`);
    if (sd.success) {
      stock = parseFloat(sd.data.remaining_qty);
      state.stockMap[productId] = stock;
    }
  }
  
  let newTotal = parseInt(quantity, 10);
  // Now the check is never skipped
  if (stock !== undefined) {
    const existingQty = parseInt(state.cart.find(i => i.product_id == productId)?.quantity || 0, 10);
    newTotal = existingQty + parseInt(quantity, 10);
    if (stock === 0) { toast('Sorry, this item is currently out of stock.', 'error'); return; }
    if (newTotal > stock) {
      toast(`Only ${Math.floor(stock)} ${stock === 1 ? 'unit' : 'units'} available in stock.`, 'error');
      return;
    }
  } else {
    const existingQty = state.cart.find(i => i.product_id == productId)?.quantity || 0;
    newTotal = existingQty + quantity;
  }

  const data = await apiFetch(apiUrl('cart_add'), {
    method: 'POST',
    body:   JSON.stringify({ user_id: state.user.user_id, product_id: productId, quantity: newTotal }),
  });
  if (data.success) {
    state.cart = data.data.items || [];
    updateCartBadge();
    await refreshCartStockMap();
    toast('Added to cart! 🛒', 'success');
  } else {
    if (!_handleSuspendedError(data)) toast(data.message, 'error');
  }
}

async function removeFromCart(productId) {
  if (!state.user) {
    state.cart = state.cart.filter(i => i.product_id != productId);
    updateCartBadge();
    renderCart();
    return;
  }
  const data = await apiFetch(apiUrl('cart_remove'), {
    method: 'POST',
    body:   JSON.stringify({ user_id: state.user.user_id, product_id: productId }),
  });
  if (data.success) {
    state.cart = data.data.items || [];
    updateCartBadge();
    renderCart();
  }
}

/** Empty the entire cart after confirmation. */
async function clearEntireCart() {
  if (!state.user) {
    // Guest: clear local cart only
    if (!confirm('Remove all items from your cart?')) return;
    state.cart = [];
    updateCartBadge();
    renderCart();
    toast('Cart cleared.', 'info');
    return;
  }
  if (!confirm('Remove all items from your cart? This cannot be undone.')) return;
  const data = await apiFetch(apiUrl('cart_clear'), {
    method: 'POST',
    body:   JSON.stringify({ user_id: state.user.user_id }),
  });
  if (data.success) {
    state.cart = [];
    updateCartBadge();
    renderCart();
    toast('Cart cleared.', 'info');
  } else {
    toast(data.message || 'Could not clear cart.', 'error');
  }
}

async function updateCartQty(productId, quantity) {
  if (quantity < 1) return;

  // [NEW] Stock check on qty update
  const stock = state.stockMap[productId];
  if (stock !== undefined && quantity > stock) {
    toast(`Only ${Math.floor(stock)} ${stock === 1 ? 'unit' : 'units'} available.`, 'error');
    return;
  }

  if (!state.user) {
    const item = state.cart.find(i => i.product_id == productId);
    if (item) item.quantity = quantity;
    updateCartBadge();
    renderCart();
    return;
  }

  const data = await apiFetch(apiUrl('cart_add'), {
    method: 'POST',
    body:   JSON.stringify({ user_id: state.user.user_id, product_id: productId, quantity }),
  });
  if (data.success) {
    state.cart = data.data.items || [];
    updateCartBadge();
    renderCart();
  }
}

/**
 * [NEW] Direct quantity text-input handler — called on blur/enter from qty input field in cart.
 */
function handleCartQtyInput(productId, inputEl) {
  const raw = parseInt(inputEl.value, 10);
  if (isNaN(raw) || raw < 1) {
    // Reset display to current value
    const current = state.cart.find(i => i.product_id == productId)?.quantity || 1;
    inputEl.value = current;
    return;
  }
  updateCartQty(productId, raw);
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const count = state.cart.reduce((s, i) => s + parseInt(i.quantity), 0);
  badge.textContent   = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

