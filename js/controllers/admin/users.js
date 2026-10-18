// admin/users.js — admin portal: users page
'use strict';

/* ════════════════════════════════════════════════════════════
   USERS
═══════════════════════════════════════════════════════════════*/

async function loadUsers() {
  setLoading('users-table-wrap', 'Loading users…');
  const role = document.getElementById('user-role-filter')?.value || '';
  const search = document.getElementById('user-search')?.value.trim() || '';
  const status = document.getElementById('user-status-filter')?.value || '';
  const res = await apiGet('users', { role, search, status });
  if (!res.success) { document.getElementById('users-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderUsersTable(res.data || []);
}

function renderUsersTable(users) {
  const wrap = document.getElementById('users-table-wrap');
  if (!users.length) { wrap.innerHTML = emptyStateHTML('👥', 'No Users', 'No users match the filter.'); return; }
  const rows = users.map(u => `<tr>
    <td>${escHtml(u.first_name)} ${escHtml(u.last_name)}</td>
    <td>${escHtml(u.email)}</td>
    <td>${escHtml(u.phone || '—')}</td>
    <td><span class="role-badge">${escHtml(u.role_name)}</span></td>
    <td><span class="status-badge ${u.status === 'active' ? 'status-Completed' : 'status-Cancelled'}">${escHtml(u.status)}</span></td>
    <td>${fmtDate(u.created_at)}</td>
    <td>
      <button class="btn-action" onclick='openUserModal(${JSON.stringify(u)})'>✏️</button>
      <button class="btn-action btn-action-${u.status === 'active' ? 'red' : 'green'}"
        onclick="toggleUserStatus(${u.user_id}, '${escHtml(u.status)}')">${u.status === 'active' ? 'Deactivate' : 'Activate'}</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

let _userId = 0;

function openUserModal(userObj = null) {
  _userId = userObj?.user_id ?? 0;
  document.getElementById('user-modal-title').textContent = _userId ? 'Edit User' : 'Add User';
  document.getElementById('uf-first').value = userObj?.first_name || '';
  document.getElementById('uf-last').value = userObj?.last_name || '';
  document.getElementById('uf-email').value = userObj?.email || '';
  document.getElementById('uf-phone').value = userObj?.phone || '';
  document.getElementById('uf-role').value = userObj?.role_name || 'Customer';
  document.getElementById('uf-password').value = '';
  document.getElementById('uf-password-hint').textContent = _userId
    ? 'Leave blank to keep current password.'
    : 'Password required for new users.';
  document.getElementById('user-form-error').style.display = 'none';
  openModal('user-modal', 'user-modal-close');
}

async function confirmSaveUser() {
  const errEl = document.getElementById('user-form-error');
  errEl.style.display = 'none';
  const body = {
    user_id: _userId,
    first_name: document.getElementById('uf-first').value.trim(),
    last_name: document.getElementById('uf-last').value.trim(),
    email: document.getElementById('uf-email').value.trim(),
    phone: document.getElementById('uf-phone').value.trim(),
    role: document.getElementById('uf-role').value,
    password: document.getElementById('uf-password').value,
  };
  if (!body.first_name || !body.last_name || !body.email || !body.role) {
    errEl.textContent = 'Name, email, and role are required.'; errEl.style.display = ''; return;
  }
  if (!_userId && !body.password) {
    errEl.textContent = 'Password is required for new users.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('save_user', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  if (body.role === 'Delivery Rider') session.riders = [];
  toast(_userId ? 'User updated.' : 'User created.', 'success');
  closeModal('user-modal');
  loadUsers();
}

async function toggleUserStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  if (!confirm(`Set user status to "${newStatus}"?`)) return;
  const res = await apiPost('set_status', { user_id: id, status: newStatus });
  if (!res.success) { toast(res.message, 'error'); return; }
  session.riders = [];
  toast('User status updated.', 'success');
  loadUsers();
}

