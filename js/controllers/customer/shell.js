// customer/shell.js — customer portal: search toggle, store hours, mobile nav, and DOMContentLoaded bootstrap
'use strict';

/* ════════════════════════════════════════════════════════════
   SEARCH TOGGLE
═══════════════════════════════════════════════════════════════*/

function toggleSearch() {
  const el = document.getElementById('search-overlay');
  el.classList.toggle('open');
  el.style.display = el.classList.contains('open') ? 'block' : 'none';
  if (el.classList.contains('open')) document.getElementById('global-search').focus();
}

function _handleSuspendedError(data) {
  if (data && !data.success &&
      (data.message || '').toLowerCase().match(/suspended|blocked/)) {
    toast('Your account has been suspended. You have been signed out.', 'error');
    logout();
    return true;
  }
  return false;
}

async function loadStoreFooterHours() {
  if (!state.checkoutMeta) {
    const data = await apiFetch(apiUrl('checkout_meta'));
    if (data.success) state.checkoutMeta = data.data;
  }
  const hours = state.checkoutMeta?.hours;
  if (!hours?.length) return;
 
  const activeHours = hours.filter(h => h.is_active == 1);
  if (!activeHours.length) return;
 
  const dayAbbr = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dows    = activeHours.map(h => parseInt(h.day_of_week)).sort((a, b) => a - b);
  const first   = dayAbbr[dows[0]];
  const last    = dayAbbr[dows[dows.length - 1]];
  const dayStr  = first === last ? first : `${first}–${last}`;
  const sample  = activeHours[0];
 
  const el = document.getElementById('footer-store-hours');
  if (el) el.textContent = `🕐 ${dayStr} ${fmtTime12(sample.open_time)}–${fmtTime12(sample.close_time)}`;
}

function isStoreOpen() {
  const hours = state.checkoutMeta?.hours;
  if (!hours?.length) return true;
  // Exclusively use the server-supplied time — never the local browser clock.
  if (!state.serverTime) return true; // serverTime not yet loaded; optimistically assume open
  const todayDow = parseInt(state.serverTime.dow);          // 0 = Sun … 6 = Sat (Asia/Manila)
  const todayRow = hours.find(h => parseInt(h.day_of_week) === todayDow && h.is_active == 1);
  if (!todayRow) return false;
  const nowHHMM  = state.serverTime.time.slice(0, 5);       // "HH:MM" from server payload
  return nowHHMM >= todayRow.open_time.slice(0, 5) && nowHHMM < todayRow.close_time.slice(0, 5);
}


/* ════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════*/

/* ════════════════════════════════════════════════════════════
   MOBILE NAV
═══════════════════════════════════════════════════════════════*/

function toggleMobileNav() {
  const drawer  = document.getElementById('mobile-nav-drawer');
  const overlay = document.getElementById('mobile-nav-overlay');
  const btn     = document.getElementById('hamburger-btn');
  const isOpen  = drawer.classList.contains('open');
  drawer.classList.toggle('open', !isOpen);
  overlay.classList.toggle('open', !isOpen);
  drawer.style.display  = isOpen ? 'none' : 'block';
  overlay.style.display = isOpen ? 'none' : 'block';
  drawer.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
  btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  document.body.classList.toggle('mobile-nav-open', !isOpen);
}

function closeMobileNav() {
  const drawer  = document.getElementById('mobile-nav-drawer');
  const overlay = document.getElementById('mobile-nav-overlay');
  const btn     = document.getElementById('hamburger-btn');
  if (!drawer) return;
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  drawer.style.display  = 'none';
  overlay.style.display = 'none';
  drawer.setAttribute('aria-hidden', 'true');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('mobile-nav-open');
}

document.addEventListener('DOMContentLoaded', async () => {
  // Restore PHP session into JS state on every page load / refresh.
  // Without this, state.user is always null after a refresh even
  // though $_SESSION['customer_id'] is still alive server-side.
  try {
    const session = await apiFetch(apiUrl('me'));
    if (session.success && session.user) {
      state.user = session.user;
      updateAuthUI();
      await Promise.all([loadCartFromAPI(), loadNotifications()]);
    }
  } catch (e) {
    // Network error on startup — silently continue as guest
    console.warn('[PoultryMart] Session restore failed:', e);
  }
  navigate('home');
});