// fulfillment/orderPolling.js — fulfillment portal: active order polling for cancellations and customer edits
'use strict';

/* ════════════════════════════════════════════════════════════
   ACTIVE ORDER POLLING — cancellations + customer edits
═══════════════════════════════════════════════════════════════*/

function startActiveOrderPoll() {
  pollActiveOrders();
  session.pollTimer = setInterval(pollActiveOrders, POLL_INTERVAL_MS);
}

async function pollActiveOrders() {
  const data = await apiGet('notifications_poll');
  if (!data.success || !data.data?.length) return;

  const cancelAlerts = [];
  const editAlerts   = [];

  data.data.forEach(c => {
    const key = c.log_id || c.notification_id;
    if (!key || session.seenCancels.has(key)) return;
    session.seenCancels.add(key);
    if (c.type === 'order_edited' || c.event === 'order_edited') {
      editAlerts.push(c);
    } else {
      cancelAlerts.push(c);
    }
  });

  if (cancelAlerts.length) {
    updateNotifBell(cancelAlerts.length);
    renderCancelNotifPanel(cancelAlerts);
    showCancelOverlay(
      `Stop: Order #${cancelAlerts[0].order_number || 'Unknown'} has been cancelled.`);
  }

  if (editAlerts.length) {
    updateNotifBell(editAlerts.length);
    appendEditNotifPanel(editAlerts);
    applyEditBadgesToQueue(editAlerts);
  }
}

function appendEditNotifPanel(alerts) {
  const body = document.getElementById('notif-panel-body');
  if (!body) return;
  // Remove the placeholder text if present
  const placeholder = body.querySelector('p');
  if (placeholder) placeholder.remove();
  body.insertAdjacentHTML('afterbegin', alerts.map(a => `
    <div class="notif-panel-item notif-panel-item--edit">
      <span class="notif-panel-icon">✏️</span>
      <div>
        <strong>Order #${escHtml(a.order_number)} Updated by Customer</strong>
        <div style="font-size:.8rem;color:var(--text-muted)">
          ${escHtml(a.reason || 'Delivery date or time slot was changed')}
          · ${fmtDateTime(a.created_at)}
        </div>
      </div>
    </div>`).join(''));
}

function applyEditBadgesToQueue(alerts) {
  alerts.forEach(a => {
    if (!a.order_id) return;

    // Stamp the badge on the card if it is currently rendered
    const checkbox = document.querySelector(`.queue-checkbox[data-order-id="${a.order_id}"]`);
    const card     = checkbox?.closest('.queue-card');
    if (card && !card.querySelector('.queue-edit-badge')) {
      const badge = document.createElement('span');
      badge.className   = 'queue-edit-badge';
      badge.textContent = '✏️ Updated';
      badge.setAttribute('aria-label', 'Order updated by customer');
      badge.style.cssText =
        'background:var(--orange,#f59e0b);color:#fff;font-size:.7rem;' +
        'font-weight:700;padding:.15rem .45rem;border-radius:99px;margin-left:.4rem';
      card.querySelector('.queue-card-header')?.appendChild(badge);
    }

    // Patch the cached order so re-renders reflect the new date/slot
    const cached = session.orders.queue.find(o => o.order_id === a.order_id);
    if (cached) {
      if (a.new_delivery_date) cached.delivery_date = a.new_delivery_date;
      if (a.new_slot_label)    cached.slot_label    = a.new_slot_label;
    }
  });
}

function showCancelOverlay(msg) {
  document.getElementById('cancel-overlay-msg').textContent = msg;
  document.getElementById('cancel-overlay').style.display   = 'flex';
}

function dismissCancelOverlay() {
  document.getElementById('cancel-overlay').style.display = 'none';
}

function updateNotifBell(count) {
  const badge = document.getElementById('notif-bell-badge');
  if (!badge) return;
  if (count > 0) {
    const prev = parseInt(badge.textContent) || 0;
    badge.textContent = prev + count;
    badge.style.display = 'block';
  }
}

function resetNotifBell() {
  const badge = document.getElementById('notif-bell-badge');
  if (badge) badge.style.display = 'none';
}

function renderCancelNotifPanel(alerts) {
  const body = document.getElementById('notif-panel-body');
  if (!body) return;
  body.innerHTML = alerts.map(a => `
    <div class="notif-panel-item">
      <span class="notif-panel-icon">🚨</span>
      <div>
        <strong>Order #${escHtml(a.order_number)} Cancelled</strong>
        <div style="font-size:.8rem;color:var(--text-muted)">
          ${escHtml(a.reason || '')} · ${fmtDateTime(a.created_at)}
        </div>
      </div>
    </div>`).join('');
}

function toggleNotifPanel() {
  const p = document.getElementById('notif-panel');
  if (!p) return;
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

function dismissAllAlerts() {
  const panel = document.getElementById('notif-panel');
  if (panel) panel.style.display = 'none';
  resetNotifBell();
}

