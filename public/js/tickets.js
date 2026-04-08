/**
 * Ticket creation and tenant ticket list.
 */

async function submitTicket() {
  const type = document.getElementById('issue-type').value;
  const desc = document.getElementById('issue-desc').value.trim();

  if (!type)  { alert('Please select an issue type.'); return; }
  if (!desc)  { alert('Please describe the problem.'); return; }

  try {
    showLoading();

    const formData = new FormData();
    formData.append('type', type);
    formData.append('desc', desc);
    formData.append('tenantEmail', currentUser.email);
    formData.append('locationEdited', String(currentUser.edited || false));
    selectedFiles.forEach(f => formData.append('attachments', f));

    const ticket = await api('/api/tickets', { method: 'POST', body: formData });

    // Populate confirmation page
    document.getElementById('ticket-num').textContent = ticket.id;
    document.getElementById('conf-issue').textContent = ticket.type;
    document.getElementById('conf-urgency').textContent =
      ticket.urgency.charAt(0).toUpperCase() + ticket.urgency.slice(1);
    document.getElementById('conf-location').textContent = ticket.location;
    document.getElementById('conf-attach').textContent = (ticket.attachments || []).length + ' file(s)';
    document.getElementById('conf-time').textContent = ticket.time;

    selectedFiles = [];
    goTo('page-confirm');
  } catch (e) {
    alert('Failed: ' + e.message);
  } finally {
    hideLoading();
  }
}

async function renderMyTickets() {
  if (!currentUser) return;

  const list = document.getElementById('tickets-list');

  try {
    showLoading();
    const mine = await api('/api/tickets?email=' + encodeURIComponent(currentUser.email));

    if (!mine.length) {
      list.innerHTML = '<p class="no-tickets">No tickets yet.</p>';
      return;
    }

    list.innerHTML = mine.map(tk => {
      const dotColor = tk.status === 'open' ? '#E24B4A' : tk.status === 'progress' ? '#378ADD' : '#639922';
      const badgeClass = tk.status === 'open' ? 'b-open' : tk.status === 'progress' ? 'b-progress' : 'b-resolved';
      const statusLabel = tk.status === 'open' ? 'Open' : tk.status === 'progress' ? 'In progress' : 'Resolved';

      const attachCount = (tk.attachments || []).length;
      const attachBadge = attachCount > 0 ? ' <span class="attach-count">📎' + attachCount + '</span>' : '';

      return '<div class="ticket-row">' +
        '<div class="t-dot" style="background:' + dotColor + '"></div>' +
        '<div class="t-info">' +
          '<div class="t-title">' + esc(tk.type) + attachBadge + '</div>' +
          '<div class="t-sub">' + tk.id + ' &middot; ' + tk.time + '</div>' +
        '</div>' +
        '<div class="t-badge ' + badgeClass + '">' + statusLabel + '</div>' +
      '</div>';
    }).join('');
  } catch (e) {
    list.innerHTML = '<p class="no-tickets">Error loading tickets.</p>';
  } finally {
    hideLoading();
  }
}
