# 🚀 LC Sync — Complete Setup Guide

> **This is the single authoritative setup guide.** Follow the 3 parts in order: Supabase → Frontend → Backend (Chrome Extension).

---

## ⏱️ Estimated Time: 5–10 minutes

---

## Part 1 — 🗄️ Supabase Database Setup

Your data lives 100% in your own private Supabase PostgreSQL project. Start here first.

### 1.1 Create a Free Supabase Project

1. Go to [supabase.com](https://supabase.com) and click **Sign Up** (free tier is sufficient).
2. Click **New Project**.
3. Fill in:
   - **Name**: `lc-sync` (or any name you prefer)
   - **Database Password**: Set a secure password (save it somewhere)
   - **Region**: Choose the region closest to you
4. Click **Create new project** and wait **~2 minutes** for provisioning to complete.

### 1.2 Run the Database Migration Script

1. In your Supabase Dashboard, click **SQL Editor** in the left sidebar.
2. Click **New Query**.
3. Open [`supabase/schema.sql`](./supabase/schema.sql) from this repository, copy its **entire content**, paste it into the editor, and click **Run**.

   > ✅ This creates all tables (`submissions`, `topics`, `subtopics`, `notes`), indexes, Row Level Security policies, default topic/subtopic seed data, RPC functions, and the `submission-images` storage bucket.

   > **Already set up?** Don't re-run `schema.sql`. Run [`supabase/upgrade_query_indexes.sql`](./supabase/upgrade_query_indexes.sql) once instead to get the current indexes.

### 1.3 Copy Your API Credentials

After running the schema:

1. In your Supabase Dashboard, navigate to **Project Settings → API**.
2. Copy and save these two values — you will need them for both the Frontend and the Extension:

   | Value | Where to find it |
   |-------|-----------------|
   | **Project URL** | `https://your-project-id.supabase.co` |
   | **anon public Key** | Long JWT string starting with `eyJ...` |

---

## Part 2 — 🖥️ Frontend Web Dashboard Setup

The frontend is a React + Vite app. You can run it **locally** or **deploy it to Vercel for free**.

### 2.1 Clone the Repository

```bash
git clone https://github.com/BhanuPrakash-004/lc-sync.git
cd lc-sync
```

### 2.2 Configure Environment Variables

```bash
cd frontend
cp .env.example .env.local
```

Open `.env.local` and fill in your Supabase credentials from Part 1:

```env
# Supabase project credentials (Settings -> API)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Set to "true" to require login (Supabase Auth). Leave "false" for open access.
VITE_AUTH_ENABLED=false
```

> **Warning:** If you skip this step and open the app without `.env.local`, the app will still deploy/launch — it will show a **Setup Page** guiding you through configuration instead of crashing.

### 2.3 Option A — Run Locally

```bash
# (Already inside frontend/)
npm install
npm run dev
# -> Dashboard live at http://localhost:5173
```

### 2.4 Option B — Deploy to Vercel (Recommended)

Deploy once and access your dashboard from any device.

1. Push your repository to **GitHub**.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your `lc-sync` repo.
3. Set **Root Directory** to `frontend`.
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` → `https://your-project-id.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` → `eyJ...`
   - `VITE_AUTH_ENABLED` → `false` *(or `true` for password protection)*
5. Click **Deploy**.
6. Copy your deployed URL (e.g. `https://your-app.vercel.app`) — you'll paste it into the Chrome Extension settings in Part 3.

### 2.5 Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_SUPABASE_URL` | **Yes** | Your Supabase project URL | `https://xyzxyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Supabase anon public API key | `eyJhbGci...` |
| `VITE_AUTH_ENABLED` | No | Enable login screen (`true` / `false`) | `false` |

### 2.6 Optional: Enable Password Login (Supabase Auth)

By default (`VITE_AUTH_ENABLED=false`) the app is open access — perfect for local use or a private Vercel URL. If you want to password-protect your deployed dashboard:

1. In Supabase Dashboard → **Authentication → Providers** → enable **Email**.
2. *(Optional)* Under **Authentication → Settings**, uncheck **Confirm email** so users can log in immediately.
3. Go to **Authentication → Users → Add user → Create user**. Enter your email and a strong password.
4. Set `VITE_AUTH_ENABLED=true` in your Vercel Environment Variables (or `.env.local`).

> **Note:** `localhost` always bypasses authentication — you will never get locked out during local development.

---

## Part 3 — 🧩 Chrome Extension Backend Setup

The extension auto-captures your Accepted LeetCode submissions and saves them to your Supabase database.

### 3.1 Load the Extension into Chrome

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle **ON** the **Developer mode** switch in the top-right corner.
3. Click **Load unpacked** (top-left).
4. Select the **`backend/`** folder from this repository.
5. You will see the **LC Sync** extension appear with an orange icon.

### 3.2 Configure the Extension

1. Click the **LC Sync icon** in your Chrome toolbar.
2. Click the **Settings / gear icon** to open the Options page (`options.html`).
3. Paste your credentials:
   - **Supabase URL**: `https://your-project-id.supabase.co`
   - **Supabase Anon Key**: `eyJ...`
   - **Dashboard URL** *(optional)*: Your Vercel app URL (e.g. `https://your-app.vercel.app`)
4. Click **Test Connection** — you should see a green success message.
5. Click **Save Settings**.

### 3.3 Verify It Works

1. Navigate to any problem on [leetcode.com](https://leetcode.com/problems/).
2. Write and submit your solution.
3. When LeetCode returns an **Accepted** verdict, LC Sync will automatically:
   - Capture your code, runtime, memory, and problem statement
   - Open an interactive modal so you can add notes, topics, and alternate approaches
   - Save everything to your Supabase database

---

## You're All Set!

| Component | Status |
|-----------|--------|
| Supabase Database | Tables + RLS + seed data created |
| Frontend Dashboard | Running locally or deployed on Vercel |
| Chrome Extension | Installed and connected to Supabase |

Open your dashboard and go solve some problems!

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Frontend shows Setup Page** | Your `.env.local` is missing or has wrong values. Double-check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. |
| **Extension shows "Connection Failed"** | Verify your Supabase URL and Anon Key in the Options page. Check that RLS policies were created (re-run the schema SQL). |
| **No data appears in dashboard after solving** | Make sure the extension is enabled in `chrome://extensions`. Try refreshing the dashboard. |
| **Login page appears unexpectedly** | Set `VITE_AUTH_ENABLED=false` in your environment variables, or create a Supabase Auth user. |
| **Images not uploading** | The `submission-images` storage bucket may not exist. Re-run the full `supabase/schema.sql` script. |

---

*For detailed architecture, component references, and feature documentation, see the [main README](./README.md).*
