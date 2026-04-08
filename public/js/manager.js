/**
 * Manager dashboard — ticket directory, requisition creation, finance table.
 */

function filterManagerTickets(filter) {
  currentManagerFilter = filter;
  renderManagerTickets();
}

function toggleManagerAccordion(urgency) {
  const content = document.getElementById('mgr-acc-' + urgency);
  content.style.display = content.style.display === 'none' ? 'block' : 'none';
}

async function renderManagerTickets() {
  const container = document.getElementById('manager-tickets-list');

  try {
    showLoading();
    const [tickets, requisitions] = await Promise.all([
      api('/api/tickets'),
      api('/api/requisitions')
    ]);
    allTickets = tickets;
    allRequisitions = requisitions;

    if (!allTickets.length) {
      container.innerHTML = '<div class="no-tickets">No tickets found.</div>';
      return;
    }

    const stats = { pending: 0, awaiting: 0, approved: 0 };
    const groups = { critical: [], high: [], medium: [], low: [] };

    // Build requisition lookup for O(1) access
    const reqMap = {};
    allRequisitions.forEach(r => reqMap[r.ticket_id] = r);

    allTickets.forEach(tk => {
      const req = reqMap[tk.id];

      // Count stats regardless of filter
      if (!req) stats.pending++;
      else if (req.admin_approval === 'Approved') stats.approved++;
      else if (req.admin_approval !== 'Rejected') stats.awaiting++;

      // Build ticket card HTML
      let actionHtml = '';
      if (req) {
        actionHtml = '<div style="font-size:11px;color:#3B6D11;font-weight:600;margin-top:6px">Requisition Submitted (' + req.admin_approval + ')</div>';
        if (req.admin_remarks) {
          actionHtml += '<div style="font-size:11px;color:var(--c-muted);font-style:italic">Remarks: ' + esc(req.admin_remarks) + '</div>';
        }
      } else {
        actionHtml = '<button class="btn-sm blue" style="margin-top:8px" onclick="openRequisition(\'' + tk.id + '\')">Create Requisition</button>';
      }

      const cardHtml = '<div class="info-card" style="text-align:left">' +
        '<div class="info-row"><span class="info-val">' + tk.id + ' — ' + esc(tk.type) + '</span>' +
        '<span class="urgency-badge badge-' + tk.urgency + '">' + tk.urgency + '</span></div>' +
        '<div class="info-row" style="color:#666;font-size:11px"><span style="flex:1">' + esc(tk.location) + '</span></div>' +
        '<div style="font-size:12px;color:#555;margin-top:6px">' + esc(tk.desc) + '</div>' +
        actionHtml + '</div>';

      // Apply filter
      let passesFilter = false;
      if (currentManagerFilter === 'Pending' && !req) passesFilter = true;
      if (currentManagerFilter === 'Awaiting Admin' && req && req.admin_approval === 'Pending') passesFilter = true;
      if (currentManagerFilter === 'Approved' && req && req.admin_approval === 'Approved') passesFilter = true;
      if (currentManagerFilter === 'All') passesFilter = true;

      if (groups[tk.urgency] && passesFilter) groups[tk.urgency].push(cardHtml);
    });

    // Update stat cards
    document.getElementById('manager-directory-title').textContent = currentManagerFilter + ' Tickets Directory';
    document.getElementById('mgr-stat-pending').textContent = stats.pending;
    document.getElementById('mgr-stat-awaiting').textContent = stats.awaiting;
    document.getElementById('mgr-stat-approved').textContent = stats.approved;

    // Render accordion groups
    container.innerHTML = ['critical', 'high', 'medium', 'low'].map(urgency => {
      if (!groups[urgency].length) return '';
      const label = urgency.charAt(0).toUpperCase() + urgency.slice(1);
      const isExpanded = urgency === 'critical' ? 'block' : 'none';

      return '<div style="margin-bottom:8px">' +
        '<button style="width:100%;padding:12px;background:#fff;border:1px solid #ddd;border-radius:8px;text-align:left;font-weight:600;font-size:14px;cursor:pointer;display:flex;justify-content:space-between;" onclick="toggleManagerAccordion(\'' + urgency + '\')">' +
          label + ' (' + groups[urgency].length + ') <span>▼</span></button>' +
        '<div id="mgr-acc-' + urgency + '" style="display:' + isExpanded + ';padding-top:10px">' + groups[urgency].join('') + '</div>' +
      '</div>';
    }).join('');

  } catch (e) {
    container.innerHTML = '<div class="no-tickets">Failed to load.</div>';
  } finally {
    hideLoading();
  }
}

/* === Requisition Form === */

function openRequisition(ticketId) {
  currentRequisitionTicket = allTickets.find(t => t.id === ticketId);
  if (!currentRequisitionTicket) return;

  document.getElementById('req-ticket-id').textContent = ticketId;
  document.getElementById('req-issue-desc').textContent = currentRequisitionTicket.type;
  document.getElementById('req-issue-loc').textContent = currentRequisitionTicket.location;

  // Reset form
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

  // Build itemized breakdown string
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
    reqSelectedFiles.forEach(f => formData.append('invoices', f));
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
