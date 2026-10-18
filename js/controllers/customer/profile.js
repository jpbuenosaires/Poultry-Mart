// customer/profile.js — customer portal: profile page, addresses, and change password
'use strict';

/* ════════════════════════════════════════════════════════════
   PROFILE PAGE  [IMPROVED — change password tab]
═══════════════════════════════════════════════════════════════*/

async function loadProfile() {
  if (!state.user) { navigate('auth'); return; }
  const data = await apiFetch(`${CUSTOMER_API}?action=profile&user_id=${state.user.user_id}`);
  if (!data.success) return;

  const user = data.data;
  const addresses = user.addresses || [];
  state.savedAddresses = addresses;
  document.getElementById('pf-first').value = user.first_name || '';
  document.getElementById('pf-last').value  = user.last_name  || '';
  document.getElementById('pf-email').value = user.email      || '';
  document.getElementById('pf-phone').value = user.phone      || '';
  renderAddresses(state.savedAddresses);
}

function renderAddresses(addresses) {
  const el = document.getElementById('address-list');
  if (!addresses?.length) { el.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">No saved addresses yet.</p>'; return; }
  el.innerHTML = addresses.map(a => `
    <div class="address-item">
      <div>
        <span class="address-label-tag">
          ${a.label}${a.is_default == 1 ? ' <span class="default-tag">★ Default</span>' : ''}
        </span>
        <div class="address-text">${a.street}, ${a.barangay}, ${a.city}</div>
      </div>
      <div style="display:flex;gap:.5rem">
        <button class="btn-outline btn-sm" onclick="editAddress(${a.address_id})">Edit</button>
        <button class="btn-danger btn-sm" onclick="deleteAddress(${a.address_id})">Remove</button>
      </div>
    </div>`).join('');
}

/** Populate and show the edit form pre-filled with the selected address data. */
async function editAddress(addressId) {
  const addr = state.savedAddresses.find(a => a.address_id == addressId);
  if (!addr) { toast('Address not found. Please refresh.', 'error'); return; }

  document.getElementById('eaf-id').value        = addr.address_id;
  document.getElementById('eaf-label').value     = addr.label     || 'Home';
  document.getElementById('eaf-street').value    = addr.street    || '';
  await setAddressDropdowns('eaf-city', 'eaf-barangay', addr.city || 'Legazpi City', addr.barangay_id || '');
  document.getElementById('eaf-province').value  = addr.province  || 'Albay';
  document.getElementById('eaf-default').checked = addr.is_default == 1;

  // Hide add form if open, show edit form
  document.getElementById('address-form').style.display      = 'none';
  document.getElementById('edit-address-form').style.display = 'block';
}

async function submitEditAddress() {
  if (!state.user) return;
  const addrId          = parseInt(document.getElementById('eaf-id').value);
  const label           = document.getElementById('eaf-label').value.trim()  || 'Home';
  const street          = document.getElementById('eaf-street').value.trim();
  const bgyEl           = document.getElementById('eaf-barangay');
  const cityEl          = document.getElementById('eaf-city');
  const barangay_id     = parseInt(bgyEl?.value) || 0;
  const municipality_id = parseInt(cityEl?.options[cityEl.selectedIndex]?.dataset.municipalityId ?? 0) || 0;
  const is_def          = document.getElementById('eaf-default')?.checked ? 1 : 0;

  if (!street || !barangay_id) { toast('Street and barangay are required.', 'error'); return; }

  const data = await apiFetch(apiUrl('update_address'), {
    method: 'POST',
    body:   JSON.stringify({
      user_id: state.user.user_id, address_id: addrId,
      label, street, barangay_id, municipality_id, is_default: is_def,
    }),
  });

  if (data.success) {
    state.savedAddresses = data.data.addresses || [];
    renderAddresses(state.savedAddresses);
    document.getElementById('edit-address-form').style.display = 'none';
    toast('Address updated! 📍', 'success');
  } else {
    toast(data.message || 'Could not update address.', 'error');
  }
}

async function saveProfile() {
  if (!state.user) return;
  const first = document.getElementById('pf-first').value.trim();
  const last  = document.getElementById('pf-last').value.trim();
  const phone = document.getElementById('pf-phone').value.trim();
  const data  = await apiFetch(apiUrl('update_profile'), {
    method: 'POST',
    body:   JSON.stringify({ user_id: state.user.user_id, first_name: first, last_name: last, phone }),
  });
  if (data.success) {
    state.user.first_name = first; state.user.last_name = last; state.user.phone = phone;
    toast('Profile updated! ✓', 'success');
  } else { toast(data.message, 'error'); }
}

/** [NEW] Change password handler */
async function changePassword() {
  if (!state.user) return;
  const current  = document.getElementById('sec-current').value;
  const newPass  = document.getElementById('sec-new').value;
  const confirm  = document.getElementById('sec-confirm').value;
  const errEl    = document.getElementById('sec-error');
  errEl.style.display = 'none';

  if (!current || !newPass || !confirm) {
    errEl.textContent   = 'Please fill in all fields.';
    errEl.style.display = 'block';
    return;
  }
  if (newPass !== confirm) {
    errEl.textContent   = 'New passwords do not match.';
    errEl.style.display = 'block';
    return;
  }
  if (newPass.length < 8) {
    errEl.textContent   = 'New password must be at least 8 characters.';
    errEl.style.display = 'block';
    return;
  }

  const data = await apiFetch(apiUrl('change_password'), {
    method: 'POST',
    body:   JSON.stringify({ user_id: state.user.user_id, current_password: current, new_password: newPass }),
  });

  if (data.success) {
    toast('Password changed successfully! 🔒', 'success');
    document.getElementById('sec-current').value = '';
    document.getElementById('sec-new').value     = '';
    document.getElementById('sec-confirm').value = '';
  } else {
    errEl.textContent   = data.message;
    errEl.style.display = 'block';
  }
}

function showProfileTab(tab, event) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.profile-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('profile-' + tab + '-tab').classList.add('active');
  if (event) event.currentTarget.classList.add('active');
}

function showAddressForm() {
  initMunicipalitySelect('af-city', 'af-barangay'); document.getElementById('address-form').style.display = 'block'; }

async function submitAddress() {
  if (!state.user) return;
  const label           = document.getElementById('af-label').value.trim()  || 'Home';
  const street          = document.getElementById('af-street').value.trim();
  const bgyEl           = document.getElementById('af-barangay');
  const cityEl          = document.getElementById('af-city');
  const barangay_id     = parseInt(bgyEl?.value) || 0;
  const municipality_id = parseInt(cityEl?.options[cityEl.selectedIndex]?.dataset.municipalityId ?? 0) || 0;
  const is_def          = document.getElementById('af-default')?.checked ? 1 : 0;
  if (!street || !barangay_id) { toast('Please fill in street and barangay.', 'error'); return; }
  const data = await apiFetch(apiUrl('add_address'), {
    method: 'POST',
    body:   JSON.stringify({ user_id: state.user.user_id, label, street, barangay_id, municipality_id, is_default: is_def }),
  });
  if (data.success) {
    renderAddresses(data.data.addresses);
    document.getElementById('address-form').style.display = 'none';
    ['af-label','af-street'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    ['af-city','af-barangay'].forEach(id => { const el = document.getElementById(id); if(el) el.selectedIndex=0; });
    toast('Address added! 📍', 'success');
  } else { toast(data.message, 'error'); }
}

async function deleteAddress(addressId) {
  if (!state.user || !confirm('Remove this address?')) return;
  const data = await apiFetch(apiUrl('delete_address'), {
    method: 'POST',
    body:   JSON.stringify({ user_id: state.user.user_id, address_id: addressId }),
  });
  if (data.success) { renderAddresses(data.data.addresses); toast('Address removed.', ''); }
  else { toast(data.message || 'Could not remove address.', 'error'); }
}

