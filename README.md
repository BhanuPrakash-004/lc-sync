# 🔄 LC Sync — LeetCode Solution & DSA Practice Manager

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
  <img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" />
  <img alt="Chrome Extension" src="https://img.shields.io/badge/Backend-Chrome%20Extension%20(MV3)-4285F4?logo=googlechrome" />
  <img alt="Made with React" src="https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB?logo=react" />
  <img alt="Supabase" src="https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?logo=supabase" />
  <img alt="Platform" src="https://img.shields.io/badge/Platform-LeetCode-FFA116?logo=leetcode" />
</p>

<p align="center">
  <strong>Automatically capture, organize, revise, and export your LeetCode solutions, alternate approaches, handwritten notes, images, and resource links — all in your private Supabase database.</strong>
</p>

---

## 🚀 Quick Start

> **New here? Read [SETUP.md](./SETUP.md) — the single step-by-step guide covering Supabase, Frontend, and Chrome Extension setup.**

---

## 📖 Table of Contents

- [💡 The Main Idea & Why LC Sync?](#-the-main-idea--why-lc-sync)
- [✨ Core Features](#-core-features)
- [🏗️ System Architecture & Workflow](#️-system-architecture--workflow)
- [📂 Sub-System Documentation](#-sub-system-documentation)
- [🤝 Contributing & Open-Source](#-contributing--open-source)
- [📄 License](#-license)

---

## 💡 The Main Idea & Why LC Sync?

When practicing Data Structures and Algorithms on **LeetCode**, native platform limitations make long-term retention difficult:

1. **LeetCode only stores plain text code**: You cannot attach **handwritten notes images**, **whiteboard solution diagrams**, **ChatGPT screenshots**, or **YouTube tutorial screenshots**.
2. **Scatter & Loss**: Alternate solution approaches (e.g. *Brute Force O(N²)* vs. *Optimal Two-Pointer O(N)*) get overwritten or lost across multiple submissions.
3. **The Forgetting Curve**: Weeks after solving a problem, it is hard to recall the underlying core concept or pattern without re-solving it from scratch.

### 🚀 The Solution: LC Sync
**LC Sync** bridges this gap by providing an end-to-end ecosystem:
- **Backend Extension**: Automatically intercepts your **Accepted** submissions on `leetcode.com` and opens an interactive modal to capture your code, notes, images, and resources.
- **Private Database**: Stores 100% of your data in your own **Supabase PostgreSQL** instance.
- **Frontend Dashboard**: A modern web application (run locally or hosted on Vercel) for pattern-based revision, category management, and offline PDF generation.

---

## ✨ Core Features

### 1. All-in-One Solution & Media Organizer
- 📝 **Full Code & Alternate Approaches**: Save your primary solution and store **multiple alternate code implementations** (e.g., Python vs C++, Iterative vs Recursive) side-by-side.
- 🖼️ **Image & Screenshot Support**: Upload handwritten whiteboard sketches, solution diagrams, ChatGPT explanations, or YouTube screenshots directly to your problem notes.
- 🔗 **Resource Link Management**: Attach specific **ChatGPT prompt links** and **YouTube video tutorial links** to each alternate approach.
- 📝 **Notion-Style Block Notes**: Interactive rich-text block editor (`BlockEditor.jsx`) supporting H1/H2 headings, callout boxes (💡), code blocks, and dividers.

---

### 2. Smart Spaced-Repetition Revision Manager
Solve the forgetting curve problem during interview preparation!
- 🏷️ **Pattern Categorization**: Solutions are categorized by **Main Topics** (*Dynamic Programming*, *Graph*, *Tree*) and **Subtopic Patterns** (*Sliding Window*, *Topological Sort*, *Monotonic Stack*).
- 📊 **Confidence Scores**: Assign a **Confidence Score (0%–100%)** and completion status to each topic pattern.
- ⚡ **Low-Confidence Filter ("Needs Revision <70%")**: One-click filter isolates topics where your confidence is weak.

---

### 3. Custom PDF Generator & Offline Study Guide Exporter
Download printable PDF study guides to review offline or share without needing web access:
- 📄 **Flexible Scope Selection**: Export All Solved Problems, By Specific Topic or Subtopic, or Custom Selected Questions.
- 🖨️ **Complete Content Export**: Includes problem titles, difficulty badges, full problem descriptions, syntax-highlighted code for all alternate approaches, personal notes, ChatGPT URLs, and YouTube tutorial links.

---

### 4. Visual Analytics & Submission Heatmap
- 📈 **Overview Metrics**: Total solved problems, Easy/Medium/Hard breakdown, active revision streak, and average solution quality.
- 🟩 **Activity Heatmap**: 12-week GitHub-style contribution grid displaying daily submission intensity.

---

## 🏗️ System Architecture & Workflow

```
+-----------------------------------------------------------------------+
|                            USER BROWSER                               |
|                                                                       |
|   +-----------------------+           +---------------------------+   |
|   |  LeetCode.com Tab     |           |  LC Sync Web App          |   |
|   |  (Chrome Extension)   |           |  (Localhost / Vercel)     |   |
|   |                       |           |                           |   |
|   |  Submits code ->      |           |  Displays dashboards,     |   |
|   |  Intercepts Accepted  |           |  revises by confidence,   |   |
|   |  verdict & POSTs DB   |           |  & exports study PDFs     |   |
|   +-----------+-----------+           +-------------+-------------+   |
+---------------|-------------------------------------|-----------------+
                |                                     |
                +-----------------+  +----------------+
                                  |  |
                                  v  v
                    +------------------------------+
                    |    Your Supabase Project     |
                    |    (PostgreSQL Database)     |
                    |  - submissions, topics, etc. |
                    +------------------------------+
```

---

## 📂 Sub-System Documentation

| Module | Link | Description |
|--------|------|-------------|
| 📋 **Full Setup Guide** | [`SETUP.md`](./SETUP.md) | Step-by-step setup for Supabase, Frontend, and Chrome Extension. |
| 🧩 **Extension Backend** | [`backend/README.md`](./backend/README.md) | Extension architecture, Manifest V3 background scripts, content script interceptors, and options page guide. |
| 🖥️ **Web Dashboard Frontend** | [`frontend/README.md`](./frontend/README.md) | React 18 page walkthroughs, component tree, and Vercel hosting setup. |
| 🗄️ **Database Schema** | [`supabase/schema.sql`](./supabase/schema.sql) | Canonical database script containing all DDL statements, RLS policies, seed data, and RPC functions. |

---

## 🤝 Contributing & Open-Source

**LC Sync** is an open-source project built for the competitive programming and job-seeking developer community. Contributions of all kinds are warmly welcomed!

### How to Contribute:
1. **Fork** the repository and create a feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```
2. **Make your changes** and test both extension and frontend builds:
   ```bash
   cd frontend && npm run build
   ```
3. **Commit** your changes with clear messages:
   ```bash
   git commit -m "feat: add PDF custom theme selection"
   ```
4. **Push** to your branch and open a **Pull Request** on GitHub!

---

## 📄 License

This project is open-source software licensed under the **[MIT License](./LICENSE)**.

```
MIT License
Copyright (c) 2026 LC Sync Contributors
```

---

<p align="center">
  Built with ❤️ to make Data Structures & Algorithms preparation fast, organized, and stress-free.<br/>
  If LC Sync helps your interview prep, don't forget to give it a ⭐ on GitHub!
</p>
