// rider/auth.js — rider portal: rider login and logout
'use strict';

/* ════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════*/

async function riderLogin() {
  const emailEl = document.getElementById('r-email');
  const passEl  = document.getElementById('r-pass');
  const errEl   = document.getElementById('r-login-error');
  const btn     = document.getElementById('r-login-btn');

  const email = emailEl.value.trim();
  const pass  = passEl.value;

  errEl.hidden      = true;
  errEl.textContent = '';

  if (!email || !pass) {
    errEl.textContent = 'Please enter your email and password.';
    errEl.hidden      = false;
    emailEl.focus();
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Signing in…';

  const data = await loginFetch(RIDER_API, email, pass);

  btn.disabled    = false;
  btn.textContent = 'Sign In';

  if (!data.success) {
    errEl.textContent = data.message || 'Login failed. Please try again.';
    errEl.hidden      = false;
    emailEl.focus();
    return;
  }

  if (data.user.role_name !== 'Delivery Rider') {
    errEl.textContent = 'This portal is for Delivery Riders only.';
    errEl.hidden      = false;
    emailEl.focus();
    return;
  }

  rSession.user = data.user;
  sessionStorage.setItem('rider_user', JSON.stringify(data.user));
  initRiderApp();
}

function riderLogout() {
  rSession.user = null;
  sessionStorage.removeItem('rider_user');

  document.getElementById('portal-app').hidden          = true;
  document.getElementById('portal-login-screen').hidden = false;
  document.getElementById('r-email').value             = '';
  document.getElementById('r-pass').value              = '';
  document.getElementById('r-email').focus();
}

