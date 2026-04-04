// ============================================================
// TenantDesk Backend — REST API Microservice
// Express + Google Sheets API v4 + Google Drive API v3
// Designed as a standalone service, cross-compatible with
// any frontend or backend framework (RoR, Django, etc.)
// ============================================================

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Config ──
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists for local fallback
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// ── Middleware ──
app.use(express.json());
app.use(require('cors')());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Multer (memory storage — files go to Drive or local after) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// ── Google API clients ──
let sheets, drive;

async function initGoogleAPIs() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('ERROR: credentials.json not found at', CREDENTIALS_PATH);
    console.error('See SETUP_GUIDE.md for instructions.');
    process.exit(1);
  }
  if (!SHEET_ID) {
    console.error('ERROR: GOOGLE_SHEET_ID not set in .env');
    process.exit(1);
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });
  const authClient = await auth.getClient();
  sheets = google.sheets({ version: 'v4', auth: authClient });
  drive = google.drive({ version: 'v3', auth: authClient });
  console.log('Google APIs initialized successfully.');
}

// ==========================================================
//  SHEET HELPERS
//  Tenants: A=name B=email C=location D=wing E=flat F=contact G=password
//  Tickets: A=id B=type C=desc D=status E=urgency F=urgencyOverridden
//           G=triageReason H=time I=tenantEmail J=tenantName
//           K=location L=wing M=flat N=contact O=locationEdited P=attachments
// ==========================================================

const TENANT_COLS = ['name','email','location','wing','flat','contact','password'];
const TICKET_COLS = ['id','type','desc','status','urgency','urgencyOverridden',
  'triageReason','time','tenantEmail','tenantName','location','wing','flat',
  'contact','locationEdited','attachments'];

function rowToObj(row, cols) {
  const obj = {};
  cols.forEach((c, i) => { obj[c] = (row[i] || '').toString(); });
  return obj;
}

async function readTenants() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Tenants!A2:G',
  });
  return (res.data.values || []).map(r => rowToObj(r, TENANT_COLS));
}

async function findTenant(email) {
  const tenants = await readTenants();
  return tenants.find(t => t.email.toLowerCase() === email.toLowerCase()) || null;
}

async function findTenantRowIndex(email) {
  const tenants = await readTenants();
  return tenants.findIndex(t => t.email.toLowerCase() === email.toLowerCase());
}

async function updateTenantFields(email, updates) {
  const idx = await findTenantRowIndex(email);
  if (idx < 0) throw new Error('Tenant not found');
  const rowNum = idx + 2; // 1-indexed + header
  const colMap = { location: 'C', wing: 'D', flat: 'E' };
  for (const [field, value] of Object.entries(updates)) {
    if (!colMap[field]) continue;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Tenants!${colMap[field]}${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[value]] },
    });
  }
}

async function readTickets() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Tickets!A2:P',
  });
  return (res.data.values || []).map(r => {
    const obj = rowToObj(r, TICKET_COLS);
    obj.urgencyOverridden = obj.urgencyOverridden === 'true';
    obj.locationEdited = obj.locationEdited === 'true';
    // Parse attachments JSON
    let attStr = obj.attachments || '';
    if (attStr.includes('\n\n---LINKS---\n')) {
        attStr = attStr.split('\n\n---LINKS---\n')[0];
    }
    try { obj.attachments = JSON.parse(attStr || '[]'); }
    catch { obj.attachments = []; }
    return obj;
  });
}

async function appendTicket(ticket) {
  const row = TICKET_COLS.map(c => {
    if (c === 'attachments') {
      const attachments = ticket[c] || [];
      if (attachments.length === 0) return '[]';
      const jsonString = JSON.stringify(attachments);
      const links = attachments.map(a => a.id.startsWith('drv_') ? `https://drive.google.com/open?id=${a.id.substring(4)}` : a.name);
      return jsonString + '\n\n---LINKS---\n' + links.join('\n');
    }
    if (c === 'urgencyOverridden' || c === 'locationEdited') return String(ticket[c] || false);
    return ticket[c] || '';
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Tickets!A:P',
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
}

async function findTicketRowIndex(ticketId) {
  const tickets = await readTickets();
  return tickets.findIndex(t => t.id === ticketId);
}

async function updateTicketCell(ticketId, colName, value) {
  const idx = await findTicketRowIndex(ticketId);
  if (idx < 0) throw new Error('Ticket not found');
  const rowNum = idx + 2;
  const colIndex = TICKET_COLS.indexOf(colName);
  if (colIndex < 0) throw new Error('Invalid column');
  const colLetter = String.fromCharCode(65 + colIndex);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Tickets!${colLetter}${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[typeof value === 'boolean' ? String(value) : value]] },
  });
}

async function getNextTicketId() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Tickets!A2:A',
  });
  let max = 100;
  (res.data.values || []).forEach(r => {
    const num = parseInt(r[0].replace('TK-', ''));
    if (!isNaN(num) && num > max) max = num;
  });
  return 'TK-' + String(max + 1).padStart(5, '0');
}

// ==========================================================
//  DRIVE HELPERS
// ==========================================================

async function uploadFileToDrive(buffer, originalName, mimeType) {
  const uniqueName = uuidv4() + '-' + originalName;
  const response = await drive.files.create({
    requestBody: { name: uniqueName, parents: [DRIVE_FOLDER_ID] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id,name,mimeType',
  });
  // Make file viewable by anyone with link
  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });
  return { id: 'drv_' + response.data.id, name: originalName, mimeType };
}

function saveFileLocally(buffer, originalName) {
  const filename = uuidv4() + path.extname(originalName);
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return { id: 'loc_' + filename, name: originalName };
}

// ==========================================================
//  SMART TRIAGE
// ==========================================================

function getBaseUrgency(type) {
  const critical = ['Water leak','Sewage / flooding','Fire or safety hazard','Gas leak'];
  const high = ['Electricity problem','Elevator issue','Broken door / window','Pest / insects'];
  const medium = ['AC not working','Plumbing issue','Broken window / latch'];
  if (critical.includes(type)) return 'critical';
  if (high.includes(type)) return 'high';
  if (medium.includes(type)) return 'medium';
  return 'low';
}

function smartTriage(type, description) {
  let level = getBaseUrgency(type);
  const desc = (description || '').toLowerCase();
  const levels = { critical: 4, high: 3, medium: 2, low: 1 };

  const criticalWords = ['flooding','fire','smoke','gas smell','emergency',
    'dangerous','unsafe','collapsed','electrocution','sparks','explosion',
    'short circuit','burning','suffocating','toxic','unconscious'];
  const highWords = ['broken','not working','leaking','sewage','smell',
    'stuck','trapped','no water','no electricity','blackout','overflowing',
    'cracked','shattered','major','severe','urgent'];

  const hitCritical = criticalWords.filter(w => desc.includes(w));
  const hitHigh = highWords.filter(w => desc.includes(w));

  let reason = 'Category: ' + (type || 'Other') + ' → ' +
    level.charAt(0).toUpperCase() + level.slice(1);

  if (hitCritical.length > 0 && levels[level] < 4) {
    level = 'critical';
    reason += ' | ⚠️ Escalated by keywords: ' + hitCritical.join(', ');
  } else if (hitHigh.length > 0 && levels[level] < 3) {
    level = 'high';
    reason += ' | ↑ Boosted by keywords: ' + hitHigh.join(', ');
  }

  return { level, reason };
}

// ==========================================================
//  API ROUTES
// ==========================================================

// ── Auth ──
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const tenant = await findTenant(email);
    if (!tenant) return res.status(401).json({ error: 'Email not found' });
    if (tenant.password !== password) return res.status(401).json({ error: 'Wrong password' });
    const { password: _, ...safe } = tenant;
    res.json(safe);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({ success: true, role: 'admin' });
  }
  res.status(401).json({ error: 'Invalid admin credentials' });
});

// ── Tenant ──
app.get('/api/tenant/:email', async (req, res) => {
  try {
    const tenant = await findTenant(req.params.email);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const { password: _, ...safe } = tenant;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/tenant/:email', async (req, res) => {
  try {
    await updateTenantFields(req.params.email, req.body);
    const updated = await findTenant(req.params.email);
    const { password: _, ...safe } = updated;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Tickets ──
app.get('/api/tickets', async (req, res) => {
  try {
    const tickets = await readTickets();
    if (req.query.email) {
      return res.json(tickets.filter(t => t.tenantEmail === req.query.email));
    }
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read tickets' });
  }
});

app.post('/api/tickets', upload.array('attachments', 5), async (req, res) => {
  try {
    const { type, desc, tenantEmail } = req.body;
    if (!type || !desc || !tenantEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const tenant = await findTenant(tenantEmail);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const id = await getNextTicketId();
    const now = new Date();
    const timeStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
      ' at ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const triage = smartTriage(type, desc);

    // Handle attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          if (DRIVE_FOLDER_ID && drive) {
            try {
              const att = await uploadFileToDrive(file.buffer, file.originalname, file.mimetype);
              attachments.push(att);
            } catch (driveErr) {
              console.error('Drive upload failed (quota/permissions), falling back to local storage:', driveErr.message);
              const att = saveFileLocally(file.buffer, file.originalname);
              attachments.push(att);
            }
          } else {
            const att = saveFileLocally(file.buffer, file.originalname);
            attachments.push(att);
          }
        } catch (uploadErr) {
          console.error('Upload error for', file.originalname, uploadErr.message);
        }
      }
    }

    const ticket = {
      id, type, desc, status: 'open',
      urgency: triage.level,
      urgencyOverridden: false,
      triageReason: triage.reason,
      time: timeStr,
      tenantEmail: tenant.email,
      tenantName: tenant.name,
      location: tenant.location,
      wing: tenant.wing,
      flat: tenant.flat,
      contact: tenant.contact,
      locationEdited: (req.body.locationEdited === 'true'),
      attachments,
    };

    await appendTicket(ticket);
    res.json(ticket);
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

app.put('/api/tickets/:id/status', async (req, res) => {
  try {
    await updateTicketCell(req.params.id, 'status', req.body.status);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tickets/:id/urgency', async (req, res) => {
  try {
    await updateTicketCell(req.params.id, 'urgency', req.body.urgency);
    await updateTicketCell(req.params.id, 'urgencyOverridden', true);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── Attachments ──
app.get('/api/attachments/:id', async (req, res) => {
  const id = req.params.id;
  try {
    if (id.startsWith('drv_')) {
      const driveId = id.substring(4);
      const meta = await drive.files.get({ fileId: driveId, fields: 'mimeType' });
      res.setHeader('Content-Type', meta.data.mimeType);
      const stream = await drive.files.get(
        { fileId: driveId, alt: 'media' },
        { responseType: 'stream' }
      );
      stream.data.pipe(res);
    } else if (id.startsWith('loc_')) {
      const filename = id.substring(4);
      const filePath = path.join(UPLOADS_DIR, filename);
      const normalizedUploadsDir = path.resolve(UPLOADS_DIR);
      const normalizedPath = path.resolve(filePath);
      
      // Security Check: prevent directory traversal (e.g. loc_../../../../etc/passwd)
      if (!normalizedPath.startsWith(normalizedUploadsDir)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      if (fs.existsSync(normalizedPath)) return res.sendFile(normalizedPath);
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(400).json({ error: 'Invalid attachment ID' });
    }
  } catch (err) {
    console.error('Attachment error:', err.message);
    res.status(404).json({ error: 'Attachment not found' });
  }
});

// ── Start Server ──
initGoogleAPIs().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✅ TenantDesk server running at http://localhost:${PORT}`);
    console.log(`   Sheet ID: ${SHEET_ID}`);
    console.log(`   Drive Folder: ${DRIVE_FOLDER_ID || '(not configured — using local storage)'}\n`);
  });
}).catch(err => {
  console.error('\n❌ Failed to start:', err.message);
  console.error('   See SETUP_GUIDE.md for help.\n');
  process.exit(1);
});
