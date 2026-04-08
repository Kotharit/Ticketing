/**
 * Tenant dashboard — profile display, edit flow, report prefill.
 */

function renderDashboard() {
  if (!currentUser) return;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  document.getElementById('dash-greeting').textContent = greeting + ', ' + currentUser.name.split(' ')[0];
  document.getElementById('dash-sub').textContent =
    currentUser.location + ' — Wing ' + currentUser.wing + ', Flat ' + currentUser.flat;

  document.getElementById('d-name').textContent = currentUser.name;
  document.getElementById('d-location-display').textContent = currentUser.location;
  document.getElementById('d-wing-display').textContent = currentUser.wing;
  document.getElementById('d-flat-display').textContent = currentUser.flat;
  document.getElementById('d-contact').textContent = currentUser.contact;

  // Show whether profile data was auto-filled or edited by tenant
  const badge = document.getElementById('auto-badge-lbl');
  if (currentUser.edited) {
    badge.className = 'badge-sleek';
    badge.textContent = 'edited by tenant';
  } else {
    badge.className = 'badge-sleek verified';
    badge.textContent = 'auto-filled';
  }

  // Render edit history if any changes were made this session
  const logEl = document.getElementById('change-log');
  if (changeLog.length > 0) {
    logEl.style.display = 'block';
    logEl.innerHTML = '<strong>Edit history:</strong><br>' + changeLog.join('<br>');
  } else {
    logEl.style.display = 'none';
  }
}

function renderReportPrefill() {
  if (!currentUser) return;

  document.getElementById('r-name').textContent = currentUser.name;
  document.getElementById('r-location').textContent = currentUser.location;
  document.getElementById('r-unit').textContent = 'Wing ' + currentUser.wing + ', Flat ' + currentUser.flat;

  // Reset form state
  selectedFiles = [];
  renderPreviews();
  document.getElementById('issue-type').value = '';
  document.getElementById('issue-desc').value = '';
}

/* === Profile Edit Flow === */

function toggleEdit() {
  const isEditing = document.getElementById('d-location-input').style.display !== 'none';
  if (isEditing) { cancelEdit(); return; }

  ['location', 'wing', 'flat'].forEach(field => {
    document.getElementById('d-' + field + '-display').style.display = 'none';
    const input = document.getElementById('d-' + field + '-input');
    input.style.display = '';
    input.value = currentUser[field];
  });

  document.getElementById('edit-actions').style.display = 'flex';
  document.getElementById('edit-toggle-btn').textContent = 'Cancel';
}

async function saveEdit() {
  const updates = {};
  const changes = [];

  ['location', 'wing', 'flat'].forEach(field => {
    const newValue = document.getElementById('d-' + field + '-input').value.trim();
    if (newValue && newValue !== currentUser[field]) {
      updates[field] = newValue;
      changes.push(field + ': "' + currentUser[field] + '" → "' + newValue + '"');
    }
  });

  if (Object.keys(updates).length > 0) {
    try {
      showLoading();
      currentUser = await api('/api/tenant/' + encodeURIComponent(currentUser.email), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      currentUser.edited = true;

      const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      changeLog.push('[' + now + '] ' + changes.join(', '));
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      hideLoading();
    }
  }

  cancelEdit();
  renderDashboard();
}

function cancelEdit() {
  ['location', 'wing', 'flat'].forEach(field => {
    document.getElementById('d-' + field + '-display').style.display = '';
    document.getElementById('d-' + field + '-input').style.display = 'none';
  });

  document.getElementById('edit-actions').style.display = 'none';
  document.getElementById('edit-toggle-btn').textContent = 'Edit details';
}
