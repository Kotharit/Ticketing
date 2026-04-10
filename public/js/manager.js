/**
 * Manager dashboard — ticket directory (grouped by location), requisition creation, finance table.
 *
 * The ticket directory mirrors the admin's location-based layout:
 * tickets are grouped by building/location with styled header bars
 * showing the building name and ticket count, sorted by urgency within each group.
 */
if (!window.__managerPendingOverrides) window.__managerPendingOverrides = {};

// Holds selected proof photos keyed by ticket ID so they survive list re-renders.
const vendorProofFiles = {};

function handleProofFile(ticketId, file) {
  if (!file) return;
  vendorProofFiles[ticketId] = file;

  const preview = document.getElementById('proof-preview-' + ticketId);
  const btn     = document.getElementById('confirm-btn-' + ticketId);
  if (!preview || !btn) return;

  const url = URL.createObjectURL(file);
  preview.innerHTML = '<img src="' + url + '" style="width:64px;height:64px;object-fit:cover;border-radius:6px;margin-bottom:6px" />';
  btn.disabled = false;
  btn.style.opacity = '1';
}

async function confirmVendor(ticketId) {
  const file = vendorProofFiles[ticketId];
  if (!file) { alert('Please upload a proof photo first.'); return; }

  const req = allRequisitions.find(r => r.ticket_id === ticketId);
  if (!req) return;

  const formData = new FormData();
  formData.append('manager_name', currentManagerName);
  formData.append('proof', file);

  showLoading();
  try {
    await api('/api/requisitions/' + req.ticket_id + '/confirm_vendor', {
      method: 'PUT',
      body: formData
    });
    delete vendorProofFiles[ticketId];
    renderManagerTickets();
  } catch (e) {
    alert('Failed to confirm: ' + e.message);
    hideLoading();
  }
}

function filterManagerTickets(filter) {
  currentManagerFilter = filter;
  renderManagerTickets();
}

async function renderManagerTickets() {
  const container = document.getElementById('manager-tickets-list');

  try {
    showLoading();
    const [tickets, requisitions] = await Promise.all([
      api('/api/tickets'),
      api('/api/requisitions')
    ]);

    // Keep in-flight local overrides from being overwritten by stale fetch responses.
    tickets.forEach(t => {
      const pending = window.__managerPendingOverrides[t.id];
      if (pending) {
        t.urgency = pending.urgency;
        t.urgencyOverridden = true;
      }
    });
    allTickets = tickets;
    allRequisitions = requisitions;

    if (!allTickets.length) {
      container.innerHTML = '<div class="no-tickets">No tickets found.</div>';
      return;
    }

    // Count stats across ALL tickets (independent of active filter/search)
    const reqMap = {};
    allRequisitions.forEach(r => reqMap[r.ticket_id] = r);

    const stats = { pending: 0, awaiting: 0, approved: 0, rejected: 0 };
    allTickets.forEach(tk => {
      const req = reqMap[tk.id];
      if (!req) stats.pending++;
      else if (req.admin_approval === 'Approved') stats.approved++;
      else if (req.admin_approval === 'Rejected') stats.rejected++;
      else stats.awaiting++;
    });

    document.getElementById('mgr-stat-pending').textContent = stats.pending;
    document.getElementById('mgr-stat-awaiting').textContent = stats.awaiting;
    document.getElementById('mgr-stat-approved').textContent = stats.approved;
    document.getElementById('mgr-stat-rejected').textContent = stats.rejected;
    document.getElementById('manager-directory-title').textContent = currentManagerFilter + ' Tickets Directory';

    const search = (document.getElementById('mgr-search') ? document.getElementById('mgr-search').value : '').toLowerCase();
    applyFilterAndRender(container, allTickets, allRequisitions, currentManagerFilter, search);

  } catch (e) {
    container.innerHTML = '<div class="no-tickets">Failed to load tickets.</div>';
    console.error('Manager load failed:', e);
  } finally {
    hideLoading();
  }
}

/**
 * Filters tickets by status and search term, groups by building, sorts each group
 * by urgency, and writes the resulting HTML into `container`.
 * Called by both renderManagerTickets (after a fresh fetch) and
 * rerenderManagerTicketsLocal (using existing global state).
 */
function applyFilterAndRender(container, tickets, requisitions, filter, search) {
  const reqMap = {};
  requisitions.forEach(r => reqMap[r.ticket_id] = r);

  const filtered = tickets.filter(tk => {
    const req = reqMap[tk.id];
    let passesFilter = false;
    if (filter === 'Pending' && !req) passesFilter = true;
    if (filter === 'Awaiting Admin' && req && req.admin_approval === 'Pending') passesFilter = true;
    if (filter === 'Approved' && req && req.admin_approval === 'Approved') passesFilter = true;
    if (filter === 'Rejected' && req && req.admin_approval === 'Rejected') passesFilter = true;
    if (filter === 'All') passesFilter = true;
    if (!passesFilter) return false;
    if (search) {
      return tk.tenantName.toLowerCase().includes(search) ||
        tk.location.toLowerCase().includes(search) ||
        tk.type.toLowerCase().includes(search) ||
        tk.id.toLowerCase().includes(search);
    }
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = '<div class="no-tickets">No tickets match the current filter.</div>';
    return;
  }

  const byBuilding = {};
  filtered.forEach(tk => {
    const building = tk.location.split(',')[0].trim();
    if (!byBuilding[building]) byBuilding[building] = [];
    byBuilding[building].push(tk);
  });

  container.innerHTML = Object.keys(byBuilding).sort().map(building => {
    const bTickets = byBuilding[building];
    bTickets.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
    const cards = bTickets.map(tk => renderManagerTicketCard(tk, reqMap[tk.id])).join('');
    return '<div class="admin-section">' +
      '<div class="admin-building-header">' +
      '<span>📍 ' + esc(building) + '</span>' +
      '<span style="font-size:11px;opacity:0.8">' + bTickets.length + ' ticket' + (bTickets.length > 1 ? 's' : '') + '</span>' +
      '</div>' + cards + '</div>';
  }).join('');
  feather.replace();
}

/**
 * Re-renders from existing allTickets/allRequisitions WITHOUT re-fetching.
 * Prevents the race condition where a stale fetch overwrites a local urgency override.
 */
function rerenderManagerTicketsLocal() {
  const container = document.getElementById('manager-tickets-list');
  if (!allTickets.length) {
    container.innerHTML = '<div class="no-tickets">No tickets found.</div>';
    return;
  }
  const search = (document.getElementById('mgr-search') ? document.getElementById('mgr-search').value : '').toLowerCase();
  applyFilterAndRender(container, allTickets, allRequisitions, currentManagerFilter, search);
}

/* === Vendor Confirmation === */

function vendorConfirmHtml(ticketId, req) {
  if (!req || req.admin_approval !== 'Approved') return '';

  if (req.vendor_confirmed) {
    const proofThumb = req.vendor_proof && req.vendor_proof.length
      ? '<img src="/api/attachments/' + req.vendor_proof[0].id + '" ' +
        'onclick="openLightbox(\'/api/attachments/' + req.vendor_proof[0].id + '\')" ' +
        'style="width:36px;height:36px;object-fit:cover;border-radius:6px;cursor:pointer;flex-shrink:0;margin-left:auto" />'
      : '';
    return '<div style="display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 12px;' +
      'background:rgba(59,109,17,0.06);border-radius:8px;border:1px solid rgba(59,109,17,0.2)">' +
      '<span class="badge-sleek verified">✓ Vendor Confirmed</span>' +
      '<span style="font-size:11px;color:var(--c-muted)">' + esc(req.vendor_confirmed_by) + ' · ' + esc(req.vendor_confirmed_at) + '</span>' +
      proofThumb + '</div>';
  }

  const existingFile = vendorProofFiles[ticketId];
  const previewHtml = existingFile
    ? '<img src="' + URL.createObjectURL(existingFile) + '" style="width:52px;height:52px;object-fit:cover;border-radius:6px;margin-bottom:8px" />'
    : '';
  const confirmDisabled = existingFile ? '' : 'disabled';

  return '<div style="margin-top:10px;padding:10px 12px;background:var(--c-gray-bg);border-radius:8px;border:1px solid rgba(0,0,0,0.07)">' +
    '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--c-muted);margin-bottom:8px">Mark Vendor Complete</div>' +
    '<input type="file" id="proof-input-' + ticketId + '" accept="image/*" style="display:none" ' +
    'onchange="handleProofFile(\'' + ticketId + '\', this.files[0])" />' +
    '<div id="proof-preview-' + ticketId + '">' + previewHtml + '</div>' +
    '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
    '<button class="btn-sm blue" style="display:inline-flex;align-items:center;gap:5px" onclick="document.getElementById(\'proof-input-' + ticketId + '\').click()">' +
    '<i data-feather="camera" style="width:11px;height:11px"></i> Upload Photo</button>' +
    '<button class="btn-sm confirm" id="confirm-btn-' + ticketId + '" ' + confirmDisabled + ' ' +
    'onclick="confirmVendor(\'' + ticketId + '\')" style="display:inline-flex;align-items:center;gap:5px">' +
    '<i data-feather="check-circle" style="width:11px;height:11px"></i> Confirm Completion</button>' +
    '</div></div>';
}

/* === Manager Ticket Card === */

function renderManagerTicketCard(tk, req) {
  const urgencyLabel = tk.urgency.charAt(0).toUpperCase() + tk.urgency.slice(1);
  const overrideTag = tk.urgencyOverridden ? '<span class="override-tag">manually set</span>' : '';

  let reqHtml = '';
  if (req) {
    const badgeClass = req.admin_approval === 'Approved' ? 'badge-low'
      : req.admin_approval === 'Rejected' ? 'badge-critical'
        : 'b-open';

    reqHtml = '<div style="margin-top:8px;background:#fff;padding:10px;border-radius:8px;border:1px solid #ddd;font-size:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
      '<strong style="color:#185FA5">Requisition</strong>' +
      '<span class="urgency-badge ' + badgeClass + '">' + esc(req.admin_approval) + '</span>' +
      '</div>' +
      '<div style="color:#555">Est. Cost: ₹' + esc(req.est_cost || '0') + ' · ' +
      (req.in_house_fix ? 'In-house fix' : 'Vendor: ' + esc(req.vendor_name)) + '</div>' +
      (req.cost_breakdown ? '<div style="margin-top:4px;color:var(--c-muted);white-space:pre-line;font-size:11px">' + esc(req.cost_breakdown) + '</div>' : '') +
      (req.admin_remarks ? '<div style="font-style:italic;color:var(--c-muted);margin-top:4px;border-left:3px solid var(--c-yellow);padding-left:8px">Admin: ' + esc(req.admin_remarks) + '</div>' : '') +
      (req.invoices && req.invoices.length ? '<div class="attach-strip" style="margin-top:6px">' + req.invoices.map(a =>
        '<div class="attach-thumb" onclick="openLightbox(\'/api/attachments/' + a.id + '\')"><img src="/api/attachments/' + a.id + '" loading="lazy" /></div>'
      ).join('') + '</div>' : '') +
      vendorConfirmHtml(tk.id, req) +
      '</div>';
  } else {
    reqHtml = '<button class="btn-sm blue" style="margin-top:8px" onclick="openRequisition(\'' + tk.id + '\')">Create Requisition</button>';
  }

  // Urgency override only available before a requisition is submitted
  let overrideDropdown = '';
  if (!req) {
    overrideDropdown =
      '<select class="admin-status-select" style="font-size:10px;padding:2px 5px" onchange="overrideUrgency(\'' + tk.id + '\',this.value)">' +
      '<option value="">Override…</option>' +
      ['critical', 'high', 'medium', 'low'].map(u =>
        '<option value="' + u + '"' + (tk.urgency === u && tk.urgencyOverridden ? ' selected' : '') + '>' + u.charAt(0).toUpperCase() + u.slice(1) + '</option>'
      ).join('') +
      '</select>';
  }

  return '<div class="admin-ticket urgency-' + tk.urgency + '">' +
    '<div class="admin-ticket-top"><div>' +
    '<div class="admin-ticket-id">' + tk.id + ' · ' + tk.time + '</div>' +
    '<div class="admin-ticket-type">' + esc(tk.type) + '</div>' +
    '</div>' +
    '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
    '<select class="admin-status-select" onchange="updateStatus(\'' + tk.id + '\',this.value)">' +
    '<option value="open"' + (tk.status === 'open' ? ' selected' : '') + '>Open</option>' +
    '<option value="progress"' + (tk.status === 'progress' ? ' selected' : '') + '>In Progress</option>' +
    '<option value="resolved"' + (tk.status === 'resolved' ? ' selected' : '') + '>Resolved</option>' +
    '</select>' +
    '<div style="display:flex;align-items:center;gap:4px">' +
    '<span class="urgency-badge badge-' + tk.urgency + '">' + urgencyLabel + '</span>' + overrideTag +
    overrideDropdown +
    '</div>' +
    '</div></div>' +
    '<div class="admin-ticket-detail"><strong>Tenant:</strong> ' + esc(tk.tenantName) + ' · <strong>Unit:</strong> Wing ' + esc(tk.wing || '') + ', Flat ' + esc(tk.flat || '') + '</div>' +
    '<div class="admin-ticket-detail" style="color:#888;font-style:italic;margin-top:4px">' + esc(tk.desc) + '</div>' +
    reqHtml +
    '</div>';
}

/* === Ticket Actions === */

async function overrideUrgency(id, urgency) {
  if (!urgency) return;

  const existingReq = allRequisitions.find(r => r.ticket_id === id);
  if (existingReq) {
    alert('Cannot override criticality — a requisition has already been submitted for this ticket.');
    return;
  }

  const tk = allTickets.find(t => t.id === id);
  const previousUrgency = tk ? tk.urgency : null;
  const previousOverridden = tk ? !!tk.urgencyOverridden : false;

  if (tk) {
    tk.urgency = urgency;
    tk.urgencyOverridden = true;
    window.__managerPendingOverrides[id] = { urgency };
    rerenderManagerTicketsLocal();
  }

  try {
    await api('/api/tickets/' + id + '/urgency', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urgency })
    });
    delete window.__managerPendingOverrides[id];
    renderManagerTickets();
  } catch (e) {
    const currentTk = allTickets.find(t => t.id === id);
    if (currentTk) {
      currentTk.urgency = previousUrgency;
      currentTk.urgencyOverridden = previousOverridden;
    }
    delete window.__managerPendingOverrides[id];
    rerenderManagerTicketsLocal();
    console.error('Urgency sync failed:', e);
    alert('Failed to sync urgency override. Reverting to previous state.');
  }
}

/* === Status Update === */

async function updateStatus(id, status) {
  const tk = allTickets.find(t => t.id === id);
  if (!tk) return;

  const prevStatus = tk.status;
  tk.status = status;
  rerenderManagerTicketsLocal();

  try {
    await api('/api/tickets/' + id + '/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    renderManagerTickets();
  } catch (e) {
    console.error('Status sync failed:', e);
    tk.status = prevStatus;
    rerenderManagerTicketsLocal();
    alert('Failed to update status. Please check your connection.');
  }
}

/* === Requisition Form === */

function openRequisition(ticketId) {
  currentRequisitionTicket = allTickets.find(t => t.id === ticketId);
  if (!currentRequisitionTicket) return;

  document.getElementById('req-ticket-id').textContent = ticketId;
  document.getElementById('req-issue-desc').textContent = currentRequisitionTicket.type;
  document.getElementById('req-issue-loc').textContent = currentRequisitionTicket.location;

  document.getElementById('req-surveyed').value = 'true';
  document.getElementById('req-in-house').value = 'false';
  document.getElementById('req-vendor-name').value = '';
  document.getElementById('req-est-cost').value = '';
  document.getElementById('req-finance-body').innerHTML =
    '<tr><td><input type="text" class="finance-input" placeholder="Labor / Diagnostic" oninput="calcFinanceTable()" /></td>' +
    '<td><input type="number" class="finance-input amount" placeholder="0" oninput="calcFinanceTable()" /></td>' +
    '<td style="text-align:right"><button class="btn-sm" style="padding:4px 8px; border:none; background:none; color:var(--c-red)" onclick="removeFinanceRow(this)"><i data-feather="trash-2" style="width:14px"></i></button></td></tr>';

  reqSelectedFiles = [];
  document.getElementById('req-preview-strip').innerHTML = '';
  toggleRequisitionVendor();
  goTo('page-requisition');
  feather.replace();
}

/* === Finance Table === */

function calcFinanceTable() {
  let total = 0;
  document.querySelectorAll('#req-finance-body tr').forEach(row => {
    const amount = parseFloat(row.querySelector('.finance-input.amount').value) || 0;
    total += amount;
  });
  document.getElementById('req-est-cost').value = total.toFixed(2);
}

function addFinanceRow() {
  const tr = document.createElement('tr');
  tr.innerHTML =
    '<td><input type="text" class="finance-input" placeholder="Part details..." oninput="calcFinanceTable()" /></td>' +
    '<td><input type="number" class="finance-input amount" placeholder="0" oninput="calcFinanceTable()" /></td>' +
    '<td style="text-align:right"><button class="btn-sm" style="padding:4px 8px; border:none; background:none; color:var(--c-red)" onclick="removeFinanceRow(this)"><i data-feather="trash-2" style="width:14px"></i></button></td>';
  document.getElementById('req-finance-body').appendChild(tr);
  feather.replace();
}

function removeFinanceRow(btn) {
  btn.closest('tr').remove();
  calcFinanceTable();
}

function toggleRequisitionVendor() {
  const isInHouse = document.getElementById('req-in-house').value === 'true';
  const vendorSection = document.getElementById('req-vendor-section');
  if (isInHouse) {
    vendorSection.style.display = 'none';
    document.getElementById('req-est-cost').value = '0';
  } else {
    vendorSection.style.display = 'block';
  }
}

async function submitRequisition() {
  if (!currentRequisitionTicket) return;

  const errorEl = document.getElementById('req-error');
  errorEl.style.display = 'none';

  const isInHouse = document.getElementById('req-in-house').value === 'true';
  const vendorName = document.getElementById('req-vendor-name').value.trim();
  const estCost = document.getElementById('req-est-cost').value;

  if (!isInHouse && (!vendorName || !estCost)) {
    errorEl.style.display = 'block';
    errorEl.textContent = 'Please fill in the Vendor Name and complete the Cost Breakdown table.';
    return;
  }

  let breakdownStr = '';
  document.querySelectorAll('#req-finance-body tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0].value.trim() !== '') {
      breakdownStr += inputs[0].value.trim() + ': ₹' + (inputs[1].value || '0') + '\n';
    }
  });

  const formData = new FormData();
  formData.append('ticket_id', currentRequisitionTicket.id);
  formData.append('surveyed', document.getElementById('req-surveyed').value);
  formData.append('in_house_fix', document.getElementById('req-in-house').value);

  if (!isInHouse) {
    formData.append('vendor_name', vendorName);
    formData.append('est_cost', estCost);
    formData.append('cost_breakdown', breakdownStr);
    reqSelectedFiles.forEach(f => formData.append('invoices[]', f));
  } else {
    formData.append('est_cost', '0');
  }

  try {
    showLoading();
    await api('/api/requisitions', { method: 'POST', body: formData });
    goTo('page-manager');
  } catch (e) {
    alert('Failed: ' + e.message);
  } finally {
    hideLoading();
  }
}
