// fulfillment/auth.js — fulfillment portal: staff login and logout
'use strict';

/* ════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════*/

async function staffLogin() {
  const email = document.getElementById('sf-email').value.trim();
  const pass  = document.getElementById('sf-pass').value;
  const errEl = document.getElementById('sf-login-error');
  const btn   = document.getElementById('sf-login-btn');

  errEl.style.display = 'none';
  if (!email || !pass) {
    errEl.textContent   = 'Please enter your email and password.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Signing in…';

  const data = await loginFetch(FULFILLMENT_API, email, pass);

  btn.disabled    = false;
  btn.textContent = 'Sign In';

  if (!data.success) {
    errEl.textContent   = data.message || 'Login failed.';
    errEl.style.display = 'block';
    return;
  }

  session.user = data.user;
  sessionStorage.setItem('pm_staff_session', JSON.stringify(data.user));
  initApp();
}

function staffLogout() {
  clearInterval(session.pollTimer);
  session.user = null;
  sessionStorage.removeItem('pm_staff_session');
  document.getElementById('portal-app').hidden           = true;
  document.getElementById('portal-login-screen').hidden  = false;
  document.getElementById('sf-email').value                   = '';
  document.getElementById('sf-pass').value                    = '';
  document.getElementById('sf-login-error').style.display     = 'none';
}


