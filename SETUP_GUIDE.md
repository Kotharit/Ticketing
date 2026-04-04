# TenantDesk — Google Cloud Setup Guide

## Step 1: Create the Service Account Key File

You already have a Google Cloud project. Now do the following:

1. Go to **Google Cloud Console** → https://console.cloud.google.com/
2. Make sure your project is selected in the top dropdown
3. In the left sidebar, click **APIs & Services** → **Enabled APIs & Services**
4. Click **+ ENABLE APIS AND SERVICES** at the top
5. Search for **Google Sheets API** → click it → click **ENABLE**
6. Search for **Google Drive API** → click it → click **ENABLE**
7. Now go to **APIs & Services** → **Credentials** (in the left sidebar)
8. Click **+ CREATE CREDENTIALS** at the top → select **Service account**
9. Give it a name like `tenantdesk-service` → click **CREATE AND CONTINUE**
10. For the role, select **Editor** → click **CONTINUE** → click **DONE**
11. You'll see your new service account in the list. Click on its **email address**
12. Go to the **KEYS** tab at the top
13. Click **ADD KEY** → **Create new key** → select **JSON** → click **CREATE**
14. A `.json` file will download to your computer — this is your key!
15. **Rename it** to `credentials.json`
16. **Move it** into your project folder: `/Users/ismailmustafa/Desktop/ticketing module/credentials.json`

> The service account email looks like: `tenantdesk-service@your-project.iam.gserviceaccount.com`
> You will need this email in Step 2 and Step 3.

---

## Step 2: Set Up Your Google Sheet

1. Go to https://sheets.google.com → Create a **new blank spreadsheet**
2. Name it **TenantDesk Database**
3. **Rename the first tab** (bottom of screen) to: `Tenants`
4. In the `Tenants` tab, add this header row in Row 1:

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| name | email | location | wing | flat | contact | password |

5. Paste your 80 tenant records starting from Row 2 (each tenant in one row)
   - Every tenant's password column should be: `1234`

6. **Create a second tab**: Click the **+** button at the bottom → name it `Tickets`
7. In the `Tickets` tab, add this header row in Row 1:

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | type | desc | status | urgency | urgencyOverridden | triageReason | time | tenantEmail | tenantName | location | wing | flat | contact | locationEdited | attachments |

8. Leave the Tickets tab empty (tickets will be created through the app)

9. **Share the sheet** with your service account:
   - Click **Share** (top right of the spreadsheet)
   - Paste your service account email (from Step 1, step 11)
   - Set permission to **Editor**
   - Uncheck "Notify people"
   - Click **Share**

10. **Copy the Spreadsheet ID** from the URL bar:
    ```
    https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_IS_THIS_PART/edit
    ```
    The Sheet ID is the long string between `/d/` and `/edit`

---

## Step 3: Set Up Google Drive Folder (for attachments)

1. Go to https://drive.google.com
2. Click **+ New** → **New folder** → name it `TenantDesk Attachments`
3. Open the folder
4. Click **Share** (top right) → paste your service account email → set to **Editor** → Share
5. Copy the **Folder ID** from the URL:
   ```
   https://drive.google.com/drive/folders/YOUR_FOLDER_ID_IS_THIS_PART
   ```

---

## Step 4: Create Your .env File

The `.env` file tells the server where to find your Google Sheet, your credentials, and your Drive folder. Here's how to create it step by step:

### 4a. Open Terminal and create the file

Open **Terminal** on your Mac and run this command to create a copy:

```bash
cp "/Users/ismailmustafa/Desktop/ticketing module/.env.example" "/Users/ismailmustafa/Desktop/ticketing module/.env"
```

### 4b. Find your Spreadsheet ID

1. Open your **TenantDesk Database** Google Sheet in Chrome
2. Look at the URL bar. It looks something like this:
   ```
   https://docs.google.com/spreadsheets/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ_0123456789/edit#gid=0
   ```
3. The **Sheet ID** is the long string between `/d/` and `/edit`:
   ```
   1aBcDeFgHiJkLmNoPqRsTuVwXyZ_0123456789
   ```
   Select it and copy it (Cmd+C)

### 4c. Find your Drive Folder ID

1. Open your **TenantDesk Attachments** folder in Google Drive
2. Look at the URL bar:
   ```
   https://drive.google.com/drive/folders/1xYz_AbCdEfGhIjKlMnOpQrStUv
   ```
3. The **Folder ID** is everything after `/folders/`:
   ```
   1xYz_AbCdEfGhIjKlMnOpQrStUv
   ```

### 4d. Edit the .env file

Open the `.env` file in any text editor (or VS Code) and replace the placeholder values:

```bash
open -a TextEdit "/Users/ismailmustafa/Desktop/ticketing module/.env"
```

Make it look like this (using YOUR actual IDs — these are examples):

```
# Paste your real Spreadsheet ID here (from Step 4b)
GOOGLE_SHEET_ID=1aBcDeFgHiJkLmNoPqRsTuVwXyZ_0123456789

# This should already be correct — leave it as is
GOOGLE_CREDENTIALS_PATH=./credentials.json

# Paste your real Drive Folder ID here (from Step 4c)
GOOGLE_DRIVE_FOLDER_ID=1xYz_AbCdEfGhIjKlMnOpQrStUv

# Leave these as is
PORT=3000
ADMIN_USER=admin
ADMIN_PASS=admin123
```

**Save the file** (Cmd+S) and close it.

### 4e. Verify your project folder

At this point, your project folder should contain these files:
```
ticketing module/
├── .env                  ← you just created this
├── .env.example          ← template (already existed)
├── .gitignore
├── credentials.json      ← your Google key file (from Step 1)
├── package.json
├── server.js
├── SETUP_GUIDE.md
├── public/
│   └── index.html        ← the frontend (we'll create this next)
└── ticketing module.html  ← the original file (kept for reference)
```

If `credentials.json` is NOT in the folder yet, go back to Step 1 and move the downloaded JSON file there.

---

## Step 5: Start the App

Open Terminal and run these commands one at a time:

```bash
cd "/Users/ismailmustafa/Desktop/ticketing module"
npm install
npm start
```

You should see output like:
```
Google APIs initialized successfully.

✅ TenantDesk server running at http://localhost:3000
   Sheet ID: 1aBcDeFgHiJkLmNoPqRsTuVwXyZ_0123456789
   Drive Folder: 1xYz_AbCdEfGhIjKlMnOpQrStUv
```

If you see an error instead, check:
- Is `credentials.json` in the project folder?
- Did you paste the correct Sheet ID and Folder ID in `.env`?
- Did you share the Sheet AND the Drive folder with your service account email?

Open http://localhost:3000 in your browser.
