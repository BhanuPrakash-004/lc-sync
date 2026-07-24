# 🧩 LC Sync — Chrome Extension Backend (Manifest V3)

> For the full setup guide (Supabase + Frontend + Extension), see **[SETUP.md](../SETUP.md)**.

---

## Overview

**LC Sync** is a lightweight, open-source Chrome extension that runs locally in your browser. Whenever you solve a problem on [LeetCode](https://leetcode.com), LC Sync detects the **Accepted** verdict and instantly saves:

- 📝 **Full Submitted Code** & programming language
- ⚡ **Runtime & Memory** statistics
- 📄 **Problem Title, Number, Difficulty & Topic Tags**
- 🖼️ **Full Problem Statement & Images**
- 💡 **Personal Notes & Block Editor Content**
- 🤖 **ChatGPT & YouTube Tutorial URLs**
- 🔀 **Alternate Solution Approaches** (when re-solving problems)

All your data is stored in **your private Supabase database** — 100% under your control.

---

## Quick Setup

For complete step-by-step instructions, see **[SETUP.md — Part 3](../SETUP.md#part-3----chrome-extension-backend-setup)**.

**In brief:**

1. Open `chrome://extensions` → toggle **Developer mode** ON.
2. Click **Load unpacked** → select the `backend/` folder.
3. Click the **LC Sync icon** → **Settings (gear)** → paste your Supabase URL & Anon Key.
4. Click **Test Connection** → **Save Settings**.

---

## How Auto-Sync Works

1. Navigate to any problem on [leetcode.com](https://leetcode.com/problems/).
2. Write your solution and click **Submit**.
3. When LeetCode returns an **Accepted** verdict:
   - LC Sync automatically intercepts the response in the background.
   - A sleek floating modal opens on your screen.
   - You can categorize the problem under a **Topic** & **Subtopic**, write notes, attach ChatGPT or YouTube links, and click **Save**.
4. If you solve the same problem again later, LC Sync automatically saves the new solution as an **Alternate Approach** without overwriting your original.

---

## File Structure

```
backend/
├── manifest.json        # Manifest V3 extension configuration
├── background.js        # Background service worker (Supabase API handler)
├── content.js           # Content script injected into leetcode.com
├── inject.js            # Main-world interceptor for Monaco editor & network
├── popup/
│   ├── popup.html       # Toolbar popup interface
│   ├── popup.css        # Dark theme popup styling
│   └── popup.js         # Popup controller & stats loader
├── options/
│   ├── options.html     # Extension options & credentials settings page
│   ├── guide.html       # Standalone beginner setup guide (links to SETUP.md)
│   ├── options.css      # Options page styling
│   └── options.js       # Settings controller & API validator
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **"Connection Failed"** when testing credentials | Ensure Project URL starts with `https://` and no trailing `/`. Use the `anon public` key, not `service_role`. Re-run the SQL schema. |
| **Sync popup doesn't appear** after submitting | Reload the LeetCode tab (`Ctrl+R`) after installing the extension. Check it's enabled in `chrome://extensions`. |
| **Where is my data stored?** | Strictly inside your personal Supabase database. No data goes to any 3rd-party servers. |

---

*For full setup guide, see [SETUP.md](../SETUP.md). For schema reference, see [supabase/schema.sql](../supabase/schema.sql).*
