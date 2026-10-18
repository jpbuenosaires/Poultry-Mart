// admin/disputes.js — admin portal: disputes page
'use strict';

/* ════════════════════════════════════════════════════════════
   DISPUTES
═══════════════════════════════════════════════════════════════*/

let _currentDisputeFilter = '';

function setDisputeFilter(status) {
  _currentDisputeFilter = status;
  // Update active pill
  ['all', 'open', 'review', 'resolved', 'rejected'].forEach(id => {
    const el = document.getElementById('btn-dispute-' + id);
    if (el) el.classList.remove('active');
  });
  let activeId = 'all';
  if (status === 'Open') activeId = 'open';
  else if (status === 'Under Review') activeId = 'review';
  else if (status === 'Resolved') activeId = 'resolved';
  else if (status === 'Rejected') activeId = 'rejected';
  
  const activeEl = document.getElementById('btn-dispute-' + activeId);
  if (activeEl) activeEl.classList.add('active');
  
  loadDisputes();
}

async function loadDisputes() {
  setLoading('disputes-table-wrap', 'Loading disputes…');
  const res = await apiGet('disputes', { status: _currentDisputeFilter, limit: 100 });
  if (!res.success) { document.getElementById('disputes-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderDisputesTable(res.data?.disputes || []);
}

function renderDisputesTable(disputes) {
  const wrap = document.getElementById('disputes-table-wrap');
  if (!disputes.length) { wrap.innerHTML = emptyStateHTML('⚖️', 'No Disputes', 'No disputes found.'); return; }
  
  const getBadgeClass = (status) => {
      if (status === 'Open') return 'status-Cancelled'; // Red-ish
      if (status === 'Under Review') return 'status-Assigned'; // Blue-ish
      if (status === 'Resolved') return 'status-Completed'; // Green
      if (status === 'Rejected') return 'status-Pending'; // Gray
      return '';
  };

  const rows = disputes.map(d => `<tr>
    <td><button class="link-btn" onclick="openOrderDetail(${d.order_id})">${escHtml(d.order_number)}</button></td>
    <td>${escHtml((d.first_name || '') + ' ' + (d.last_name || '')).trim() || '—'}</td>
    <td class="dispute-desc">${escHtml(d.description?.slice(0, 80))}${d.description?.length > 80 ? '…' : ''}</td>
    <td><span class="status-badge ${getBadgeClass(d.status)}">${escHtml(d.status)}</span></td>
    <td>${fmtDateTime(d.created_at)}</td>
    <td>
      <button class="btn-action" onclick="openDisputeDetail(${d.dispute_id})">👁 View</button>
      ${(d.status === 'Open' || d.status === 'Under Review') ? `<button class="btn-action btn-action-green" onclick="openUpdateDisputeModal(${d.dispute_id}, '${d.status}')">✎ Update</button>` : ''}
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Order #</th><th>Customer</th><th>Description</th><th>Status</th><th>Filed</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

async function openDisputeDetail(id) {
  document.getElementById('dispute-detail-body').innerHTML = spinnerHTML();
  openModal('dispute-modal', 'dispute-modal-close');
  const res = await apiGet('dispute', { id });
  const d = res.data;
  if (!res.success || !d) { document.getElementById('dispute-detail-body').innerHTML = errorHTML('Not found.'); return; }
  
  const contactInfo = `📱 ${escHtml(d.phone || 'N/A')} &nbsp;|&nbsp; ✉️ ${escHtml(d.email || 'N/A')}`;
  
  document.getElementById('dispute-detail-body').innerHTML = `
    ${detailRow('Order', `<button class="link-btn" onclick="closeModal('dispute-modal'); openOrderDetail(${d.order_id})">${escHtml(d.order_number)}</button>`)}
    ${detailRow('Customer', escHtml((d.first_name || '') + ' ' + (d.last_name || '')).trim() || '—')}
    ${detailRow('Contact', contactInfo)}
    ${detailRow('Filed', fmtDateTime(d.created_at))}
    ${detailRow('Status', d.status)}
    ${detailRow('Description', escHtml(d.description))}
    ${d.evidence_url ? `<div class="detail-info-item"><span class="detail-info-label">Evidence</span><div style="margin-top:.5rem"><img src="${escHtml(d.evidence_url)}" alt="Dispute evidence" style="max-width:100%;max-height:320px;border-radius:6px;border:1px solid var(--border);display:block" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'" /><a href="${escHtml(d.evidence_url)}" target="_blank" class="link-btn" style="display:none">⚠ Image failed to load — open directly ↗</a></div></div>` : ''}
    ${d.resolved_at ? detailRow('Resolved', fmtDateTime(d.resolved_at)) : ''}
    ${d.resolution_notes ? detailRow('Resolution', escHtml(d.resolution_notes)) : ''}
    ${(d.status === 'Open' || d.status === 'Under Review') ? `<div style="margin-top:1rem"><button class="btn-primary" onclick="closeModal('dispute-modal');openUpdateDisputeModal(${d.dispute_id}, '${d.status}')">✎ Update Status</button></div>` : ''}`;
}

let _updateDisputeId = 0;

function openUpdateDisputeModal(id, currentStatus) {
  _updateDisputeId = id;
  const statusEl = document.getElementById('ud-status');
  if (statusEl) statusEl.value = currentStatus === 'Open' ? 'Under Review' : currentStatus;
  document.getElementById('ud-notes').value = '';
  document.getElementById('ud-error').style.display = 'none';
  openModal('update-dispute-modal', 'update-modal-close');
}

async function submitUpdateDispute() {
  const errEl = document.getElementById('ud-error');
  errEl.style.display = 'none';
  const status = document.getElementById('ud-status').value;
  const notes = document.getElementById('ud-notes').value.trim();
  if (!notes) { errEl.textContent = 'Notes are required.'; errEl.style.display = ''; return; }
  
  const res = await apiPost('update_dispute', { dispute_id: _updateDisputeId, status, resolution_notes: notes });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  
  toast('Dispute updated.', 'success');
  closeModal('update-dispute-modal');
  loadDisputes();
  loadSidebarCounts();
}

