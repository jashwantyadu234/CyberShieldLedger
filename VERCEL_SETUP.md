# 🚀 Vercel Deployment Guide for CyberShield Ledger

This guide provides step-by-step instructions for deploying **CyberShield Ledger** (Vite + React SPA Frontend & FastAPI Python Backend) to **Vercel**.

---

## 🏗️ Architecture Overview

The repository is configured for dual-mode Vercel deployment:
- **Frontend**: Vite + React + TypeScript + Tailwind CSS (served as static SPA assets with client-side routing rewrites).
- **Backend**: FastAPI Python application (executed as Vercel Serverless Python Functions via `api/index.py`).

---

## ⚡ Method 1: Deploying via Vercel Dashboard (Recommended)

### 1. Import Repository
1. Push your changes to your Git repository (GitHub, GitLab, or Bitbucket).
2. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New..."** ➔ **"Project"**.
3. Import your `CyberShieldLedger` repository.

### 2. Configure Project Settings
- **Framework Preset**: `Vite`
- **Root Directory**: `./` (leave default)
- **Build Command**: `cd frontend && npm install && npm run build` (or leave default `npm run build`)
- **Output Directory**: `frontend/dist`

### 3. Add Environment Variables
Expand the **Environment Variables** section and add the following keys:

| Environment Variable | Description | Example / Value |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini AI API key | `AIzaSy...` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `super-secret-key-change-in-prod` |
| `CORS_ORIGINS` | Allowed origins for CORS | `https://your-project.vercel.app` |
| `DATABASE_URL` *(Optional)* | PostgreSQL / Cloud Database URL for production persistence | `postgresql://user:pass@db.supabase.co:5432/postgres` |

### 4. Deploy
Click **Deploy**. Vercel will build the frontend assets and compile the Python serverless API functions automatically.

---

## 💻 Method 2: Deploying via Vercel CLI

1. Install Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```

2. Log in to Vercel:
   ```bash
   vercel login
   ```

3. Deploy Preview Build:
   ```bash
   vercel
   ```

4. Deploy to Production:
   ```bash
   vercel --prod
   ```

---

## 🌐 Method 3: Standalone Frontend Deployment (External Backend)

If you choose to host the FastAPI backend on **Render**, **Railway**, **Fly.io**, or an **AWS EC2** instance:

1. Import the repository in Vercel.
2. Set **Root Directory** to `frontend`.
3. In `frontend/src/services/api.ts` or via `vercel.json` rewrites, configure `/api` to proxy to your hosted backend:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://your-backend-api.onrender.com/api/:path*"
       },
       {
         "source": "/((?!api/).*)",
         "destination": "/index.html"
       }
     ]
   }
   ```

---

## 🗄️ Database & Storage Considerations for Vercel Serverless

> [!IMPORTANT]
> **Ephemeral Filesystem Notice**:
> Vercel Serverless Functions run on read-only containers with temporary `/tmp` storage. While the included SQLite database (`cybershield.db`) can serve read requests, changes will be reset when serverless function instances recycle.

### Production Database Recommendation:
For full data persistence across sessions on Vercel:
1. Provision a free PostgreSQL database on [Supabase](https://supabase.com), [Neon](https://neon.tech), or [ElephantSQL].
2. Set `DATABASE_URL` in your Vercel Project Environment Variables.
3. Update `backend/app/database.py` if PostgreSQL driver (`psycopg2-binary` or `asyncpg`) is used.

---

## 🔍 Verification & Troubleshooting

### SPA Client-Side Routing (404 on Refresh)
Client-side routes like `/admin/dashboard` or `/citizen/register` are automatically handled by the `rewrites` rules in `vercel.json` pointing non-API routes to `/index.html`.

### Testing Build Locally
You can test the build command before deploying:
```bash
npm run build
```
This builds the React app into `frontend/dist`.

---

## 📁 Deployment Configuration Files Included
- `vercel.json` — Main Vercel routing, framework preset, and rewrites config.
- `api/index.py` — ASGI entrypoint connecting Vercel Python runtime to `backend/app/main.py`.
- `api/requirements.txt` — Python dependencies manifest for Vercel.
- `.vercelignore` — Excludes build outputs, local DBs, node_modules, and research PDFs from deployment package.
- `frontend/vercel.json` — Standalone frontend configuration file.
