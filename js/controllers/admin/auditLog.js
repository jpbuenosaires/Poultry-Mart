// admin/auditLog.js — admin portal: audit log page
'use strict';

/* ════════════════════════════════════════════════════════════
   AUDIT LOG
═══════════════════════════════════════════════════════════════*/

const auditState = { page: 1, action: '', entity: '', from: '', to: '' };

async function loadAuditLog() {
  setLoading('audit-table-wrap', 'Loading audit log…');
  const params = {
    page: auditState.page,
    action_filter: auditState.action,
    entity_type: auditState.entity,
    date_from: auditState.from,
    date_to: auditState.to,
  };
  const res = await apiGet('audit_log', params);
  if (!res.success) { document.getElementById('audit-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderAuditTable(res.data);
}

function renderAuditTable(res) {
  const wrap = document.getElementById('audit-table-wrap');
  const logs = res.logs || [];
  if (!logs.length) { wrap.innerHTML = emptyStateHTML('📋', 'No Logs', 'No audit records found.'); document.getElementById('audit-pagination').innerHTML = ''; return; }
  const rows = logs.map(l => {
    const detailShort = (l.details || '').slice(0, 100);
    const hasMore = (l.details || '').length > 100;
    return `<tr>
      <td>${fmtDateTime(l.created_at)}</td>
      <td>${escHtml(l.actor_name || `User #${l.user_id}`)}</td>
      <td><code>${escHtml(l.action)}</code></td>
      <td>${escHtml(l.entity_type)}</td>
      <td>${escHtml(l.entity_id)}</td>
      <td class="audit-detail">
        <span id="audit-short-${l.log_id}">${escHtml(detailShort)}${hasMore ? '…' : ''}</span>
        ${hasMore ? `<button class="link-btn" id="audit-toggle-${l.log_id}" onclick="expandAuditRow(${l.log_id}, '${encodeURIComponent(l.details)}')">more</button><span id="audit-full-${l.log_id}" hidden>${escHtml(l.details)}</span>` : ''}
      </td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Details</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  renderPagination('audit-pagination', auditState.page, res.pages || 1, (p) => {
    auditState.page = p;
    loadAuditLog();
  });
}

function expandAuditRow(logId, encodedDetail) {
  const shortEl = document.getElementById(`audit-short-${logId}`);
  const fullEl = document.getElementById(`audit-full-${logId}`);
  const toggleEl = document.getElementById(`audit-toggle-${logId}`);
  if (!fullEl) return;
  const isExpanded = !fullEl.hidden;   // true  → currently open, about to collapse
  fullEl.hidden = isExpanded;
  if (shortEl) shortEl.hidden = !isExpanded;
  if (toggleEl) toggleEl.textContent = isExpanded ? 'more' : 'less';
}

function filterAuditLog() {
  auditState.page = 1;
  auditState.action = document.getElementById('audit-action-filter')?.value.trim() || '';
  auditState.entity = document.getElementById('audit-entity-filter')?.value.trim() || '';
  auditState.from = document.getElementById('audit-date-from')?.value || '';
  auditState.to = document.getElementById('audit-date-to')?.value || '';
  loadAuditLog();
}

function exportAuditLogCSV() {
  const params = new URLSearchParams({
    action_filter: auditState.action,
    entity_type: auditState.entity,
    date_from: auditState.from,
    date_to: auditState.to,
    export: 1
  });
  window.open('/api/admin_api.php?action=audit_log&' + params.toString(), '_blank');
}

