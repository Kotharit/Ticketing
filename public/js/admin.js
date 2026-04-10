/**
 * Admin dashboard — charts, stats, ticket management, requisition approval.
 *
 * Changes:
 * - Stat cards are now clickable and filter tickets by status
 * - Financial overview: total approved, monthly approved, pending approval
 * - Urgency pie chart only shows open/progress tickets (not resolved)
 * - Building heatmap uses stacked bars instead of dots
 * - Ticket management has filter tabs for faster navigation
 */

let adminTicketFilter = 'all'; // active filter for ticket management tab

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

  if (tab === 'tickets') renderAdminTickets();
  if (tab === 'dashboard') renderAdminDashboard();
}

/* Stat card click → set filter + switch to tickets tab */
function adminFilterAndSwitch(filter) {
  adminTicketFilter = filter;
  switchAdminTab('tickets');
  highlightActiveFilterBtn();
}

/* Filter tab click (within ticket management tab) */
function setAdminFilter(filter) {
  adminTicketFilter = filter;
  highlightActiveFilterBtn();
  renderAdminTickets();
}

function highlightActiveFilterBtn() {
  document.querySelectorAll('#admin-filter-tabs .admin-filter-btn').forEach(btn => {
    const btnFilter = btn.getAttribute('data-filter');
    btn.classList.toggle('active', btnFilter === adminTicketFilter);
  });
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
  // Only count open + in-progress tickets for urgency chart
  const activeTickets = allTickets.filter(t => t.status !== 'resolved');
  const urgencyCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  activeTickets.forEach(t => { if (urgencyCounts[t.urgency] !== undefined) urgencyCounts[t.urgency]++; });

  renderUrgencyChart(urgencyCounts);
  renderStatusChart();
  renderIssueTypeChart();
  renderFinancialOverview();
  renderBuildingHeatmap();
  renderResolvedChart();
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

  // Custom legend with "active only" note
  document.getElementById('urgency-legend').innerHTML =
    labels.map((lbl, i) => {
      const pct = total > 0 ? ((data[i] / total) * 100).toFixed(0) : 0;
      return '<div class="chart-legend-item"><span class="chart-legend-dot" style="background:' + colors[i] +
        '"></span>' + lbl + ' <span class="chart-legend-val">' + data[i] + ' (' + pct + '%)</span></div>';
    }).join('');
}

function renderStatusChart() {
  // Group tickets by date, then stack open / in-progress / resolved
  const dateMap = {};
  allTickets.forEach(tk => {
    // Extract date label from ticket time (e.g. "4 Apr", "07 Apr")
    const dateLabel = tk.time ? tk.time.split(' at ')[0].trim() : 'Unknown';
    if (!dateMap[dateLabel]) dateMap[dateLabel] = { open: 0, progress: 0, resolved: 0 };
    if (dateMap[dateLabel][tk.status] !== undefined) dateMap[dateLabel][tk.status]++;
  });

  // Sort date labels chronologically using actual Date objects
  const dateLabels = Object.keys(dateMap).sort((a, b) => {
    // Expected format: "D Mon" e.g. "4 Apr"
    // We add current year for better parsing
    const currentYear = new Date().getFullYear();
    return new Date(`${a} ${currentYear}`) - new Date(`${b} ${currentYear}`);
  });

  const openData = dateLabels.map(d => dateMap[d].open);
  const progressData = dateLabels.map(d => dateMap[d].progress);
  const resolvedData = dateLabels.map(d => dateMap[d].resolved);

  initChart('chart-status', 'line', {
    labels: dateLabels,
    datasets: [
      {
        label: 'Open',
        data: openData,
        backgroundColor: 'rgba(252,191,73,0.35)',
        borderColor: '#fcbf49',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#fcbf49'
      },
      {
        label: 'In Progress',
        data: progressData,
        backgroundColor: 'rgba(247,127,0,0.35)',
        borderColor: '#f77f00',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#f77f00'
      },
      {
        label: 'Resolved',
        data: resolvedData,
        backgroundColor: 'rgba(0,48,73,0.25)',
        borderColor: '#003049',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#003049'
      }
    ]
  }, {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        display: true, position: 'top',
        labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11, weight: '600' } }
      },
      tooltip: {
        mode: 'index', intersect: false,
        backgroundColor: 'rgba(0,48,73,0.9)', padding: 12, cornerRadius: 8,
        titleFont: { size: 12, weight: '600' }, bodyFont: { size: 11 }
      }
    },
    interaction: { mode: 'index', intersect: false },
    scales: {
      y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
      x: { ticks: { font: { size: 11 } }, grid: { display: false } }
    }
  });
}

function renderIssueTypeChart() {
  // Only show active (open + in progress) tickets
  const activeTickets = allTickets.filter(t => t.status !== 'resolved');
  const typeMap = {};
  activeTickets.forEach(t => { typeMap[t.type] = (typeMap[t.type] || 0) + 1; });

  const typeLabels = Object.keys(typeMap).sort((a, b) => typeMap[b] - typeMap[a]);
  const typeData = typeLabels.map(k => typeMap[k]);

  const palette = [
    '#003049', '#d62828', '#f77f00', '#fcbf49', '#577590',
    '#43aa8b', '#f94144', '#f3722c', '#90be6d', '#4d908e',
    '#277da1', '#f9844a', '#43aa8b', '#4d908e', '#577590'
  ];
  const hoverPalette = [
    '#00456a', '#ff3333', '#ff9922', '#ffd060', '#6a8faa',
    '#5bc4a0', '#ff5555', '#ff8844', '#a8d88a', '#60a8a0',
    '#3a90b8', '#ff9d6d', '#5bc4a0', '#60a8a0', '#6a8faa'
  ];

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

/* === Financial Overview === */

function renderFinancialOverview() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalApproved = 0;
  let monthApproved = 0;
  let pendingCost = 0;

  allRequisitions.forEach(r => {
    const cost = parseFloat(r.est_cost) || 0;

    if (r.admin_approval === 'Approved') {
      totalApproved += cost;

      // Check if approved this month (use created_at or current month as fallback)
      if (r.created_at) {
        const d = new Date(r.created_at);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          monthApproved += cost;
        }
      } else {
        // If no date available, count all as this month
        monthApproved += cost;
      }
    } else if (r.admin_approval === 'Pending') {
      pendingCost += cost;
    }
  });

  document.getElementById('fin-total-approved').textContent = '₹' + totalApproved.toLocaleString('en-IN');
  document.getElementById('fin-month-approved').textContent = '₹' + monthApproved.toLocaleString('en-IN');
  document.getElementById('fin-pending-cost').textContent = '₹' + pendingCost.toLocaleString('en-IN');
}

/* === Building Heatmap (stacked bars) === */

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

  const maxTotal = sorted[0][1].total;
  const segColors = { critical: '#d62828', high: '#f77f00', medium: '#fcbf49', low: '#adb5bd' };

  // Legend
  let legendHtml = '<div style="display:flex;gap:14px;margin-bottom:12px;justify-content:center">' +
    ['Critical', 'High', 'Medium', 'Low'].map((label, i) => {
      const colors = ['#d62828', '#f77f00', '#fcbf49', '#adb5bd'];
      return '<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#666">' +
        '<span style="width:10px;height:10px;border-radius:3px;background:' + colors[i] + ';display:inline-block"></span>' + label + '</div>';
    }).join('') + '</div>';

  heatmapEl.innerHTML = legendHtml + sorted.map(([name, data]) => {
    const segments = ['critical', 'high', 'medium', 'low'].map(u => {
      if (data[u] === 0) return '';
      const pct = (data[u] / maxTotal) * 100;
      const label = pct > 12 ? data[u] : '';
      return '<div class="building-bar-segment" style="width:' + pct + '%;background:' + segColors[u] + '">' + label + '</div>';
    }).join('');

    return '<div class="building-row">' +
      '<span class="building-name">' + esc(name) + '</span>' +
      '<div class="building-bar-track">' + segments + '</div>' +
      '<span class="building-count">' + data.total + '</span>' +
      '</div>';
  }).join('');
}

/* === Resolved Over Time Chart === */

function renderResolvedChart() {
  const resolved = allTickets.filter(t => t.status === 'resolved');

  const dateMap = {};
  resolved.forEach(tk => {
    const label = tk.time ? tk.time.split(' at ')[0].trim() : 'Unknown';
    dateMap[label] = (dateMap[label] || 0) + 1;
  });

  const currentYear = new Date().getFullYear();
  const dateLabels = Object.keys(dateMap).sort((a, b) =>
    new Date(`${a} ${currentYear}`) - new Date(`${b} ${currentYear}`)
  );

  let cumulative = 0;
  const cumulativeData = dateLabels.map(d => { cumulative += dateMap[d]; return cumulative; });

  initChart('chart-resolved', 'line', {
    labels: dateLabels,
    datasets: [{
      label: 'Resolved',
      data: cumulativeData,
      borderColor: '#003049',
      backgroundColor: 'rgba(0,48,73,0.15)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#003049'
    }]
  }, {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,48,73,0.9)', padding: 12, cornerRadius: 8,
        titleFont: { size: 12, weight: '600' }, bodyFont: { size: 11 },
        callbacks: { label: ctx => ctx.raw + ' total resolved' }
      }
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
      x: { ticks: { font: { size: 11 } }, grid: { display: false } }
    }
  });
}

/* === Ticket Management === */

function renderAdminTickets() {
  const search = (document.getElementById('admin-search').value || '').toLowerCase();

  // Build requisition lookup map for O(1) access
  const reqMap = {};
  allRequisitions.forEach(r => reqMap[r.ticket_id] = r);

  const filtered = allTickets.filter(tk => {
    // Search filter
    if (search) {
      const matchSearch = tk.tenantName.toLowerCase().includes(search) ||
        tk.location.toLowerCase().includes(search) ||
        tk.type.toLowerCase().includes(search) ||
        tk.id.toLowerCase().includes(search);
      if (!matchSearch) return false;
    }

    // Status/requisition filter
    const req = reqMap[tk.id];
    switch (adminTicketFilter) {
      case 'open': return tk.status === 'open';
      case 'progress': return tk.status === 'progress';
      case 'resolved': return tk.status === 'resolved';
      case 'req-pending': return req && req.admin_approval === 'Pending';
      case 'req-approved': return req && req.admin_approval === 'Approved';
      default: return true; // 'all'
    }
  });

  // Group by building
  const byBuilding = {};
  filtered.forEach(tk => {
    const building = tk.location.split(',')[0].trim();
    if (!byBuilding[building]) byBuilding[building] = [];
    byBuilding[building].push(tk);
  });

  const container = document.getElementById('admin-tickets-list');
  if (!filtered.length) {
    container.innerHTML = '<div class="no-tickets">No tickets match the current filter.</div>';
    return;
  }

  container.innerHTML = Object.keys(byBuilding).sort().map(building => {
    const tickets = byBuilding[building];
    tickets.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    const rows = tickets.map(tk => renderAdminTicketCard(tk, reqMap[tk.id])).join('');

    return '<div class="admin-section">' +
      '<div class="admin-building-header">' +
      '<span>📍 ' + esc(building) + '</span>' +
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
      '<span class="urgency-badge ' + badgeClass + '">' + esc(req.admin_approval) + '</span></div>' +
      '<div>Estimated Cost: \u20b9' + esc(req.est_cost || '0') + ' &middot; Vendor: ' + (req.in_house_fix ? 'In-house' : esc(req.vendor_name)) + '</div>' +
      (req.cost_breakdown ? '<div style="margin-top:4px;color:var(--c-muted);white-space:pre-line;font-size:11px">' + esc(req.cost_breakdown) + '</div>' : '') +
      (req.admin_remarks ? '<div style="font-style:italic;color:var(--c-muted);margin-top:4px;border-left:3px solid var(--c-yellow);padding-left:8px">Admin Remarks: ' + esc(req.admin_remarks) + '</div>' : '') +
      (req.invoices && req.invoices.length ? '<div class="attach-strip">' + req.invoices.map(a =>
        '<div class="attach-thumb" onclick="openLightbox(\'/api/attachments/' + a.id + '\')"><img src="/api/attachments/' + a.id + '" loading="lazy" /></div>'
      ).join('') + '</div>' : '') +
      (req.vendor_confirmed ?
        '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding:8px 10px;background:#f0faf5;border-radius:8px;border:1px solid #43aa8b">' +
        '<span style="color:#43aa8b;font-size:13px">✓</span>' +
        '<div style="font-size:12px">' +
        '<span style="font-weight:600;color:#43aa8b">Vendor Confirmed</span> ' +
        '<span style="color:#555">by ' + esc(req.vendor_confirmed_by) + ' · ' + esc(req.vendor_confirmed_at) + '</span>' +
        '</div>' +
        (req.vendor_proof && req.vendor_proof.length
          ? '<img src="/api/attachments/' + req.vendor_proof[0].id + '" ' +
            'onclick="openLightbox(\'/api/attachments/' + req.vendor_proof[0].id + '\')" ' +
            'style="width:40px;height:40px;object-fit:cover;border-radius:6px;cursor:pointer;margin-left:auto" />'
          : '') +
        '</div>' : '') +
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

  // Professional progress stepper (read-only)
  // Maps ticket status + requisition state to a 4-stage lifecycle
  const hasReq = !!req;
  const reqApproved = hasReq && req.admin_approval === 'Approved';
  const reqRejected = hasReq && req.admin_approval === 'Rejected';

  let activeStage = 0; // Review
  if (tk.status === 'open' && !hasReq) activeStage = 0;
  else if (tk.status === 'open' && hasReq && !reqApproved && !reqRejected) activeStage = 0;
  else if (tk.status === 'open' && reqApproved) activeStage = 1;
  else if (tk.status === 'progress') activeStage = 2;
  else if (tk.status === 'resolved') activeStage = 3;
  if (reqRejected) activeStage = 0; // stays at review if rejected

  const stages = [
    { label: 'Review' },
    { label: 'Approved' },
    { label: 'In Progress' },
    { label: 'Resolved' }
  ];

  const stepperHtml = '<div class="prog-stepper">' +
    stages.map((s, i) => {
      let dotCls = 'prog-dot';
      let content = '' + (i + 1);
      if (i < activeStage) {
        dotCls += ' prog-done';
        content = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      } else if (i === activeStage) {
        dotCls += ' prog-active';
      }
      const connector = i < stages.length - 1
        ? '<div class="prog-bar"><div class="prog-bar-fill' + (i < activeStage ? ' prog-bar-done' : '') + '"></div></div>'
        : '';
      return '<div class="prog-step">' +
        '<div class="' + dotCls + '">' + content + '</div>' +
        '<span class="prog-label' + (i === activeStage ? ' prog-label-active' : '') + (i < activeStage ? ' prog-label-done' : '') + '">' + s.label + '</span>' +
        '</div>' + connector;
    }).join('') +
    '</div>';

  return '<div class="admin-ticket urgency-' + tk.urgency + '">' +
    '<div class="admin-ticket-top"><div>' +
    '<div class="admin-ticket-id">' + tk.id + ' &middot; ' + tk.time + '</div>' +
    '<div class="admin-ticket-type">' + esc(tk.type) + '</div>' +
    '</div>' +
    '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
    '<div style="display:flex;align-items:center;gap:4px">' +
    '<span class="urgency-badge badge-' + tk.urgency + '">' + urgencyLabel + '</span>' + overrideTag +
    '</div>' +
    '</div></div>' +
    stepperHtml +
    '<div class="admin-ticket-detail"><strong>Tenant:</strong> ' + esc(tk.tenantName) + ' | <strong>Location:</strong> ' + esc(tk.location) + editedBadge + '</div>' +
    '<div class="admin-ticket-detail" style="color:#888;font-style:italic;margin-top:4px">' + esc(tk.desc) + '</div>' +
    reqHtml +
    '</div>';
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
