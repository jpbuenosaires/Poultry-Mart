// rider/settings.js — rider portal: settings / profile page
'use strict';

/* ════════════════════════════════════════════════════════════
   SETTINGS / PROFILE PAGE
═══════════════════════════════════════════════════════════════*/

async function loadSettings() {
  const infoEl = document.getElementById('settings-profile-info');
  if (infoEl) {
    const res = await apiGet('profile');
    if (res.success) {
      const u = res.data;
      infoEl.innerHTML = `
        <div class="settings-profile-row">
          <span class="detail-row-label">Name</span>
          <span>${escHtml(u.first_name + ' ' + u.last_name)}</span>
        </div>
        <div class="settings-profile-row">
          <span class="detail-row-label">Email</span>
          <span>${escHtml(u.email)}</span>
        </div>`;
      const phoneInput = document.getElementById('settings-phone');
      if (phoneInput && u.phone) phoneInput.value = u.phone;
    }
  }
  loadRemittanceHistory();
}

async function savePhone() {
  const phone  = document.getElementById('settings-phone')?.value.trim() || '';
  const errEl  = document.getElementById('settings-phone-error');
  const succEl = document.getElementById('settings-phone-success');
  errEl.hidden  = true;
  succEl.hidden = true;

  if (!phone) {
    errEl.textContent = 'Please enter a phone number.';
    errEl.hidden      = false;
    return;
  }

  const res = await apiPost('update_profile', { phone });
  if (res.success) {
    succEl.textContent = res.message;
    succEl.hidden      = false;
    toast('Phone number updated.', 'success');
  } else {
    errEl.textContent = res.message || 'Failed to update phone.';
    errEl.hidden      = false;
  }
}

async function savePassword() {
  const curPass  = document.getElementById('settings-cur-pass')?.value     || '';
  const newPass  = document.getElementById('settings-new-pass')?.value     || '';
  const confPass = document.getElementById('settings-confirm-pass')?.value || '';
  const errEl    = document.getElementById('settings-pass-error');
  const succEl   = document.getElementById('settings-pass-success');
  errEl.hidden  = true;
  succEl.hidden = true;

  if (!curPass || !newPass || !confPass) {
    errEl.textContent = 'Please fill in all password fields.';
    errEl.hidden      = false;
    return;
  }
  if (newPass !== confPass) {
    errEl.textContent = 'New passwords do not match.';
    errEl.hidden      = false;
    return;
  }
  if (newPass.length < 8) {
    errEl.textContent = 'New password must be at least 8 characters.';
    errEl.hidden      = false;
    return;
  }

  const res = await apiPost('update_profile', {
    current_password: curPass,
    new_password:     newPass,
  });

  if (res.success) {
    succEl.textContent = res.message;
    succEl.hidden      = false;
    document.getElementById('settings-cur-pass').value     = '';
    document.getElementById('settings-new-pass').value     = '';
    document.getElementById('settings-confirm-pass').value = '';
    toast('Password updated.', 'success');
  } else {
    errEl.textContent = res.message || 'Failed to update password.';
    errEl.hidden      = false;
  }
}

