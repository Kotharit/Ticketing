const { google } = require('googleapis');
require('dotenv').config();
const auth = new google.auth.GoogleAuth({ keyFile: process.env.GOOGLE_CREDENTIALS_PATH, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
async function check() {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'Tenants!A1:G5' });
  console.log('Sheet A1:G5 rows:', res.data.values);
}
check();
