// customer/checkout.js — customer portal: checkout page, delivery slots, addresses, promo codes, place order
'use strict';

/* ════════════════════════════════════════════════════════════
   CHECKOUT PAGE
═══════════════════════════════════════════════════════════════*/

async function loadCheckout() {
  if (!state.cart.length) { navigate('cart'); return; }

  // Auth wall: guests must sign in before the delivery form is rendered.
  // Cart state is preserved in state.cart — no inputs are lost.
  if (!state.user) {
    toast('Please sign in or create a free account to continue checkout. Your cart is saved! 🛒', 'info');
    navigate('auth');
    return;
  }

  const guestBanner = document.getElementById('co-guest-banner');
  const guestPrompt = document.getElementById('co-guest-prompt');
  if (guestBanner) guestBanner.style.display = 'none';
  if (guestPrompt) guestPrompt.style.display = 'none';

  // Persist applied promo across page navigations — silently re-validate against current subtotal.
  if (state.checkoutPromo) {
    const currentSubtotal = state.cart.reduce((s, i) => s + estimatedSubtotal(
      i.pricing_model || 'catch_weight', i.quantity, resolveWholesalePrice(i), i.estimated_weight || 1), 0);
    const minOrder = parseFloat(state.checkoutPromo.min_order_value ?? 0);
    if (currentSubtotal < minOrder) {
      const removedCode   = state.checkoutPromo.code;
      state.checkoutPromo = null;
      toast(`Promo "${removedCode}" was removed — your cart total is below the minimum required.`, 'info');
    }
    // If still valid, leave state.checkoutPromo unchanged so _syncPromoUI shows the applied row.
  }
  _syncPromoUI();

  const fi = document.getElementById('co-first');
  const li = document.getElementById('co-last');
  const pi = document.getElementById('co-phone');
  if (fi) fi.value = state.user.first_name || '';
  if (li) li.value = state.user.last_name  || '';
  if (pi) pi.value = state.user.phone      || '';

  await loadCheckoutMeta();
  await initMunicipalitySelect('co-city', 'co-barangay');
  await loadSavedAddressesForCheckout();
  updateCheckoutSummary();
}

async function loadCheckoutMeta() {
  if (!state.checkoutMeta) {
    const data = await apiFetch(apiUrl('checkout_meta'));
    if (data.success) state.checkoutMeta = data.data;
  }

  if (state.checkoutMeta) {
    populateZones(state.checkoutMeta.zones || []);
    // Awaited so fetchServerTime resolves before onDeliveryDateChange populates slots
    await setupDeliveryDatePicker(state.checkoutMeta.hours || []);
    // NOTE: populateSlots is intentionally removed here — setupDeliveryDatePicker →
    // onDeliveryDateChange handles slot population after server time is known.
  } else {
    // Fallback
    const zoneEl = document.getElementById('co-zone');
    if (zoneEl && zoneEl.options.length <= 1)
      // zones are always populated from DB; no hardcoded fallback
      zoneEl.innerHTML = `<option value="">— Select delivery zone —</option>
                          <option value="2" data-fee="60">Sagpon – ₱60.00</option>`;
    const slotEl = document.getElementById('co-slot');
    if (slotEl && slotEl.options.length <= 1)
      slotEl.innerHTML = `<option value="1">8:00 AM – 10:00 AM</option>
                          <option value="2">10:00 AM – 12:00 PM</option>`;
  }
}

/**
 * [NEW] Set up the date picker to only allow days that are operational.
 * operational_hours.day_of_week values: 0=Sun … 6=Sat
 */
/**
 * Fetch the current server date/time in Asia/Manila and cache it in
 * state.serverTime = { date: 'YYYY-MM-DD', time: 'HH:MM', dow: N }.
 * Falls back to browser time if the request fails.
 */
async function fetchServerTime() {
  if (state.serverTime) return state.serverTime;
  try {
    const data = await apiFetch(apiUrl('server_time'));
    if (data.success) {
      state.serverTime = data.data;
      return state.serverTime;
    }
  } catch (_) { /* intentional fallthrough */ }
  // Graceful fallback to browser time (still protects against basic tampering)
  const now = new Date();
  // Adjust for timezone offset to get the correct local ISO date
  const localIsoDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  
  state.serverTime = {
    date: localIsoDate,
    time: now.toTimeString().slice(0, 5),
    dow:  now.getDay(),
  };
  return state.serverTime;
}

async function setupDeliveryDatePicker(hours) {
  const dateInput = document.getElementById('co-date');
  if (!dateInput) return;

  const allowedDays = new Set(hours.map(h => parseInt(h.day_of_week)));

  // Use server Manila time instead of local browser clock
  const srv = await fetchServerTime();

  // Build "tomorrow" relative to the server date
  const srvDate  = new Date(srv.date + 'T00:00:00');
  const tomorrow = new Date(srvDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let candidate = new Date(tomorrow);
  let limit = 60;
  while (limit-- > 0 && !allowedDays.has(candidate.getDay())) {
    candidate.setDate(candidate.getDate() + 1);
  }

  const minDate = candidate.toISOString().split('T')[0];
  dateInput.min   = minDate;
  dateInput.value = minDate;

  dateInput._allowedDays  = allowedDays;
  dateInput._srvTodayDate = srv.date; // stored for onDeliveryDateChange
  dateInput.addEventListener('change', function () {
    const chosen = new Date(this.value + 'T00:00:00');
    if (!allowedDays.has(chosen.getDay())) {
      let next  = new Date(chosen);
      let guard = 7;
      do { next.setDate(next.getDate() + 1); } while (!allowedDays.has(next.getDay()) && --guard > 0);
      this.value = next.toISOString().split('T')[0];
      const hint    = document.getElementById('co-date-hint');
      const dayName = DAY_NAMES[next.getDay()];
      if (hint) {
        hint.textContent = `We don't deliver on that day. Moved to the next available day (${dayName}).`;
        hint.style.display = 'block';
        setTimeout(() => { hint.style.display = 'none'; }, 4000);
      }
    }
    onDeliveryDateChange();
  });

  onDeliveryDateChange();
}

/**
 * [NEW] When delivery date changes, filter time slots:
 * For same-day delivery, hide slots whose start_time has already passed.
 */
function onDeliveryDateChange() {
  const dateInput = document.getElementById('co-date');
  const chosen    = dateInput?.value;
  if (!chosen || !state.checkoutMeta) return;

  const slots = state.checkoutMeta.slots || [];
  // Use the server date/time cached by fetchServerTime() — never the browser clock
  const srvDate  = state.serverTime?.date ?? '';
  const srvTime  = state.serverTime?.time ?? '00:00';
  const isToday  = chosen === srvDate;

  const validSlots = slots.filter(s => {
    if (s.is_active == 0) return false;
    if (isToday) {
      // Hide slots whose start time has already passed according to server time
      return (s.start_time || '23:59').slice(0, 5) > srvTime;
    }
    return true;
  });

  populateSlots(validSlots, chosen);
}

function populateZones(zones) {
  const el = document.getElementById('co-zone');
  if (!el || !zones.length) return;
  el.innerHTML = zones.map(z =>
    `<option value="${z.zone_id}" data-fee="${z.delivery_fee}">${z.municipality_name} – ₱${parseFloat(z.delivery_fee).toFixed(2)}</option>`
  ).join('');
  updateCheckoutSummary();
}

function populateSlots(slots, _date) {
  const el = document.getElementById('co-slot');
  if (!el) return;
  if (!slots.length) {
    el.innerHTML = '<option value="">No available time slots</option>';
    return;
  }
  el.innerHTML = slots.map(s =>
    `<option value="${s.slot_id}">${s.slot_label} (${fmtTime12(s.start_time)}–${fmtTime12(s.end_time)})</option>`
  ).join('');
}

async function loadSavedAddressesForCheckout() {
  if (!state.user) return;
  const data = await apiFetch(`${CUSTOMER_API}?action=profile&user_id=${state.user.user_id}`);
  if (!data.success) return;

  const addresses = data.data.addresses || [];
  state.savedAddresses = addresses;
  const section = document.getElementById('co-saved-address-section');
  const select  = document.getElementById('co-saved-address');
  if (!section || !select) return;

  if (addresses.length > 0) {
    section.style.display = 'block';
    // [IMPROVED] Explicitly label the default address
    select.innerHTML = '<option value="">— Enter a new address below —</option>' +
      addresses.map(a =>
        `<option value="${a.address_id}" data-street="${a.street}" data-barangay="${a.barangay}" data-city="${a.city}">
          ${a.is_default == 1 ? '(Default) ' : ''}${a.label}: ${a.street}, ${a.barangay}, ${a.city}
        </option>`
      ).join('');
    const def = addresses.find(a => a.is_default == 1) || addresses[0];
    if (def) {
      select.value = def.address_id;
      onSavedAddressChange();
    }
  } else {
    section.style.display = 'none';
  }

  // Wire auto-zone-match listeners once per element — guard with dataset flag to
  // prevent accumulation when the user navigates to checkout multiple times.
  // NOTE: wired unconditionally so users with no saved addresses also get auto-zone on manual entry.
  const cityEl = document.getElementById('co-city');
  const bgyEl  = document.getElementById('co-barangay');
  if (cityEl && !cityEl.dataset.zoneWired) {
    cityEl.dataset.zoneWired = '1';
    cityEl.addEventListener('change', () => {
      const savedSel = document.getElementById('co-saved-address');
      if (!savedSel?.value) _autoMatchZone(
        document.getElementById('co-barangay')?.value, cityEl.value
      );
    });
  }
  if (bgyEl && !bgyEl.dataset.zoneWired) {
    bgyEl.dataset.zoneWired = '1';
    bgyEl.addEventListener('change', () => {
      const savedSel = document.getElementById('co-saved-address');
      if (!savedSel?.value) _autoMatchZone(
        bgyEl.value, document.getElementById('co-city')?.value
      );
    });
  }
}

async function onSavedAddressChange() {
  const select  = document.getElementById('co-saved-address');
  const opt     = select?.options[select.selectedIndex];
  const defWrap = document.getElementById('co-save-default-wrap');
  const form    = document.getElementById('co-address-form');

  const isNewAddress = !opt?.value;

  // Show/hide the "save as default" checkbox and manual form
  if (defWrap) defWrap.style.display = isNewAddress ? '' : 'none';

  if (!isNewAddress) {
    // Lock the manual fields — user selected a saved address
    const addr = state.savedAddresses.find(a => a.address_id == opt.value);
    if (addr && form) {
      // Populate read-only display fields
      document.getElementById('co-street').value  = addr.street   || '';
      document.getElementById('co-notes') && null; // notes stays editable
      await setAddressDropdowns('co-city', 'co-barangay', addr.city, addr.barangay_id);
      // Disable all address fields
      form.querySelectorAll('input, select').forEach(el => {
        if (el.id !== 'co-notes') el.disabled = true;
      });
    }
    // Auto-match delivery zone by barangay + city
    // Use addr fields directly (more reliable than dataset which may be stale)
    const matchBgy  = addr?.barangay || opt.dataset.barangay;
    const matchCity = addr?.city     || opt.dataset.city;
    _autoMatchZone(matchBgy, matchCity);
  } else {
    // Re-enable manual fields for new address entry
    if (form) {
      form.querySelectorAll('input, select').forEach(el => el.disabled = false);
    }
    updateCheckoutSummary();
  }
}

function _autoMatchZone(barangay, city) {
  const zones  = state.checkoutMeta?.zones || [];
  const zoneEl = document.getElementById('co-zone');
  if (!zoneEl || !zones.length) return;

  const cityLow = (city || '').toLowerCase().trim();

  // Zones are now municipality-level only; match on municipality_name
  const match = cityLow
    ? zones.find(z => (z.municipality_name || '').toLowerCase().trim() === cityLow)
    : null;

  const zoneGroup = document.getElementById('co-zone-group');
  if (match) {
    zoneEl.value = match.zone_id;
    // Matched — keep zone group hidden and show the fee notice inline
    if (zoneGroup) { zoneGroup.hidden = true; zoneGroup.setAttribute('aria-hidden', 'true'); zoneGroup.style.display = 'none'; }
    const feeNotice = document.getElementById('co-zone-notice');
    if (feeNotice) {
      feeNotice.textContent = `📍 Delivery to ${match.municipality_name} — ₱${parseFloat(match.delivery_fee).toFixed(2)}`;
      feeNotice.style.display = 'block';
    }
  } else {
    zoneEl.value = '';
    // No auto-match — reveal the zone dropdown so the user can pick manually
    if (zoneGroup) { zoneGroup.hidden = false; zoneGroup.removeAttribute('aria-hidden'); zoneGroup.style.display = 'block'; }
    const feeNotice = document.getElementById('co-zone-notice');
    if (feeNotice) {
      feeNotice.textContent = '⚠️ Your address area was not recognised. Please select your delivery zone below.';
      feeNotice.style.display = 'block';
    }
  }
  updateCheckoutSummary();
}

function updateCheckoutSummary() {
  const panel = document.getElementById('checkout-summary-panel');
  if (!panel) return;

  const subtotal = state.cart.reduce((s, i) => s + estimatedSubtotal(
    i.pricing_model || 'catch_weight', i.quantity, resolveWholesalePrice(i), i.estimated_weight || 1), 0);

  const zoneEl      = document.getElementById('co-zone');
  const deliveryFee = parseFloat(zoneEl?.options[zoneEl.selectedIndex]?.dataset.fee || 0);

let discount = 0;
  if (state.checkoutPromo) {
    const minOrder = parseFloat(state.checkoutPromo.min_order_value ?? 0);
    if (subtotal < minOrder) {
      // Cart no longer qualifies — silently clear the promo and notify the customer
      const removedCode = state.checkoutPromo.code;
      state.checkoutPromo = null;
      _syncPromoUI();
      toast(`Promo "${removedCode}" removed — cart total dropped below the minimum order value.`, 'info');
    } else {
      // Re-calculate discount from stored promo fields (server snapshot)
      if (state.checkoutPromo.discount_type === 'percentage') {
        discount = subtotal * state.checkoutPromo.discount_value / 100;
      } else {
        discount = state.checkoutPromo.discount_value;
      }
      discount = Math.min(discount, subtotal);
      // Keep discount_amount in sync so the summary label stays accurate
      state.checkoutPromo.discount_amount = discount;
    }
  }

  const total          = subtotal - discount + deliveryFee;
  const hasCatchWeight = state.cart.some(i => (i.pricing_model || 'catch_weight') === 'catch_weight');

  panel.innerHTML = `
    <div class="card" style="margin-bottom:0">
      <h3>Order Summary</h3>
      ${state.cart.map(i => {
        const lineEst = estimatedSubtotal(i.pricing_model || 'catch_weight', i.quantity, resolveWholesalePrice(i), i.estimated_weight || 1);
        const wsPrice = resolveWholesalePrice(i);
        const wsNote  = wsPrice < parseFloat(i.base_price || 0)
          ? ` <small style="color:var(--green)">(wholesale ₱${wsPrice.toFixed(2)})</small>` : '';
        return `<div style="display:flex;justify-content:space-between;padding:.4rem 0;font-size:.85rem;border-bottom:1px solid var(--bg-alt)">
          <span>${i.name} ×${i.quantity}${wsNote}</span><span>${fmtPrice(lineEst)}</span></div>`;
      }).join('')}
      <div class="summary-row" style="margin-top:.75rem"><span>Subtotal</span><span>${fmtPrice(subtotal)}</span></div>
      ${discount > 0 ? `<div class="summary-row" style="color:var(--green)"><span>Discount (${state.checkoutPromo?.code})</span><span>−${fmtPrice(discount)}</span></div>` : ''}
      <div class="summary-row"><span>Delivery Fee</span><span>${fmtPrice(deliveryFee)}</span></div>
      <div class="summary-row total"><span>Est. Total</span><span>${fmtPrice(total)}</span></div>
      ${hasCatchWeight ? `<div class="catch-weight-disclaimer">⚖️ Final amount confirmed after weighing.</div>` : ''}
      <button class="btn-primary full-width" onclick="placeOrder()" style="margin-top:1rem">✓ Confirm Order</button>
    </div>`;
}

/* ── Payment method toggle — reveals GCash instructions panel ── */

function onPaymentMethodChange() {
  const method     = document.querySelector('input[name="payment"]:checked')?.value || 'COD';
  const gcashPanel = document.getElementById('co-gcash-panel');
  if (gcashPanel) gcashPanel.style.display = method === 'GCash' ? 'block' : 'none';
  updateCheckoutSummary();
}

/* ── Promo code — [IMPROVED] real-time validation + remove ──── */

async function applyPromo() {
  const code    = document.getElementById('co-promo').value.trim().toUpperCase();
  const msg     = document.getElementById('promo-msg');
  const btn     = document.getElementById('promo-apply-btn');
  if (!code) { msg.textContent = 'Please enter a promo code.'; msg.className = 'promo-msg error'; return; }

  // Calculate current subtotal for min_order_value check — use wholesale-resolved price for accuracy
  const subtotal = state.cart.reduce((s, i) => s + estimatedSubtotal(
    i.pricing_model || 'catch_weight', i.quantity, resolveWholesalePrice(i), i.estimated_weight || 1), 0);

  msg.textContent = 'Validating…';
  msg.className   = 'promo-msg';
  btn.disabled    = true;

  const data = await apiFetch(apiUrl('validate_promo'), {
    method: 'POST',
    body:   JSON.stringify({ code, order_total: subtotal }),
  });

  btn.disabled = false;

  if (data.success) {
    state.checkoutPromo = { ...data.promo, discount_amount: data.discount_amount };
    msg.textContent     = '';
    msg.className       = 'promo-msg';
    _syncPromoUI();
    updateCheckoutSummary();
    toast(`Promo "${code}" applied — saving ${fmtPrice(data.discount_amount)}! 🎉`, 'success');
  } else {
    state.checkoutPromo = null;
    msg.textContent     = data.message;
    msg.className       = 'promo-msg error';
    _syncPromoUI();
    updateCheckoutSummary();
  }
}

function removePromo() {
  state.checkoutPromo = null;
  const inp = document.getElementById('co-promo');
  if (inp) inp.value = '';
  const msg = document.getElementById('promo-msg');
  if (msg) { msg.textContent = ''; msg.className = 'promo-msg'; }
  _syncPromoUI();
  updateCheckoutSummary();
  toast('Promo code removed.', 'info');
}

/** Sync the promo input row vs applied row based on state. */
function _syncPromoUI() {
  const inputRow   = document.getElementById('promo-input-row');
  const appliedRow = document.getElementById('promo-applied-row');
  const label      = document.getElementById('promo-applied-label');
  if (!inputRow || !appliedRow) return;

  if (state.checkoutPromo) {
    const p = state.checkoutPromo;
    const discStr = p.discount_type === 'percentage'
      ? `${p.discount_value}% off`
      : `₱${parseFloat(p.discount_value).toFixed(2)} off`;
    label.textContent       = `✅ "${p.code}" — ${discStr} applied`;
    inputRow.style.display   = 'none';
    appliedRow.style.display = 'flex';
  } else {
    inputRow.style.display   = '';
    appliedRow.style.display = 'none';
  }
}

async function placeOrder() {
// Guests must sign in before order placement — redirect with cart preserved
  if (!state.user) {
    toast('Please sign in or create an account to complete your order. Your cart has been saved.', 'info');
    navigate('auth');
    return;
  }
  const slotId    = parseInt(document.getElementById('co-slot')?.value || 0) || null;
  const zoneEl    = document.getElementById('co-zone');
  const zoneId    = parseInt(zoneEl?.value || 0) || null;
  const payment   = document.querySelector('input[name="payment"]:checked')?.value || 'COD';
  const date      = document.getElementById('co-date')?.value;

  // Zone must be resolved before we go further — if it's missing, run auto-match one more time
  // using the currently selected saved address or the manually entered address fields.
  if (!zoneId) {
    const savedSel = document.getElementById('co-saved-address');
    if (savedSel?.value) {
      const opt = savedSel.options[savedSel.selectedIndex];
      _autoMatchZone(opt?.dataset?.barangay, opt?.dataset?.city);
    } else {
      _autoMatchZone(
        document.getElementById('co-barangay')?.value,
        document.getElementById('co-city')?.value
      );
    }
    // Re-read after retry
    const retryZoneId = parseInt(zoneEl?.value || 0) || null;
    if (!retryZoneId) {
      toast('We could not determine your delivery zone from your address. Please contact us or choose a different address.', 'error');
      const zoneGroup = document.getElementById('co-zone-group');
      if (zoneGroup) { zoneGroup.hidden = false; zoneGroup.removeAttribute('aria-hidden'); }
      const feeNotice = document.getElementById('co-zone-notice');
      if (feeNotice) { feeNotice.textContent = '⚠️ Your delivery area is outside our current zones. Please call us to arrange delivery.'; feeNotice.style.display = 'block'; }
      return;
    }
  }

  // Guard: slot must be selected before proceeding
  if (!slotId) {
    toast('Please select a delivery time slot before confirming your order.', 'error');
    document.getElementById('co-slot')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // GCash: require reference number before proceeding
  let gcashRef     = null;
  let gcashReceipt = null;
  if (payment === 'GCash') {
    gcashRef = document.getElementById('co-gcash-ref')?.value?.trim() || '';
    if (!gcashRef) {
      toast('Please enter your GCash Reference Number to continue.', 'error');
      document.getElementById('co-gcash-ref')?.focus();
      return;
    }
    const receiptFile = document.getElementById('co-gcash-receipt')?.files?.[0];
    if (receiptFile) {
      if (receiptFile.size > 5 * 1024 * 1024) {
        toast('GCash receipt image must be 5 MB or smaller.', 'error');
        const btn = document.querySelector('#checkout-summary-panel .btn-primary');
        if (btn) { btn.disabled = false; btn.textContent = '✓ Confirm Order'; }
        return;
      }
      gcashReceipt = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Receipt read failed'));
        reader.readAsDataURL(receiptFile);
      });
    }
  }
  const notes     = document.getElementById('co-notes')?.value || '';
  const promoCode = state.checkoutPromo ? state.checkoutPromo.code : '';
  if (!date) { toast('Please select a delivery date.', 'error'); return; }

  let addressId = null;
  const savedSelect = document.getElementById('co-saved-address');
  if (savedSelect?.value) {
    addressId = parseInt(savedSelect.value);
  } else {
    const street   = document.getElementById('co-street')?.value?.trim();
const bgyEl        = document.getElementById('co-barangay');
    const cityEl       = document.getElementById('co-city');
    const barangayId   = parseInt(bgyEl?.value)  || 0;
    const municipalityId = parseInt(
      cityEl?.options[cityEl.selectedIndex]?.dataset.municipalityId ?? 0
    );
    if (!street || !barangayId) { toast('Please enter your delivery address (street and barangay).', 'error'); return; }
    const saveAsDefault = document.getElementById('co-save-default')?.checked ? 1 : 0;
    const addrData = await apiFetch(apiUrl('add_address'), {
      method: 'POST',
      body:   JSON.stringify({
        user_id: state.user.user_id, label: 'Delivery',
        street, barangay_id: barangayId, municipality_id: municipalityId,
        is_default: saveAsDefault,
      }),
    });
    if (!addrData.success) { toast('Could not save address: ' + addrData.message, 'error'); return; }
    const addrs = addrData.data?.addresses || [];
    if (addrs.length) addressId = addrs[addrs.length - 1].address_id;
  }
  if (!addressId) { toast('Unable to determine delivery address.', 'error'); return; }

  // Zone is guaranteed non-null at this point — validated and retried above.

  const btn = document.querySelector('#checkout-summary-panel .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Placing order…'; }

  const data = await apiFetch(apiUrl('place_order'), {
    method: 'POST',
    body:   JSON.stringify({
      user_id: state.user.user_id, address_id: addressId, slot_id: slotId,
      zone_id: zoneId, payment_method: payment, delivery_date: date,
      special_instructions: notes, promo_code: promoCode,
      gcash_reference: gcashRef || null,
      gcash_receipt:   gcashReceipt || null,
    }),
  });

  if (data.success) {
    state.cart = []; state.checkoutPromo = null;
    updateCartBadge();
    toast(`Order ${data.order_number} placed! 🎉`, 'success');
    await loadNotifications();
    navigate('orders');
  } else {
    if (!_handleSuspendedError(data)) {
      toast(data.message || 'Failed to place order.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '✓ Confirm Order'; }
    }
  }
}
