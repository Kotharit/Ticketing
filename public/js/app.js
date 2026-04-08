/**
 * Application state and initialization.
 *
 * Global state lives here so every module can read/write it
 * without circular dependencies. DOM-ready setup is at the bottom.
 */

/* === Shared State === */
let currentUser = null;
let allTickets = [];
let allRequisitions = [];
let selectedFiles = [];
let reqSelectedFiles = [];
let isAdmin = false;
let isManager = false;
let changeLog = [];
let chartInstances = {};
let currentRequisitionTicket = null;
let currentManagerFilter = 'Pending';

/* === DOM Helpers === */
function esc(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(s || ''));
  return d.innerHTML;
}

function showLoading() { document.getElementById('loading').classList.add('active'); }
function hideLoading() { document.getElementById('loading').classList.remove('active'); }

/* === Initialization === */
document.addEventListener('DOMContentLoaded', () => {
  feather.replace();
  initDropZone();
});
