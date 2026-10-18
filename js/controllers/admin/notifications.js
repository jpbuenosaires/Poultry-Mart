// admin/notifications.js — admin portal: notifications page
'use strict';

/* ════════════════════════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════════════════════════*/

async function loadNotifications() {
  document.getElementById('notif-send-area').style.display = '';
  const wrap = document.getElementById('notif-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = spinnerHTML();
  const res = await apiGet('notifications_poll');
  const items = res.success ? (res.data?.data || []) : [];
  if (!items.length) {
    wrap.innerHTML = emptyStateHTML('🔔', 'All Clear', 'No unread alerts.');
    updateNotifBell(0);
    const nb = document.getElementById('nav-badge-notif');
    if (nb) { nb.textContent = ''; nb.style.display = 'none'; }
    return;
  }
  const rows = items.map(n => `<div class="notif-item">
      <div class="notif-item-msg">${escHtml(n.message || n.reason || "")}</div>
      <div class="notif-item-meta">
        ${n.order_number ? `<span class="badge">#${escHtml(n.order_number)}</span>` : ""}
        <span class="text-muted">${fmtDateTime(n.created_at)}</span>
      </div>
    </div>`).join("");
  wrap.innerHTML = `<div class="notif-list">${rows}</div>
    <div style="margin-top:1rem">
      <button class="btn-outline" onclick="dismissAllAlerts()">
        ✓ Mark All as Read</button></div>`;
  session._notifIds = items
    .map(n => n.notification_id).filter(Boolean);
  updateNotifBell(session._notifIds.length);
  const nb = document.getElementById('nav-badge-notif');
  if (nb) {
    nb.textContent = session._notifIds.length > 0 ? session._notifIds.length : '';
    nb.style.display = session._notifIds.length > 0 ? '' : 'none';
  }
}

function openSendNotifModal() {
  document.getElementById('notif-user-id').value = '';
  document.getElementById('notif-message').value = '';
  document.getElementById('notif-type').value = 'general';
  document.getElementById('send-notif-error').style.display = 'none';
  openModal('send-notif-modal', 'notif-modal-close');
}

async function confirmSendNotif() {
  const errEl = document.getElementById('send-notif-error');
  errEl.style.display = 'none';
  const body = {
    user_id: document.getElementById('notif-user-id').value,
    message: document.getElementById('notif-message').value.trim(),
    type: document.getElementById('notif-type').value,
  };
  if (!body.user_id || !body.message) {
    errEl.textContent = 'User ID and message are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('send_notification', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Notification sent.', 'success');
  closeModal('send-notif-modal');
}

function startCancellationPoll() {
  if (session._pollTimer) clearInterval(session._pollTimer);
  pollCancellations();
  session._pollTimer = setInterval(pollCancellations, POLL_INTERVAL_MS);
}

async function pollCancellations() {
  const res = await apiGet('notifications_poll');
  if (!res.success) return;
  const items = res.data?.data || [];
  if (items.length) {
    session._notifIds = items.map(n => n.notification_id).filter(Boolean);
    updateNotifBell(session._notifIds.length);
    // Keep sidebar nav badge in sync with the live poll
    const nb = document.getElementById('nav-badge-notif');
    if (nb) {
      nb.textContent = session._notifIds.length > 0 ? session._notifIds.length : '';
      nb.style.display = session._notifIds.length > 0 ? '' : 'none';
    }
  }
}

function updateNotifBell(count) {
  const bell = document.getElementById('notif-bell');
  const badge = document.getElementById('notif-bell-badge');
  if (!bell || !badge) return;
  badge.textContent = count > 0 ? count : '';
  badge.style.display = count > 0 ? '' : 'none';
  bell.classList.toggle('bell-active', count > 0);
}

async function dismissAllAlerts() {
  if (!session._notifIds.length) return;
  const res = await apiPost('mark_notif_read',
    { notification_ids: session._notifIds });
  if (res.success) {
    session._notifIds = [];
    updateNotifBell(0);
    // Clear sidebar badge too
    const nb = document.getElementById('nav-badge-notif');
    if (nb) { nb.textContent = ''; nb.style.display = 'none'; }
    toast('Notifications cleared.', 'success');
    loadNotifications(); // refresh the empty state
  }
}

