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

For an existing problem, the modal preselects its saved **Topic** and **Subtopic**. Keep these selections or change them before saving your next approach. Saved custom categories remain selectable even if they are missing from the topic list. New problems start with blank selections.

Version **1.0.1** checks for identical code before opening the modal. If the same problem and language already has that code as its primary solution or an alternate approach, no popup is shown. The comparison ignores surrounding whitespace, matching the backend's save check. If the lookup fails or takes more than five seconds, the popup remains available and the backend still checks for duplicates when saving.

The save modal only opens for a completed, accepted result tied to a new **Submit** request. **Run**, partial passes, failed submissions, and viewing old accepted submissions do not trigger it. If test counts are provided, all tests must have passed.

After updating the extension files, click **Reload** for LC Sync in `chrome://extensions`, then refresh your LeetCode tab.

Version **1.0.3** supports GraphQL `submissionDetails.statusCode`, including results without `statusDisplay`, and decodes text, JSON, Blob, and ArrayBuffer XHR responses. To diagnose a missing popup, open the LeetCode tab's DevTools **Console**, filter for `LC Sync`, and submit once. The logs show the detected submission ID, response format, GraphQL operation/result fields, verdict, and popup display, without logging submitted code or credentials.

Version **1.0.4** adds numbered `[STEP n]` diagnostics: 1–2 Submit and ID, 3–4 decoded and matched result, 5 raw verdict fields, 6 acceptance/test-count decision, 7–8 message delivery, 9 scheduled popup, 10 metadata and construction, 11 popup attached, and 12 topic loading and Save readiness. `WAIT`, `STOP`, and `ERROR` lines explain why progress stops. A non-accepted initial result remains tracked for subsequent updates for that same Submit; Run or a new Submit cancels that tracking.

Run the extension regression tests from the repository root with `node --test backend/submission-detection.test.cjs backend/categorization.test.cjs` (Node.js 18 or later).

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

| Problem                                          | Solution                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **"Connection Failed"** when testing credentials | Ensure Project URL starts with `https://` and no trailing `/`. Use the `anon public` key, not `service_role`. Re-run the SQL schema. |
| **Sync popup doesn't appear** after submitting   | Reload the LeetCode tab (`Ctrl+R`) after installing the extension. Check it's enabled in `chrome://extensions`.                      |
| **Where is my data stored?**                     | Strictly inside your personal Supabase database. No data goes to any 3rd-party servers.                                              |

---

_For full setup guide, see [SETUP.md](../SETUP.md). For schema reference, see [supabase/schema.sql](../supabase/schema.sql)._
