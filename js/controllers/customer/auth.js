// customer/auth.js — customer portal: login, register, logout, and auth UI
'use strict';

/* ════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════*/

function toggleAuthForm() {
  const lf = document.getElementById('login-form');
  const rf = document.getElementById('register-form');
  lf.style.display = lf.style.display === 'none' ? 'block' : 'none';
  rf.style.display = rf.style.display === 'none' ? 'block' : 'none';
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!email || !pass) {
    errEl.textContent   = 'Please fill in all fields.';
    errEl.style.display = 'block';
    return;
  }

const data = await apiFetch(apiUrl('login'), {
    method: 'POST',
    body: JSON.stringify({ email, password: pass }),
  });
  if (data.success) {
    state.user           = data.user;
    state.products       = [];
    state.categories     = [];
    state.stockMap       = {};
    state.checkoutMeta   = null;
    updateAuthUI();
    // Merge any guest cart items into the authenticated user's server-side cart before fetching
    const guestItems = [...state.cart];
    state.cart = [];
    if (guestItems.length) {
      await Promise.all(guestItems.map(item =>
        apiFetch(apiUrl('cart_add'), {
          method: 'POST',
          body:   JSON.stringify({ user_id: data.user.user_id, product_id: item.product_id, quantity: item.quantity }),
        })
      ));
    }
    await Promise.all([loadCartFromAPI(), loadNotifications()]);
    toast(`Welcome back, ${data.user.first_name}! 🎉`, 'success');
    navigate('home');
  } else {
    errEl.textContent   = data.message;
    errEl.style.display = 'block';
  }
}

async function doRegister() {
  const first = document.getElementById('reg-first').value.trim();
  const last  = document.getElementById('reg-last').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const pass  = document.getElementById('reg-password').value;
  const errEl = document.getElementById('reg-error');
  errEl.style.display = 'none';

if (!first || !last || !email || !pass) {
    errEl.textContent   = 'Please fill in all required fields.';
    errEl.style.display = 'block';
    return;
  }
  if (pass.length < 8) {
    errEl.textContent   = 'Password must be at least 8 characters long.';
    errEl.style.display = 'block';
    document.getElementById('reg-password').focus();
    return;
  }
  if (!email.includes('@') || !email.includes('.')) {
    errEl.textContent   = 'Please enter a valid email address.';
    errEl.style.display = 'block';
    return;
  }

  const data = await apiFetch(apiUrl('register'), {
    method: 'POST',
    body:   JSON.stringify({ first_name: first, last_name: last, email, phone, password: pass }),
  });

  if (data.success) {
    state.user         = data.user;
    state.checkoutMeta = null;
    state.stockMap     = {};
    updateAuthUI();
    // Merge any guest cart items into the new account's server-side cart before fetching
    const guestItems = [...state.cart];
    state.cart = [];
    if (guestItems.length) {
      await Promise.all(guestItems.map(item =>
        apiFetch(apiUrl('cart_add'), {
          method: 'POST',
          body:   JSON.stringify({ user_id: data.user.user_id, product_id: item.product_id, quantity: item.quantity }),
        })
      ));
    }
    await Promise.all([loadCartFromAPI(), loadNotifications()]);
    toast(`Account created! Welcome, ${first}! 🐓`, 'success');
    navigate('home');
  } else {
    errEl.textContent   = data.message;
    errEl.style.display = 'block';
  }
}

function logout() {
  state.user           = null;
  state.cart           = [];
  state.notifications  = [];
  state.savedAddresses = [];
  state.stockMap       = {};
  state.products       = [];
  state.categories     = [];
  state.checkoutMeta   = null;
  updateAuthUI();
  updateCartBadge();
  updateNotifBadge();
  toast('Signed out successfully.');
  navigate('home');
}

function updateAuthUI() {
  const btn       = document.getElementById('auth-btn');
  const notifWrap = document.getElementById('notif-wrapper');
  if (state.user) {
    btn.textContent = 'Sign Out';
    btn.onclick     = logout;
    if (notifWrap) notifWrap.style.display = 'block';
  } else {
    btn.textContent = 'Sign In';
    btn.onclick     = () => navigate('auth');
    if (notifWrap) notifWrap.style.display = 'none';
  }
}

