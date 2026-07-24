/**
 * options.js — Options & Configuration Page Controller
 *
 * Responsibilities:
 *  - Manages Supabase URL and API Key storage in chrome.storage.sync
 *  - Validates API connection and Supabase schema accessibility
 *  - Controls sidebar section navigation, SQL schema clipboard copying, and custom topic management
 */

'use strict';

// ─────────────────────────────────────────────
// DOM References
// ─────────────────────────────────────────────
const supabaseUrlInput     = document.getElementById('supabaseUrl');
const supabaseKeyInput     = document.getElementById('supabaseKey');
const dashboardUrlInput    = document.getElementById('dashboardUrl');

const saveCredentialsBtn   = document.getElementById('saveCredentialsBtn');
const testConnectionBtn    = document.getElementById('testConnectionBtn');
const saveDashboardBtn     = document.getElementById('saveDashboardBtn');
const toggleKeyBtn         = document.getElementById('toggleKey');
const copySqlBtn           = document.getElementById('copySqlBtn');
const refreshBtn           = document.getElementById('refreshBtn');

const credentialsStatus    = document.getElementById('credentialsStatus');
const dashboardStatus      = document.getElementById('dashboardStatus');
const globalStatus         = document.getElementById('globalStatus');
const globalStatusText     = document.getElementById('globalStatusText');

// ─────────────────────────────────────────────
// Utility Helpers
// ─────────────────────────────────────────────

/**
 * Show a status message in a status div.
 * @param {HTMLElement} el       The status container element
 * @param {string}      message  Text to display
 * @param {'success'|'error'|'info'} type
 * @param {number}      [autoClear=0]  ms after which to clear. 0 = never
 */
function showStatus(el, message, type = 'info', autoClear = 0) {
  el.textContent  = message;
  el.className    = `status-message ${type}`;

  if (autoClear > 0) {
    setTimeout(() => {
      el.textContent = '';
      el.className   = 'status-message hidden';
    }, autoClear);
  }
}

/** Hide a status element */
function hideStatus(el) {
  el.textContent = '';
  el.className   = 'status-message hidden';
}

/** Set a button to a loading state and return a reset function */
function setButtonLoading(btn, loadingText) {
  const originalText = btn.querySelector('span') ? btn.querySelector('span').textContent : btn.textContent;
  btn.disabled = true;
  if (btn.querySelector('span')) {
    btn.querySelector('span').textContent = loadingText;
  } else {
    btn.textContent = loadingText;
  }
  return function reset(newText) {
    btn.disabled = false;
    const span = btn.querySelector('span');
    if (span) span.textContent = newText || originalText;
    else btn.textContent = newText || originalText;
  };
}

/**
 * Send a message to the background service worker.
 * @param {string} type
 * @param {Object} [payload]
 * @returns {Promise<any>}
 */
function sendBgMessage(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[LC Sync Options] Runtime error:', chrome.runtime.lastError.message);
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

// ─────────────────────────────────────────────
// Global Connection Status (sidebar)
// ─────────────────────────────────────────────

function updateGlobalStatus(connected, text) {
  globalStatus.className = `sidebar-status ${connected ? 'status-connected' : 'status-error'}`;
  globalStatusText.textContent = connected ? (text || 'Connected') : (text || 'Not connected');
}

async function checkAndRefreshGlobalStatus() {
  const { supabaseUrl, supabaseKey } = await getStoredCredentials();

  if (!supabaseUrl || !supabaseKey) {
    globalStatus.className   = 'sidebar-status status-unknown';
    globalStatusText.textContent = 'Not configured';
    return;
  }

  // Quick ping via background
  const result = await sendBgMessage('TEST_CONNECTION');
  if (result && result.success) {
    updateGlobalStatus(true, 'Connected');
  } else {
    updateGlobalStatus(false, 'Connection error');
  }
}

// ─────────────────────────────────────────────
// Storage Helpers
// ─────────────────────────────────────────────

function getStoredCredentials() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ['supabaseUrl', 'supabaseKey', 'dashboardUrl'],
      (result) => resolve(result)
    );
  });
}

function saveToStorage(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// ─────────────────────────────────────────────
// Load Settings
// ─────────────────────────────────────────────

async function loadSettings() {
  const stored = await getStoredCredentials();

  if (stored.supabaseUrl) supabaseUrlInput.value  = stored.supabaseUrl;
  if (stored.supabaseKey) supabaseKeyInput.value  = stored.supabaseKey;
  if (stored.dashboardUrl) dashboardUrlInput.value = stored.dashboardUrl;

  // Refresh sidebar status quietly
  await checkAndRefreshGlobalStatus();
}

// ─────────────────────────────────────────────
// Event: Save Supabase Credentials
// ─────────────────────────────────────────────

saveCredentialsBtn.addEventListener('click', async () => {
  hideStatus(credentialsStatus);

  const url = supabaseUrlInput.value.trim();
  const key = supabaseKeyInput.value.trim();

  if (!url || !key) {
    showStatus(credentialsStatus, '✗ Both Supabase URL and Anon Key are required.', 'error');
    return;
  }

  // Basic URL validation
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('supabase')) {
      showStatus(
        credentialsStatus,
        '⚠ URL does not look like a Supabase URL. Please double-check.',
        'error',
        5000
      );
    }
  } catch (_) {
    showStatus(credentialsStatus, '✗ The URL format is invalid.', 'error');
    return;
  }

  const dashUrl = dashboardUrlInput ? dashboardUrlInput.value.trim() : '';

  const resetBtn = setButtonLoading(saveCredentialsBtn, 'Saving…');

  try {
    await saveToStorage({ supabaseUrl: url, supabaseKey: key, dashboardUrl: dashUrl });
    showStatus(credentialsStatus, '✓ Settings saved successfully!', 'success', 4000);
    await checkAndRefreshGlobalStatus();
  } catch (err) {
    showStatus(credentialsStatus, `✗ Failed to save: ${err.message}`, 'error');
  } finally {
    resetBtn('Save Settings');
  }
});

// ─────────────────────────────────────────────
// Event: Test Connection
// ─────────────────────────────────────────────

testConnectionBtn.addEventListener('click', async () => {
  hideStatus(credentialsStatus);

  const url = supabaseUrlInput.value.trim();
  const key = supabaseKeyInput.value.trim();

  if (!url || !key) {
    showStatus(credentialsStatus, '✗ Enter your Supabase URL and key first.', 'error');
    return;
  }

  // Temporarily save to storage so background.js can use them
  await saveToStorage({ supabaseUrl: url, supabaseKey: key });

  const resetBtn = setButtonLoading(testConnectionBtn, 'Testing…');
  showStatus(credentialsStatus, '⏳ Connecting to Supabase…', 'info');

  try {
    const result = await sendBgMessage('TEST_CONNECTION');

    if (result && result.success) {
      showStatus(
        credentialsStatus,
        '✓ Connection successful! Your Supabase project is reachable and the submissions table exists.',
        'success',
        6000
      );
      updateGlobalStatus(true, 'Connected');
    } else {
      const errMsg = result?.error || 'Unknown error';
      showStatus(
        credentialsStatus,
        `✗ Connection failed: ${errMsg}.\n\nCheck that:\n• The URL and key are correct\n• The "submissions" table exists (see Setup Guide)\n• Row Level Security policies are set up`,
        'error'
      );
      updateGlobalStatus(false, 'Connection failed');
    }
  } catch (err) {
    showStatus(credentialsStatus, `✗ Error: ${err.message}`, 'error');
  } finally {
    resetBtn('Test Connection');
  }
});

// ─────────────────────────────────────────────
// Event: Save Dashboard URL (legacy fallback if element exists)
// ─────────────────────────────────────────────

if (saveDashboardBtn) {
  saveDashboardBtn.addEventListener('click', async () => {
    if (dashboardStatus) hideStatus(dashboardStatus);

    const url = dashboardUrlInput ? dashboardUrlInput.value.trim() : '';

    if (url) {
      try {
        new URL(url);
      } catch (_) {
        if (dashboardStatus) showStatus(dashboardStatus, '✗ That does not look like a valid URL.', 'error');
        return;
      }
    }

    const resetBtn = setButtonLoading(saveDashboardBtn, 'Saving…');

    try {
      await saveToStorage({ dashboardUrl: url || null });
      if (dashboardStatus) {
        showStatus(
          dashboardStatus,
          url ? '✓ Dashboard URL saved!' : '✓ Dashboard URL cleared.',
          'success',
          3000
        );
      }
    } catch (err) {
      if (dashboardStatus) showStatus(dashboardStatus, `✗ Error: ${err.message}`, 'error');
    } finally {
      resetBtn('Save Dashboard URL');
    }
  });
}

// ─────────────────────────────────────────────
// Event: Toggle API Key Visibility
// ─────────────────────────────────────────────

toggleKeyBtn.addEventListener('click', () => {
  const isPassword = supabaseKeyInput.type === 'password';
  supabaseKeyInput.type = isPassword ? 'text' : 'password';
  const eyeIcon = document.getElementById('eyeIcon');
  if (eyeIcon) {
    eyeIcon.innerHTML = isPassword
      ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
});

// ─────────────────────────────────────────────
// Event: Copy SQL Button
// ─────────────────────────────────────────────

if (copySqlBtn) {
  copySqlBtn.addEventListener('click', async () => {
    const sqlEl = document.getElementById('sqlCode') || document.querySelector('.code-block code');
    if (!sqlEl) return;

    try {
      await navigator.clipboard.writeText(sqlEl.textContent.trim());
      copySqlBtn.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied!`;
      copySqlBtn.style.color = '#22c55e';
      copySqlBtn.style.borderColor = 'rgba(34,197,94,0.3)';
      setTimeout(() => {
        copySqlBtn.innerHTML = `
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copy SQL`;
        copySqlBtn.style.color = '';
        copySqlBtn.style.borderColor = '';
      }, 2000);
    } catch (_) {
      const range = document.createRange();
      range.selectNode(sqlEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand('copy');
      window.getSelection().removeAllRanges();
      copySqlBtn.textContent = 'Copied!';
      setTimeout(() => { copySqlBtn.textContent = 'Copy SQL'; }, 2000);
    }
  });
}

// ─────────────────────────────────────────────
// Sidebar Navigation
// ─────────────────────────────────────────────

const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.content-section');

navItems.forEach((item) => {
  item.addEventListener('click', (e) => {
    const target = item.dataset.section;
    if (!target) return; // Allow normal link navigation for external links like guide.html

    e.preventDefault();

    // Update nav active state
    navItems.forEach((n) => n.classList.remove('active'));
    item.classList.add('active');

    // Show the target section
    sections.forEach((s) => s.classList.remove('active'));
    const targetSection = document.getElementById(`section-${target}`);
    if (targetSection) targetSection.classList.add('active');

    if (target === 'topics') {
      loadTopicsManager();
    }
  });
});

// ─────────────────────────────────────────────
// Topics & Subtopics Manager
// ─────────────────────────────────────────────

const newTopicNameInput    = document.getElementById('newTopicName');
const addTopicBtn          = document.getElementById('addTopicBtn');
const addTopicStatus       = document.getElementById('addTopicStatus');

const parentTopicSelect    = document.getElementById('parentTopicSelect');
const newSubtopicNameInput = document.getElementById('newSubtopicName');
const addSubtopicBtn       = document.getElementById('addSubtopicBtn');
const addSubtopicStatus    = document.getElementById('addSubtopicStatus');

const refreshTopicsBtn     = document.getElementById('refreshTopicsBtn');
const topicsContainer      = document.getElementById('topicsContainer');

async function loadTopicsManager() {
  if (!topicsContainer) return;
  topicsContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px;">Loading topics from database...</div>`;

  const res = await sendBgMessage('FETCH_TOPICS');

  if (!res || !res.success) {
    topicsContainer.innerHTML = `<div style="color: var(--red); font-size: 13px; text-align: center; padding: 15px;">Failed to load topics: ${res?.error || 'Database connection error. Ensure Supabase credentials are configured.'}</div>`;
    return;
  }

  const topics = res.topics || [];
  const subtopics = res.subtopics || [];

  // Update parent topic dropdown
  if (parentTopicSelect) {
    parentTopicSelect.innerHTML = '<option value="">Select parent topic...</option>';
    topics.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.name;
      opt.textContent = t.name;
      parentTopicSelect.appendChild(opt);
    });
  }

  if (topics.length === 0) {
    topicsContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px;">No topics found in database. Add one above!</div>`;
    return;
  }

  topicsContainer.innerHTML = '';

  topics.forEach((topic) => {
    const topicSubtopics = subtopics.filter((s) => s.topic_name === topic.name);

    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--bg-card2);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 14px 16px;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: ${topicSubtopics.length > 0 ? '10px' : '0'};
    `;

    const titleGroup = document.createElement('div');
    titleGroup.style.cssText = `display: flex; align-items: center; gap: 8px;`;

    const title = document.createElement('span');
    title.style.cssText = `font-weight: 700; font-size: 14px; color: var(--text-primary);`;
    title.textContent = topic.name;

    const countBadge = document.createElement('span');
    countBadge.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      background: rgba(255,255,255,0.06);
      padding: 2px 7px;
      border-radius: 12px;
    `;
    countBadge.textContent = `${topicSubtopics.length} subtopics`;

    titleGroup.appendChild(title);
    titleGroup.appendChild(countBadge);

    const delTopicBtn = document.createElement('button');
    delTopicBtn.className = 'copy-btn';
    delTopicBtn.style.cssText = `color: var(--red); border-color: rgba(239,68,68,0.3); padding: 3px 8px; font-size: 11px;`;
    delTopicBtn.innerHTML = `✕ Delete Topic`;
    delTopicBtn.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete topic "${topic.name}"? This will also delete all its subtopics.`)) {
        const delRes = await sendBgMessage('DELETE_TOPIC', { name: topic.name });
        if (delRes && delRes.success) {
          loadTopicsManager();
        } else {
          alert(`Failed to delete topic: ${delRes?.error || 'Unknown error'}`);
        }
      }
    });

    header.appendChild(titleGroup);
    header.appendChild(delTopicBtn);
    card.appendChild(header);

    if (topicSubtopics.length > 0) {
      const subList = document.createElement('div');
      subList.style.cssText = `display: flex; flex-wrap: wrap; gap: 6px;`;

      topicSubtopics.forEach((sub) => {
        const tag = document.createElement('div');
        tag.style.cssText = `
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12px;
          color: var(--text-secondary);
        `;

        const subName = document.createElement('span');
        subName.textContent = sub.name;

        const delSubBtn = document.createElement('button');
        delSubBtn.style.cssText = `
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 12px;
          line-height: 1;
          padding: 0 2px;
        `;
        delSubBtn.textContent = '✕';
        delSubBtn.title = `Delete subtopic "${sub.name}"`;
        delSubBtn.addEventListener('mouseover', () => { delSubBtn.style.color = 'var(--red)'; });
        delSubBtn.addEventListener('mouseout', () => { delSubBtn.style.color = 'var(--text-muted)'; });
        delSubBtn.addEventListener('click', async () => {
          const delRes = await sendBgMessage('DELETE_SUBTOPIC', { topicName: topic.name, name: sub.name });
          if (delRes && delRes.success) {
            loadTopicsManager();
          } else {
            alert(`Failed to delete subtopic: ${delRes?.error || 'Unknown error'}`);
          }
        });

        tag.appendChild(subName);
        tag.appendChild(delSubBtn);
        subList.appendChild(tag);
      });

      card.appendChild(subList);
    }

    topicsContainer.appendChild(card);
  });
}

if (addTopicBtn) {
  addTopicBtn.addEventListener('click', async () => {
    const name = newTopicNameInput.value.trim();
    if (!name) {
      showStatus(addTopicStatus, 'Please enter a topic name.', 'error', 3000);
      return;
    }
    const reset = setButtonLoading(addTopicBtn, 'Adding...');
    const res = await sendBgMessage('CREATE_TOPIC', { name });
    reset();

    if (res && res.success) {
      newTopicNameInput.value = '';
      showStatus(addTopicStatus, `Topic "${name}" added successfully!`, 'success', 3000);
      loadTopicsManager();
    } else {
      showStatus(addTopicStatus, `Failed to add topic: ${res?.error || 'Unknown error'}`, 'error');
    }
  });
}

if (addSubtopicBtn) {
  addSubtopicBtn.addEventListener('click', async () => {
    const topicName = parentTopicSelect.value;
    const name = newSubtopicNameInput.value.trim();

    if (!topicName) {
      showStatus(addSubtopicStatus, 'Please select a parent topic.', 'error', 3000);
      return;
    }
    if (!name) {
      showStatus(addSubtopicStatus, 'Please enter a subtopic name.', 'error', 3000);
      return;
    }

    const reset = setButtonLoading(addSubtopicBtn, 'Adding...');
    const res = await sendBgMessage('CREATE_SUBTOPIC', { topicName, name });
    reset();

    if (res && res.success) {
      newSubtopicNameInput.value = '';
      showStatus(addSubtopicStatus, `Subtopic "${name}" added under "${topicName}"!`, 'success', 3000);
      loadTopicsManager();
    } else {
      showStatus(addSubtopicStatus, `Failed to add subtopic: ${res?.error || 'Unknown error'}`, 'error');
    }
  });
}

if (refreshTopicsBtn) {
  refreshTopicsBtn.addEventListener('click', loadTopicsManager);
}

// ─────────────────────────────────────────────
// Keyboard shortcut: Ctrl/Cmd+S to save
// ─────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    // Save whichever section is active
    const activeSection = document.querySelector('.content-section.active');
    if (activeSection?.id === 'section-supabase') {
      saveCredentialsBtn.click();
    } else if (activeSection?.id === 'section-dashboard') {
      saveDashboardBtn.click();
    }
  }
});

// ─────────────────────────────────────────────
// Initialise
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', loadSettings);
