/**
 * popup.js — Controller script for LC Sync Extension Popup UI
 *
 * Responsibilities:
 *  - Queries background service worker for Supabase connection health
 *  - Displays sync statistics and recent submission history
 *  - Manages navigation to Options page and Web Application Dashboard
 */

// ─────────────────────────────────────────────
// DOM references (resolved after DOMContentLoaded)
// ─────────────────────────────────────────────
let statusDot;
let connectionBanner;
let connectionText;
let submissionCount;
let submissionsList;
let openDashboardBtn;
let openOptionsBtn;
let refreshBtn;
let versionText;

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

/**
 * Send a message to the background service worker.
 * Returns a Promise that resolves with the response.
 */
function sendBgMessage(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[LC Sync Popup] Runtime error:', chrome.runtime.lastError);
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Format a UTC ISO timestamp into a human-readable relative date.
 * e.g. "2 hours ago", "Yesterday", "Jul 12"
 */
function formatRelativeDate(isoString) {
  if (!isoString) return '';
  const date  = new Date(isoString);
  const now   = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr  / 24);

  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffHr  < 24)  return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7)   return `${diffDay}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Map difficulty string to CSS class.
 */
function difficultyClass(difficulty) {
  if (!difficulty) return 'difficulty-unknown';
  const d = difficulty.toLowerCase();
  if (d === 'easy')   return 'difficulty-easy';
  if (d === 'medium') return 'difficulty-medium';
  if (d === 'hard')   return 'difficulty-hard';
  return 'difficulty-unknown';
}

// ─────────────────────────────────────────────
// UI Update Functions
// ─────────────────────────────────────────────

/** Show the connection status banner and update the dot */
function updateConnectionUI(isConnected, errorMsg = '') {
  statusDot.className = `status-dot ${isConnected ? 'status-connected' : 'status-error'}`;

  if (isConnected) {
    connectionBanner.className  = 'connection-banner banner-connected';
    connectionText.textContent  = '✓ Connected to Supabase';
  } else {
    connectionBanner.className  = 'connection-banner banner-error';
    connectionText.textContent  = errorMsg
      ? `✗ ${errorMsg}`
      : '✗ Not connected — open Settings to configure';
  }
}

/** Render the recent submissions list */
function renderSubmissions(submissions) {
  submissionsList.innerHTML = '';

  if (!submissions || submissions.length === 0) {
    submissionsList.innerHTML = '<div class="placeholder">No submissions yet. Solve a problem on LeetCode!</div>';
    return;
  }

  submissions.forEach((sub) => {
    const item = document.createElement('div');
    item.className = 'submission-item';

    const left = document.createElement('div');
    left.className = 'submission-left';

    const titleEl = document.createElement('div');
    titleEl.className   = 'submission-title';
    titleEl.textContent =
      sub.problem_number
        ? `#${sub.problem_number} · ${sub.problem_title || 'Unknown'}`
        : (sub.problem_title || 'Unknown Problem');

    const metaEl = document.createElement('div');
    metaEl.className   = 'submission-meta';
    const langText     = sub.language ? `${sub.language} · ` : '';
    metaEl.textContent = `${langText}${formatRelativeDate(sub.submitted_at)}`;

    left.appendChild(titleEl);
    left.appendChild(metaEl);

    const badge = document.createElement('span');
    badge.className   = `difficulty-badge ${difficultyClass(sub.difficulty)}`;
    badge.textContent = sub.difficulty || '?';

    item.appendChild(left);
    item.appendChild(badge);
    submissionsList.appendChild(item);
  });
}

/** Show an error state in the submissions list */
function renderSubmissionsError(message) {
  submissionsList.innerHTML = `<div class="error-msg">${message}</div>`;
}

// ─────────────────────────────────────────────
// Data Fetching
// ─────────────────────────────────────────────

async function loadPopupData() {
  // Reset UI
  statusDot.className          = 'status-dot status-unknown';
  connectionBanner.className   = 'connection-banner banner-loading';
  connectionText.textContent   = 'Checking Supabase connection…';
  submissionCount.textContent  = '—';
  submissionsList.innerHTML    = '<div class="placeholder">Loading…</div>';

  // 1. Check if credentials are even set
  const credStatus = await sendBgMessage('GET_CREDENTIALS_STATUS');
  if (!credStatus || !credStatus.configured) {
    updateConnectionUI(false, 'Credentials not configured');
    submissionsList.innerHTML =
      '<div class="placeholder">Add your Supabase credentials in Settings.</div>';
    return;
  }

  // 2. Fetch stats (count + recent submissions)
  const stats = await sendBgMessage('FETCH_STATS');

  if (!stats) {
    updateConnectionUI(false, 'Could not reach background worker');
    renderSubmissionsError('Extension error — try reloading');
    return;
  }

  if (!stats.success) {
    updateConnectionUI(false, stats.error || 'Connection failed');
    renderSubmissionsError(stats.error || 'Failed to load data');
    return;
  }

  // Success
  updateConnectionUI(true);
  submissionCount.textContent = stats.count !== undefined ? stats.count : '—';
  renderSubmissions(stats.recentSubmissions);
}

// ─────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Resolve DOM refs
  statusDot         = document.getElementById('statusDot');
  connectionBanner  = document.getElementById('connectionBanner');
  connectionText    = document.getElementById('connectionText');
  submissionCount   = document.getElementById('submissionCount');
  submissionsList   = document.getElementById('submissionsList');
  openDashboardBtn  = document.getElementById('openDashboard');
  openOptionsBtn    = document.getElementById('openOptions');
  refreshBtn        = document.getElementById('refreshBtn');
  versionText       = document.getElementById('versionText');

  // Version label
  const manifest = chrome.runtime.getManifest();
  versionText.textContent = `v${manifest.version}`;

  // ── Button: Settings ──────────────────────
  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // ── Button: Dashboard ─────────────────────
  openDashboardBtn.addEventListener('click', () => {
    chrome.storage.sync.get(['dashboardUrl'], ({ dashboardUrl }) => {
      if (dashboardUrl) {
        chrome.tabs.create({ url: dashboardUrl });
      } else {
        // Fallback: open options so user can configure the URL
        chrome.runtime.openOptionsPage();
      }
    });
  });

  // ── Button: Refresh ───────────────────────
  refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.4s';
    loadPopupData().then(() => {
      setTimeout(() => {
        refreshBtn.style.transform  = '';
        refreshBtn.style.transition = '';
      }, 400);
    });
  });

  // Load initial data
  await loadPopupData();
});
