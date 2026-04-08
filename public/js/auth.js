/**
 * Authentication flows — tenant, admin, and manager login/logout.
 */

async function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass = document.getElementById('login-pass').value.trim();

  try {
    showLoading();
    currentUser = await api('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    currentUser.edited = false;
    changeLog = [];

    document.getElementById('login-error').style.display = 'none';

    const initials = currentUser.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    document.getElementById('nav-avatar').style.display = 'flex';
    document.getElementById('nav-avatar').textContent = initials;
    document.getElementById('nav-sub').textContent = currentUser.location;
    document.getElementById('admin-nav-btn').style.display = 'none';

    goTo('page-dashboard');
  } catch (e) {
    document.getElementById('login-error').style.display = 'block';
  } finally {
    hideLoading();
  }
}

async function doAdminLogin() {
  const username = document.getElementById('admin-user').value.trim();
  const password = document.getElementById('admin-pass').value.trim();

  try {
    showLoading();
    await api('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    isAdmin = true;
    document.getElementById('admin-error').style.display = 'none';
    document.getElementById('nav-sub').textContent = 'Admin View';
    document.getElementById('nav-avatar').style.display = 'none';
    document.getElementById('admin-nav-btn').style.display = 'none';
    document.getElementById('manager-nav-btn').style.display = 'none';

    goTo('page-admin');
  } catch (e) {
    document.getElementById('admin-error').style.display = 'block';
  } finally {
    hideLoading();
  }
}

async function doManagerLogin() {
  const username = document.getElementById('manager-user').value.trim();
  const password = document.getElementById('manager-pass').value.trim();

  try {
    showLoading();
    await api('/api/manager/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    isManager = true;
    document.getElementById('manager-error').style.display = 'none';
    document.getElementById('nav-sub').textContent = 'Manager View';
    document.getElementById('nav-avatar').style.display = 'none';
    document.getElementById('admin-nav-btn').style.display = 'none';
    document.getElementById('manager-nav-btn').style.display = 'none';

    goTo('page-manager');
  } catch (e) {
    document.getElementById('manager-error').style.display = 'block';
  } finally {
    hideLoading();
  }
}

function restoreNavButtons() {
  document.getElementById('nav-avatar').style.display = 'none';
  document.getElementById('admin-nav-btn').style.display = '';
  document.getElementById('manager-nav-btn').style.display = '';
  document.getElementById('nav-sub').textContent = 'Maintenance Portal';
}

function logout() {
  currentUser = null;
  changeLog = [];
  isAdmin = false;
  isManager = false;
  allTickets = [];
  allRequisitions = [];

  restoreNavButtons();

  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';

  goTo('page-login');
}
