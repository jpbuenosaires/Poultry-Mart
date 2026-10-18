// customer/notifications.js — customer portal: customer notification panel
'use strict';

/* ════════════════════════════════════════════════════════════
   NOTIFICATIONS  (unchanged)
═══════════════════════════════════════════════════════════════*/

async function loadNotifications() {
  if (!state.user) return;
  const data = await apiFetch(`${CUSTOMER_API}?action=notifications&user_id=${state.user.user_id}`);
  if (data.success) {
    state.notifications = data.data || [];
    updateNotifBadge(data.unread_count || 0);
    renderNotifList();
  }
}

function updateNotifBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const n = count !== undefined ? count : state.notifications.filter(n => n.is_read == 0).length;
  badge.textContent   = n > 99 ? '99+' : n;
  badge.style.display = n > 0 ? 'flex' : 'none';
}

function renderNotifList() {
  const el = document.getElementById('notif-list');
  if (!el) return;
 
  // [NEW] Apply active type filter
  const filtered = state.notifFilter
    ? state.notifications.filter(n => n.type === state.notifFilter)
    : state.notifications;
 
  if (!filtered.length) {
    el.innerHTML = `<div class="notif-empty">${state.notifFilter ? 'No notifications in this category.' : 'No notifications yet.'}</div>`;
    return;
  }
 
  // Notification types that link to a specific order
  const ORDER_TYPES = new Set(['order_placed','packed','dispatched','final_total','partial_fulfillment','cancelled']);
 
  el.innerHTML = filtered.map(n => {
    const hasOrderLink = ORDER_TYPES.has(n.type) && n.related_order_id;
    const clickAction  = hasOrderLink
      ? `onNotifClick(${n.notification_id}, ${n.related_order_id})`
      : `markOneNotificationRead(${n.notification_id})`;
 
    return `
      <div class="notif-item ${n.is_read == 0 ? 'notif-unread' : ''} ${hasOrderLink ? 'notif-clickable' : ''}"
           onclick="${clickAction}" role="button" tabindex="0"
           onkeydown="if(event.key==='Enter'||event.key===' '){${clickAction}}">
        <div class="notif-icon">${notifTypeIcon(n.type)}</div>
        <div class="notif-body">
          <div class="notif-msg">${escHtml(n.message)}</div>
          <div class="notif-time">${fmtDateTime(n.created_at)}</div>
          ${hasOrderLink ? '<div class="notif-link-hint">Tap to view order →</div>' : ''}
        </div>
        ${n.is_read == 0 ? '<div class="notif-dot"></div>' : ''}
      </div>`;
  }).join('');
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) loadNotifications();
}

async function markOneNotificationRead(notifId) {
  if (!state.user) return;
  await apiFetch(apiUrl('mark_read'), {
    method: 'POST',
    body:   JSON.stringify({ user_id: state.user.user_id, notification_id: notifId }),
  });
  const n = state.notifications.find(n => n.notification_id == notifId);
  if (n) n.is_read = 1;
  updateNotifBadge();
  renderNotifList();
}

async function markAllNotificationsRead() {
  if (!state.user) return;
  await apiFetch(apiUrl('mark_read'), {
    method: 'POST',
    body:   JSON.stringify({ user_id: state.user.user_id }),
  });
  state.notifications.forEach(n => n.is_read = 1);
  updateNotifBadge(0);
  renderNotifList();
}

function setNotifFilter(filter, btn) {
  state.notifFilter = filter;
  document.querySelectorAll('.notif-filter-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderNotifList();
}

async function onNotifClick(notifId, orderId) {
  await markOneNotificationRead(notifId);
  const panel = document.getElementById('notif-panel');
  if (panel) panel.style.display = 'none';
  if (orderId) showOrderDetail(orderId);
}

