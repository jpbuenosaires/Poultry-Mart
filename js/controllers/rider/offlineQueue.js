// rider/offlineQueue.js — rider portal: offline delivery queue
'use strict';

/* ── Offline delivery queue ─────────────────────────────── */

const OFFLINE_QUEUE_KEY = 'rider_offline_queue';

function offlineQueueAdd(action, payload) {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  queue.push({ action, payload, ts: Date.now() });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

async function offlineQueueSync() {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  if (!queue.length) return;
  const remaining = [];
  for (const item of queue) {
    try {
      const res = await apiPost(item.action, item.payload);
      // Only keep in queue if it failed due to a network error. Drop business-logic rejections.
      if (!res.success && res._network) remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  if (remaining.length < queue.length) {
    toast(`Synced ${queue.length - remaining.length} offline action(s). ✅`, 'success');
    refreshCurrentPage();
    loadDashboard();
  }
}

window.addEventListener('online', offlineQueueSync);

