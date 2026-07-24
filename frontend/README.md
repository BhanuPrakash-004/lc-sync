# ⚡ LC Sync — Frontend Web Application

> For the full setup guide (Supabase + Frontend + Extension), see **[SETUP.md](../SETUP.md)**.

---

## Overview

**LC Sync Frontend** is a single-page web application built with **React 18**, **Vite**, **TanStack Query (React Query)**, and **Tailwind CSS**. It connects directly to your personal **Supabase PostgreSQL database** using the PostgREST API and Supabase JS client.

When the app loads without Supabase environment variables configured, it automatically shows a **Setup Page** guiding the user through configuration — it will not crash.

---

## Quick Setup

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Create environment file
cp .env.example .env.local
# Edit .env.local and add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Start development server
npm run dev
# -> http://localhost:5173
```

For Vercel deployment and detailed instructions, see **[SETUP.md — Part 2](../SETUP.md#part-2----frontend-web-dashboard-setup)**.

---

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_SUPABASE_URL` | **Yes** | Your Supabase project URL | `https://xyzxyzxyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Supabase anon public API key | `eyJhbGciOiJIUzI1Ni...` |
| `VITE_AUTH_ENABLED` | No | Enables Supabase Auth login page (`true` / `false`) | `false` |

> If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing, the app renders the Setup Page instead of crashing.

---

## Pages Overview

| Page | File | Description |
|------|------|-------------|
| Dashboard | `src/pages/Dashboard.jsx` | Analytics overview: stats, heatmap, recent submissions |
| Problem Detail | `src/pages/ProblemDetail.jsx` | Full solution viewer, alternate approaches, block notes |
| Revision Manager | `src/pages/Revision.jsx` | Spaced-repetition review by topic & confidence |
| Problems Directory | `src/pages/Problems.jsx` | Searchable & filterable catalog of all submissions |
| Topic Manager | `src/pages/TopicsManager.jsx` | CRUD interface for topics & subtopics |
| PDF Generator | `src/pages/DownloadPDF.jsx` | Custom PDF export for offline study |
| Settings | `src/pages/Settings.jsx` | App settings |
| Setup Page | `src/pages/SetupPage.jsx` | First-run guide shown when Supabase is not configured |

---

## Component Reference

| Component | Location | Description |
|-----------|----------|-------------|
| `ActivityChart.jsx` | `src/components/` | 12-week GitHub-style heatmap |
| `BlockEditor.jsx` | `src/components/` | Notion-style block editor (H1, H2, callouts, code) |
| `CodeEditor.jsx` | `src/components/` | Syntax-highlighted code viewer & editor |
| `Layout.jsx` | `src/components/` | Sidebar + header + mobile nav shell |
| `LeftPanel.jsx` | `src/components/problem-detail/` | Problem description, tags, topic dropdowns |
| `CodePanels.jsx` | `src/components/problem-detail/` | Multi-tab alternate approach manager |
| `Modals.jsx` | `src/components/problem-detail/` | Confirmation & input modal dialogs |

---

## Authentication Model

| Mode | Setting | Behavior |
|------|---------|----------|
| **Public / Single-User** *(Default)* | `VITE_AUTH_ENABLED=false` | No login required. Perfect for local dev or private Vercel links. |
| **Protected Deployment** | `VITE_AUTH_ENABLED=true` | Shows login page backed by Supabase Auth email/password. |

> `localhost` always bypasses authentication regardless of the setting.

For step-by-step auth setup, see **[SETUP.md — Section 2.6](../SETUP.md#26-optional-enable-password-login-supabase-auth)**.
