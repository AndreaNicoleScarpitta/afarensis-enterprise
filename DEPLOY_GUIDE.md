# Deploy Afarensis to Production

## Option A: Deploy on Replit (Recommended — simplest path)

You already have a landing page on Replit at syntheticascendancy.tech.
The Afarensis app will be a **separate Repl** that you link to from your landing page.

### Step 1: Create a new Repl

1. Go to [replit.com](https://replit.com) → **Create Repl**
2. Choose **Import from GitHub** (or **Upload folder**)
3. If uploading: zip this entire folder and upload it
4. If using GitHub: push this code to a GitHub repo first, then import

### Step 2: First run

1. Click **Run** in Replit
2. The `start.sh` script will:
   - Install Python dependencies (~2-3 minutes first time)
   - Generate a secure SECRET_KEY automatically
   - Create the SQLite database with seed data (7 users, 4 projects)
   - Start the server on port 8000
3. Replit will show a webview — you should see the Afarensis login page

### Step 3: Connect your domain

1. In Replit, go to your Repl's **Settings** → **Domains**
2. Add a custom domain: `app.syntheticascendancy.tech`
3. Replit will give you a CNAME record to add
4. Go to your domain registrar (wherever you bought syntheticascendancy.tech)
5. Add a **CNAME record**:
   - **Name**: `app`
   - **Value**: (whatever Replit gives you, like `your-repl-name.repl.co`)
   - **TTL**: 300 (or Auto)
6. Wait 5-10 minutes for DNS to propagate
7. Your app is now live at `https://app.syntheticascendancy.tech`

### Step 4: Add a launch button to your landing page

On your existing Replit landing page (syntheticascendancy.tech), add a button
or link that points to:

```
https://app.syntheticascendancy.tech
```

Something like: "Launch Platform" or "Sign In" → links to the app.

### Step 5: Deploy (make it persistent)

1. In Replit, click **Deploy** (top right)
2. Choose **Reserved VM** ($7/mo) or **Autoscale** ($0.01/hr)
3. Reserved VM is fine for MVP — always-on, no cold starts

---

## Test Login Credentials

After deployment, log in with any of these:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@afarensis.com | admin123 |
| Reviewer | reviewer1@afarensis.com | reviewer123 |
| Analyst | analyst@afarensis.com | analyst123 |
| Viewer | viewer@afarensis.com | viewer123 |

---

## Option B: Deploy on Railway (if you want PostgreSQL)

Railway gives you a managed PostgreSQL database, which is more production-grade.

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Afarensis Enterprise v2.2"
git remote add origin https://github.com/YOUR_USERNAME/afarensis-enterprise.git
git push -u origin main
```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app) → Sign in with GitHub
2. **New Project** → **Deploy from GitHub repo**
3. Select your repo
4. Railway auto-detects the Dockerfile (or use start.sh)
5. Add a **PostgreSQL** service (click **+ New** → **Database** → **PostgreSQL**)
6. Railway automatically injects `DATABASE_URL` into your app

### Step 3: Set environment variables

In Railway dashboard → your service → **Variables**:

```
SECRET_KEY=<click "Generate" or paste: openssl rand -hex 32>
DATABASE_URL=${{Postgres.DATABASE_URL}}   ← Railway auto-links this
ENVIRONMENT=production
AUTO_CREATE_TABLES=true
ENABLE_LLM_INTEGRATION=false
ALLOWED_ORIGINS=https://syntheticascendancy.tech,https://app.syntheticascendancy.tech
PORT=8000
```

### Step 4: Custom domain

1. Railway → **Settings** → **Custom Domain**
2. Add `app.syntheticascendancy.tech`
3. Add the CNAME record Railway gives you to your DNS
4. SSL is automatic

---

## DNS Setup (for either option)

At your domain registrar, add this DNS record:

| Type | Name | Value |
|------|------|-------|
| CNAME | app | (provided by Replit or Railway) |

This makes `app.syntheticascendancy.tech` point to your deployed app.

Your landing page at `syntheticascendancy.tech` stays on Replit as-is.

---

## Architecture

```
syntheticascendancy.tech           → Landing page (Replit)
                                      ↓ "Launch Platform" button
app.syntheticascendancy.tech       → Afarensis app (Replit or Railway)
                                      ├── Frontend (React, served as static files)
                                      └── Backend API (FastAPI, port 8000)
```

---

## Security Checklist (before sharing with anyone)

- [x] SECRET_KEY auto-generated (never hardcoded)
- [x] CORS locked to your domains
- [ ] Change demo user passwords (or disable seed data)
- [ ] Set up HTTPS (automatic on Replit/Railway)
- [ ] Remove /docs endpoint in production (already handled by config)

---

## Cost

| Service | Cost |
|---------|------|
| Replit Reserved VM | $7/month |
| Domain (syntheticascendancy.tech) | ~$12/year |
| **Total** | **~$8/month** |

If using Railway instead: ~$5-20/month depending on usage.
