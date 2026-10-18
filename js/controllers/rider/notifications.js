// rider/notifications.js — rider portal: notifications
'use strict';

/* ════════════════════════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════════════════════════*/

async function pollNotifications() {
  const res = await apiGet('notifications', { limit: 20 });
  if (!res.success) return;

  const badge = document.getElementById('notif-badge');
  if (badge) {
    const count = res.unread || 0;
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.hidden      = count === 0;
    badge.setAttribute('aria-label', count > 0 ? `${count} unread notifications` : '');
  }

  rSession.notifications = res.data || [];
}

function toggleNotifPanel() {
  const panel = document.getElementById('rider-notif-panel');
  const btn   = document.getElementById('rider-notif-btn');
  const isOpen = !panel.hidden;

  panel.hidden = isOpen;
  btn.setAttribute('aria-expanded', String(!isOpen));

  if (!isOpen) renderNotifPanel();
}

function renderNotifPanel() {
  const list  = document.getElementById('notif-panel-list');
  const items = rSession.notifications || [];

  if (!items.length) {
    list.innerHTML = `<div class="notif-empty">No notifications yet.</div>`;
    return;
  }

  list.innerHTML = items.map(n => `
    <div class="notif-item${n.is_read == 1 ? ' read' : ''}" data-id="${n.notification_id}">
      <p class="notif-msg">${escHtml(n.message)}</p>
      <time class="notif-time">${fmtDateTime(n.created_at)}</time>
    </div>`).join('');
}

async function markAllNotifsRead() {
  await apiPost('mark_notif_read', { notification_id: 0 });
  await pollNotifications();
  renderNotifPanel();
}

// Close notification panel when clicking outside
document.addEventListener('click', (e) => {
  const panel = document.getElementById('rider-notif-panel');
  const btn   = document.getElementById('rider-notif-btn');
  if (panel && !panel.hidden && !panel.contains(e.target) && !btn?.contains(e.target)) {
    panel.hidden = true;
    btn?.setAttribute('aria-expanded', 'false');
  }
});

