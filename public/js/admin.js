/**
 * Admin dashboard — charts, stats, ticket management, requisition approval.
 */

async function renderAdmin() {
  try {
    showLoading();
    const [tickets, requisitions] = await Promise.all([
      api('/api/tickets'),
      api('/api/requisitions')
    ]);
    allTickets = tickets;
    allRequisitions = requisitions;

    updateStats();
    switchAdminTab('dashboard');
  } catch (e) {
    console.error('Admin load failed:', e);
  } finally {
    hideLoading();
  }
}

function switchAdminTab(tab) {
  document.getElementById('admin-tab-dashboard').style.display = tab === 'dashboard' ? '' : 'none';
  document.getElementById('admin-tab-tickets').style.display = tab === 'tickets' ? '' : 'none';
  document.getElementById('tab-dashboard').classList.toggle('active', tab === 'dashboard');
  document.getElementById('tab-tickets').classList.toggle('active', tab === 'tickets');

  // Sync sidebar highlight
  document.getElementById('sb-dash').classList.toggle('active', tab === 'dashboard');
  document.getElementById('sb-tick').classList.toggle('active', tab === 'tickets');

  if (tab === 'tickets')   renderAdminTickets();
  if (tab === 'dashboard') renderAdminDashboard();
}

function updateStats() {
  document.getElementById('stat-total').textContent = allTickets.length;
  document.getElementById('stat-open').textContent = allTickets.filter(t => t.status === 'open').length;
  document.getElementById('stat-progress').textContent = allTickets.filter(t => t.status === 'progress').length;
  document.getElementById('stat-resolved').textContent = allTickets.filter(t => t.status === 'resolved').length;

  const pendingReqs = allRequisitions.filter(r => r.admin_approval === 'Pending').length;
  const approvedReqs = allRequisitions.filter(r => r.admin_approval === 'Approved').length;
  document.getElementById('stat-req-pending').textContent = pendingReqs;
  document.getElementById('stat-req-approved').textContent = approvedReqs;
}

/* === Chart Helper === */

function initChart(id, type, data, options) {
  const ctx = document.getElementById(id);
  if (chartInstances[id]) chartInstances[id].destroy();
  chartInstances[id] = new Chart(ctx, { type, data, options });
}

/* === Dashboard Charts & Widgets === */

function renderAdminDashboard() {
  const openTickets = allTickets.filter(t => t.status !== 'resolved');
  const urgencyCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  openTickets.forEach(t => { if (urgencyCounts[t.urgency] !== undefined) urgencyCounts[t.urgency]++; });

  renderUrgencyChart(urgencyCounts);
  renderStatusChart();
  renderIssueTypeChart();
  renderFinancialOverview();
  renderBuildingHeatmap();
}

function renderUrgencyChart(counts) {
  const total = counts.critical + counts.high + counts.medium + counts.low;
  const colors = ['#d62828', '#f77f00', '#fcbf49', '#adb5bd'];
  const labels = ['Critical', 'High', 'Medium', 'Low'];
  const data = [counts.critical, counts.high, counts.medium, counts.low];

  initChart('chart-urgency', 'doughnut', {
    labels,
    datasets: [{
      data, backgroundColor: colors, borderWidth: 3, borderColor: '#fff',
      hoverOffset: 18, hoverBorderWidth: 0
    }]
  }, {
    responsive: true, maintainAspectRatio: false, cutout: '65%',
    animation: { animateScale: true, animateRotate: true },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,48,73,0.9)', padding: 12, cornerRadius: 8,
        titleFont: { size: 13, weight: '600' }, bodyFont: { size: 12 },
        callbacks: {
          label: ctx => {
            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
            return ctx.label + ': ' + ctx.raw + ' (' + pct + '%)';
          }
        }
      }
    }
  });

  // Custom legend
  document.getElementById('urgency-legend').innerHTML = labels.map((lbl, i) => {
    const pct = total > 0 ? ((data[i] / total) * 100).toFixed(0) : 0;
    return '<div class="chart-legend-item"><span class="chart-legend-dot" style="background:' + colors[i] +
      '"></span>' + lbl + ' <span class="chart-legend-val">' + data[i] + ' (' + pct + '%)</span></div>';
  }).join('');
}

function renderStatusChart() {
  const statusCounts = { open: 0, progress: 0, resolved: 0 };
  allTickets.forEach(t => { if (statusCounts[t.status] !== undefined) statusCounts[t.status]++; });

  initChart('chart-status', 'bar', {
    labels: ['Open', 'In Progress', 'Resolved'],
    datasets: [{
      data: [statusCounts.open, statusCounts.progress, statusCounts.resolved],
      backgroundColor: ['rgba(252,191,73,0.8)', 'rgba(247,127,0,0.8)', 'rgba(0,48,73,0.8)'],
      hoverBackgroundColor: ['#fcbf49', '#f77f00', '#003049'],
      borderRadius: 8, borderWidth: 0, borderSkipped: false
    }]
  }, {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,48,73,0.9)', padding: 12, cornerRadius: 8 } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
      x: { ticks: { font: { size: 11 } }, grid: { display: false } }
    }
  });
}

function renderIssueTypeChart() {
  const typeMap = {};
  allTickets.forEach(t => { typeMap[t.type] = (typeMap[t.type] || 0) + 1; });

  const typeLabels = Object.keys(typeMap).sort((a, b) => typeMap[b] - typeMap[a]);
  const typeData = typeLabels.map(k => typeMap[k]);

  const palette = ['#003049','#d62828','#f77f00','#fcbf49','#577590','#43aa8b','#f94144','#f3722c','#90be6d','#4d908e'];
  const hoverPalette = ['#00456a','#ff3333','#ff9922','#ffd060','#6a8faa','#5bc4a0','#ff5555','#ff8844','#a8d88a','#60a8a0'];

  initChart('chart-issue-type', 'bar', {
    labels: typeLabels,
    datasets: [{
      data: typeData,
      backgroundColor: typeLabels.map((_, i) => palette[i % palette.length]),
      hoverBackgroundColor: typeLabels.map((_, i) => hoverPalette[i % hoverPalette.length]),
      borderRadius: 8, borderWidth: 0, borderSkipped: false
    }]
  }, {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,48,73,0.9)', padding: 12, cornerRadius: 8,
        callbacks: {
          label: ctx => {
            const total = typeData.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
            return ctx.raw + ' tickets (' + pct + '%)';
          }
        }
      }
    },
    scales: {
      x: { ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
      y: { ticks: { font: { size: 11 } }, grid: { display: false } }
    }
  });
}

function renderFinancialOverview() {
  let totalCost = 0;
  allRequisitions.forEach(r => {
    if (r.admin_approval === 'Approved' && r.est_cost) totalCost += parseFloat(r.est_cost);
  });

  document.getElementById('admin-total-cost').innerHTML =
    '₹' + totalCost.toLocaleString('en-IN') +
    '<div style="font-size:11px; color:var(--c-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.05em; margin-top:2px">Total Vendor Costs</div>';
}

function renderBuildingHeatmap() {
  const byBuilding = {};
  allTickets.forEach(tk => {
    const building = tk.location.split(',')[0].trim();
    if (!byBuilding[building]) byBuilding[building] = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
    byBuilding[building].total++;
    if (byBuilding[building][tk.urgency] !== undefined) byBuilding[building][tk.urgency]++;
  });

  const heatmapEl = document.getElementById('building-heatmap');
  const sorted = Object.entries(byBuilding).sort((a, b) => b[1].total - a[1].total);

  if (!sorted.length) {
    heatmapEl.innerHTML = '<p class="no-tickets">No tickets yet.</p>';
    return;
  }

  const dotColors = { critical: '#d62828', high: '#f77f00', medium: '#fcbf49', low: '#adb5bd' };

  heatmapEl.innerHTML = sorted.map(([name, data]) => {
    let dots = [];
    ['critical', 'high', 'medium', 'low'].forEach(u => {
      for (let i = 0; i < Math.min(data[u], 4); i++) dots.push(dotColors[u]);
    });

    return '<div class="building-row">' +
      '<span class="building-name">' + esc(name) + '</span>' +
      '<div class="building-dots">' + dots.slice(0, 10).map(c =>
        '<span class="building-dot" style="background:' + c + '"></span>'
      ).join('') + '</div>' +
      '<span class="building-count">' + data.total + '</span>' +
    '</div>';
  }).join('');
}

/* === Ticket Management === */

function renderAdminTickets() {
  const search = (document.getElementById('admin-search').value || '').toLowerCase();
  const filtered = allTickets.filter(tk =>
    !search ||
    tk.tenantName.toLowerCase().includes(search) ||
    tk.location.toLowerCase().includes(search) ||
    tk.type.toLowerCase().includes(search)
  );

  const byBuilding = {};
  filtered.forEach(tk => {
    const building = tk.location.split(',')[0].trim();
    if (!byBuilding[building]) byBuilding[building] = [];
    byBuilding[building].push(tk);
  });

  const container = document.getElementById('admin-tickets-list');
  if (!filtered.length) {
    container.innerHTML = '<div class="no-tickets">No tickets found.</div>';
    return;
  }

  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  // Build requisition lookup map for O(1) access
  const reqMap = {};
  allRequisitions.forEach(r => reqMap[r.ticket_id] = r);

  container.innerHTML = Object.keys(byBuilding).map(building => {
    const tickets = byBuilding[building];
    tickets.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    const rows = tickets.map(tk => renderAdminTicketCard(tk, reqMap[tk.id])).join('');

    return '<div class="admin-section">' +
      '<div class="admin-building-header">' +
        '<span>' + esc(building) + '</span>' +
        '<span style="font-size:11px;opacity:0.8">' + tickets.length + ' ticket' + (tickets.length > 1 ? 's' : '') + '</span>' +
      '</div>' + rows +
    '</div>';
  }).join('');
}

function renderAdminTicketCard(tk, req) {
  const editedBadge = tk.locationEdited ? ' <span class="badge-sleek" style="background:#FAEEDA;color:#633806;">edited</span>' : '';
  const urgencyLabel = tk.urgency.charAt(0).toUpperCase() + tk.urgency.slice(1);
  const overrideTag = tk.urgencyOverridden ? '<span class="override-tag">manually set</span>' : '';

  let reqHtml = '';
  if (req) {
    const badgeClass = req.admin_approval === 'Approved' ? 'badge-low' : req.admin_approval === 'Rejected' ? 'badge-critical' : 'b-open';

    reqHtml = '<div style="margin-top:8px;background:#fff;padding:10px;border-radius:8px;border:1px solid #ddd;font-size:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><strong>Manager Requisition</strong>' +
      '<span class="urgency-badge ' + badgeClass + '">' + req.admin_approval + '</span></div>' +
      '<div>Estimated Cost: \u20b9' + (req.est_cost || '0') + ' &middot; Vendor: ' + (req.in_house_fix ? 'In-house' : esc(req.vendor_name)) + '</div>' +
      (req.cost_breakdown ? '<div style="margin-top:4px;color:var(--c-muted);white-space:pre-line;font-size:11px">' + esc(req.cost_breakdown) + '</div>' : '') +
      (req.admin_remarks ? '<div style="font-style:italic;color:var(--c-muted);margin-top:4px;border-left:3px solid var(--c-yellow);padding-left:8px">Admin Remarks: ' + esc(req.admin_remarks) + '</div>' : '') +
      (req.invoices && req.invoices.length ? '<div class="attach-strip">' + req.invoices.map(a =>
        '<div class="attach-thumb" onclick="openLightbox(\'/api/attachments/' + a.id + '\')"><img src="/api/attachments/' + a.id + '" loading="lazy" /></div>'
      ).join('') + '</div>' : '') +
      (req.admin_approval === 'Pending' ?
        '<div style="margin-top:10px">' +
          '<textarea id="remark-' + tk.id + '" placeholder="Add remarks (optional)..." style="width:100%;border:1px solid #ddd;border-radius:6px;padding:6px 8px;font-size:11px;font-family:inherit;resize:none;height:40px;margin-bottom:8px"></textarea>' +
          '<div style="display:flex;gap:6px">' +
            '<button class="btn-sm blue" onclick="approveRequisition(\'' + tk.id + '\')">Approve Requisition</button>' +
            '<button class="btn-sm reject" onclick="rejectRequisition(\'' + tk.id + '\')">Reject</button>' +
          '</div>' +
        '</div>' : '') +
    '</div>';
  } else {
    reqHtml = '<div style="font-size:10px;color:#aaa;margin-top:8px">No requisition submitted yet.</div>';
  }

  return '<div class="admin-ticket urgency-' + tk.urgency + '">' +
    '<div class="admin-ticket-top"><div>' +
      '<div class="admin-ticket-id">' + tk.id + ' &middot; ' + tk.time + '</div>' +
      '<div class="admin-ticket-type">' + esc(tk.type) + '</div>' +
    '</div>' +
    '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
      '<select class="admin-status-select" onchange="updateStatus(\'' + tk.id + '\',this.value)">' +
        '<option value="open"' + (tk.status === 'open' ? ' selected' : '') + '>Open</option>' +
        '<option value="progress"' + (tk.status === 'progress' ? ' selected' : '') + '>In progress</option>' +
        '<option value="resolved"' + (tk.status === 'resolved' ? ' selected' : '') + '>Resolved</option>' +
      '</select>' +
      '<div style="display:flex;align-items:center;gap:4px">' +
        '<span class="urgency-badge badge-' + tk.urgency + '">' + urgencyLabel + '</span>' + overrideTag +
        '<select class="admin-status-select" style="font-size:10px;padding:2px 5px" onchange="overrideUrgency(\'' + tk.id + '\',this.value)">' +
          '<option value="">Override…</option>' +
          ['critical', 'high', 'medium', 'low'].map(u =>
            '<option value="' + u + '"' + (tk.urgency === u && tk.urgencyOverridden ? ' selected' : '') + '>' + u.charAt(0).toUpperCase() + u.slice(1) + '</option>'
          ).join('') +
        '</select>' +
      '</div>' +
    '</div></div>' +
    '<div class="admin-ticket-detail"><strong>Tenant:</strong> ' + esc(tk.tenantName) + ' | <strong>Location:</strong> ' + esc(tk.location) + editedBadge + '</div>' +
    '<div class="admin-ticket-detail" style="color:#888;font-style:italic;margin-top:4px">' + esc(tk.desc) + '</div>' +
    reqHtml +
  '</div>';
}

/* === Ticket Actions === */

async function updateStatus(id, status) {
  const tk = allTickets.find(t => t.id === id);
  if (tk) tk.status = status;

  renderAdminTickets();
  renderAdminDashboard();
  updateStats();

  try {
    await api('/api/tickets/' + id + '/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  } catch (e) {
    console.error('Status sync failed:', e);
  }
}

async function overrideUrgency(id, urgency) {
  if (!urgency) return;

  const tk = allTickets.find(t => t.id === id);
  if (tk) { tk.urgency = urgency; tk.urgencyOverridden = true; }

  renderAdminTickets();
  renderAdminDashboard();

  try {
    await api('/api/tickets/' + id + '/urgency', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urgency })
    });
  } catch (e) {
    console.error('Urgency sync failed:', e);
  }
}

/* === Requisition Approval === */

async function approveRequisition(ticketId) {
  const req = allRequisitions.find(r => r.ticket_id === ticketId);
  if (!req) return;

  const remarkEl = document.getElementById('remark-' + ticketId);
  const remarks = remarkEl ? remarkEl.value.trim() : '';

  showLoading();
  try {
    await api('/api/requisitions/' + req.ticket_id + '/approve', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks })
    });
    await renderAdmin();
  } catch (e) {
    alert(e.message);
    hideLoading();
  }
}

async function rejectRequisition(ticketId) {
  const req = allRequisitions.find(r => r.ticket_id === ticketId);
  if (!req) return;

  const remarkEl = document.getElementById('remark-' + ticketId);
  const remarks = remarkEl ? remarkEl.value.trim() : '';

  showLoading();
  try {
    await api('/api/requisitions/' + req.ticket_id + '/reject', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks })
    });
    await renderAdmin();
  } catch (e) {
    alert(e.message);
    hideLoading();
  }
}
