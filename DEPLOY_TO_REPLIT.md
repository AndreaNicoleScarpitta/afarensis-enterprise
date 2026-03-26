# Deploy Afarensis Enterprise to Replit — Step by Step

**Time needed:** ~15 minutes
**Difficulty:** Copy-paste level

---

## What You'll End Up With

- A **new Replit app** running Afarensis (backend API + frontend UI) at `https://your-app-name.replit.app`
- A **button on your existing Next.js site** that takes users to the Afarensis login page

---

## PART 1: Create the Afarensis Replit App

### Step 1: Create a new Replit

1. Go to [replit.com](https://replit.com)
2. Click **"+ Create Repl"**
3. Choose **"Import from GitHub"** or **"Blank Repl"** with **Python** template
4. Name it something like `afarensis-platform`
5. Click **Create**

### Step 2: Upload the project files

**Option A — Drag and drop (easiest):**
1. On your computer, open this folder:
   ```
   AfarensisEnterprise-v2.1-FIXED-COMPLETE
   ```
2. Select these folders/files and drag them into the Replit file panel:
   - `backend/` (the whole folder)
   - `frontend/` (the whole folder)
   - `start.sh`
   - `.replit`
   - `replit.nix`
   - `.gitignore`

**Option B — GitHub (better for updates):**
1. Push this project to a GitHub repo
2. In Replit, use "Import from GitHub" and paste the repo URL

### Step 3: Verify file structure

Your Replit should look like this:
```
your-repl/
├── .replit              ← tells Replit how to run
├── replit.nix           ← tells Replit what system packages to install
├── start.sh             ← startup script (installs deps, generates secrets, runs server)
├── .gitignore
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   ├── api/
│   │   ├── models/
│   │   ├── services/
│   │   └── ...
│   ├── requirements-prod.txt
│   └── .env.example
└── frontend/
    └── dist/            ← pre-built React app (already included)
        ├── index.html
        ├── assets/
        ├── css/
        └── js/
```

**IMPORTANT:** Make sure `frontend/dist/` is present with `index.html` inside it. This is the pre-built frontend — you do NOT need Node.js on Replit.

### Step 4: Click "Run"

1. Click the big green **"Run"** button in Replit
2. You'll see output like:
   ```
   ========================================
     Afarensis Enterprise v2.0
     Starting up...
   ========================================
   [1/3] Installing Python dependencies (first run only)...
         Done.
   [2/3] Generating .env with secure SECRET_KEY...
         Done. SECRET_KEY generated.
   [3/3] Starting Uvicorn on port 8000...
   ========================================

   INFO:     Started server process
   INFO:     Waiting for application startup.
   INFO:     Creating database tables...
   INFO:     Database tables created/verified
   INFO:     Seeding database with demo data...
   INFO:     Application startup complete.
   ```
3. A **webview** panel will open showing the Afarensis login page
4. The URL will be something like: `https://afarensis-platform.your-username.replit.app`

### Step 5: Log in

Use the demo admin account:
- **Email:** `admin@afarensis.com`
- **Password:** `admin123`

Other demo accounts:
| Email | Password | Role |
|-------|----------|------|
| reviewer1@afarensis.com | reviewer123 | Reviewer |
| reviewer2@afarensis.com | reviewer123 | Reviewer |
| analyst@afarensis.com | analyst123 | Analyst |
| viewer@afarensis.com | viewer123 | Viewer |

### Step 6: Copy your Replit URL

Your app is now live! Copy the URL from the webview panel. It looks like:
```
https://afarensis-platform.your-username.replit.app
```

You'll need this for Part 2.

---

## PART 2: Connect Your Existing Next.js Site

You want a button on your existing Next.js Replit site that takes users to Afarensis. Here's how:

### Option A: Simple redirect button (easiest)

Add this anywhere in your Next.js app (e.g., in a dashboard page or nav bar):

```tsx
// components/AfarensisButton.tsx

export default function AfarensisButton() {
  const AFARENSIS_URL = "https://afarensis-platform.your-username.replit.app"

  return (
    <a
      href={AFARENSIS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      Open Afarensis Platform →
    </a>
  )
}
```

**Replace** `your-username` with your actual Replit username and `afarensis-platform` with your actual Repl name.

### Option B: Redirect route (if you want a clean URL)

Create a new page in your Next.js app that automatically redirects:

```tsx
// app/afarensis/page.tsx  (App Router)
// or
// pages/afarensis.tsx     (Pages Router)

"use client"
import { useEffect } from 'react'

export default function AfarensisRedirect() {
  const AFARENSIS_URL = "https://afarensis-platform.your-username.replit.app"

  useEffect(() => {
    window.location.href = AFARENSIS_URL
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Redirecting to Afarensis Enterprise...</p>
    </div>
  )
}
```

Now visiting `https://your-nextjs-site.replit.app/afarensis` will redirect to the platform.

### Option C: Redirect directly to login page

If you want to send users straight to login:

```tsx
const AFARENSIS_LOGIN = "https://afarensis-platform.your-username.replit.app/login"
```

The login page is the default landing page for unauthenticated users — any URL will redirect to login if the user isn't logged in.

---

## PART 3: Keep It Running (Optional)

### Always-on (Replit paid plan)

If you're on Replit's **Hacker** or **Pro** plan:
1. Go to your Repl settings
2. Enable **"Always On"**
3. Your app stays running 24/7

### Free plan

On the free plan, your Repl sleeps after ~30 minutes of inactivity. It wakes up automatically when someone visits the URL (takes ~15 seconds to cold-start).

---

## TROUBLESHOOTING

### "Module not found" errors on startup

The `start.sh` script installs from `requirements-prod.txt` (slim version). If you see import errors:
```bash
# In the Replit shell, run:
cd backend
pip install -r requirements-prod.txt
```

### "Address already in use" error

```bash
# In the Replit shell:
kill -9 $(lsof -t -i:8000)
```
Then click Run again.

### Login doesn't work / 500 error

The database might be corrupted. Delete it and restart:
```bash
# In the Replit shell:
rm backend/afarensis.db
```
Then click Run again. It will re-create the database and re-seed demo data.

### Blank page (no frontend)

Make sure `frontend/dist/index.html` exists. If it's missing, the frontend wasn't uploaded. Re-upload the `frontend/dist/` folder.

### CORS errors in browser console

If you see CORS errors, the backend needs to know your Replit URL. Edit `backend/.env` and add:
```
ALLOWED_ORIGINS=["https://afarensis-platform.your-username.replit.app","https://your-nextjs-site.replit.app"]
```
Then restart.

---

## CHANGING THE DEMO PASSWORDS

For security, change the demo passwords after first login:

1. Log in as `admin@afarensis.com` / `admin123`
2. Go to Admin > User Management
3. Update passwords for all demo accounts

Or delete the database and modify `backend/app/seed_data.py` with stronger passwords before running.

---

## ARCHITECTURE OVERVIEW

```
Your Next.js Replit          Afarensis Replit
┌──────────────────┐         ┌──────────────────────────────────┐
│                  │         │                                  │
│  Your Website    │─────────│  FastAPI Backend (port 8000)     │
│                  │ redirect│  ├── /api/v1/* (REST API)        │
│  [Afarensis      │────────▶│  ├── /health  (health check)    │
│   Button]        │         │  ├── /docs    (API docs)        │
│                  │         │  └── /*       (React frontend)  │
└──────────────────┘         │                                  │
                             │  SQLite Database                 │
                             │  └── afarensis.db                │
                             └──────────────────────────────────┘
```

The FastAPI backend serves both the API and the pre-built React frontend as static files. Everything runs in a single Replit app — no separate frontend hosting needed.
