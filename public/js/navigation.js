/**
 * Page navigation and sidebar state management.
 */
function goTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');

  const isDashboardLayout = ['page-admin', 'page-manager', 'page-requisition'].includes(pageId);

  if (isDashboardLayout) {
    document.body.classList.add('layout-dashboard');
    document.getElementById('sb-role').textContent =
      pageId === 'page-admin' ? 'Executive Portal' : 'Manager Portal';
    document.getElementById('admin-sb-menu').style.display =
      pageId === 'page-admin' ? 'flex' : 'none';
  } else {
    document.body.classList.remove('layout-dashboard');
  }

  // Trigger page-specific rendering
  if (pageId === 'page-tickets')    renderMyTickets();
  if (pageId === 'page-admin')      renderAdmin();
  if (pageId === 'page-dashboard')  renderDashboard();
  if (pageId === 'page-report')     renderReportPrefill();
  if (pageId === 'page-manager')    renderManagerTickets();
}
