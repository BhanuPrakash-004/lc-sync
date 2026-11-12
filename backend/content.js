/**
 * content.js — LC Sync Content Script
 *
 * Injected into LeetCode problem pages (https://leetcode.com/problems/*).
 *
 * Responsibilities:
 *  1. Receives submission events intercepted by inject.js (Main World)
 *  2. Scrapes problem metadata from DOM (title, number, difficulty, tags, statement)
 *  3. Extracts submitted code solution and language from editor models
 *  4. Displays an in-page modal for tagging topic/subtopic, adding notes and URLs
 *  5. Forwards structured payload to background.js service worker for persistence
 */

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────
  let lastSubmissionData = null; // Most recent successful submission payload
  let modalOpen = false;
  const handledSubmissionIds = new Set();

  function tracePopup(step, event, details = {}) {
    console.log(`[LC Sync][STEP ${step}] ${event} ${JSON.stringify(details)}`);
  }

  // ─────────────────────────────────────────────
  // Utility helpers
  // ─────────────────────────────────────────────

  /** Convert a File/Blob to a base64 data-URL string */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** Safely get text content of a DOM element matched by selector */
  function getText(selector, root = document) {
    const el = root.querySelector(selector);
    return el ? el.textContent.trim() : null;
  }

  /** Debounce a function */
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ─────────────────────────────────────────────
  // Problem Metadata Extraction
  // ─────────────────────────────────────────────

  /** Extract the problem number from the URL, document title, or DOM */
  function extractProblemNumber() {
    // 1. Try document.title — e.g. "1. Two Sum - LeetCode" or "#1. Two Sum"
    const docMatch = document.title.match(/^#?(\d+)\.\s+/);
    if (docMatch) return docMatch[1];

    // 2. URL pattern: /problems/two-sum/  or  /problems/1-two-sum/
    const match = window.location.pathname.match(/\/problems\/(?:(\d+)-)?([^/]+)/);
    if (match && match[1]) return match[1];

    // 3. DOM selectors — modern & legacy LeetCode selectors
    const selectors = [
      '[data-cy="question-title"]',
      '.mr-2.text-label-1',
      'h4[class*="title"]',
      'div[class*="title"]',
      'a[class*="title"]',
      '.text-title-large',
      '[class*="text-title"]',
      'div[data-heading-select]',
      'a[href^="/problems/"]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const numMatch = el.textContent.trim().match(/^#?(\d+)\.\s+/);
        if (numMatch) return numMatch[1];
      }
    }

    // 4. Scan headings/links as last resort
    const elements = document.querySelectorAll('h1, h2, h3, h4, a[href^="/problems/"], div[class*="title"]');
    for (const el of elements) {
      const numMatch = el.textContent.trim().match(/^#?(\d+)\.\s+/);
      if (numMatch) return numMatch[1];
    }

    return null;
  }

  /** Extract the problem title */
  function extractProblemTitle() {
    // Various selectors LeetCode has used over time
    const selectors = [
      '[data-cy="question-title"]',
      'div[class*="title__"] a',
      '.mr-2.text-label-1',
      'title', // page title as fallback
    ];

    for (const sel of selectors) {
      const text = getText(sel);
      if (text) {
        // Strip trailing " - LeetCode" from <title>
        return text.replace(/\s*-\s*LeetCode$/, '').replace(/^\d+\.\s*/, '').trim();
      }
    }

    // Try extracting from document.title
    const titleText = document.title.replace(/\s*-\s*LeetCode$/, '').replace(/^\d+\.\s*/, '').trim();
    return titleText || 'Unknown Problem';
  }

  /** Extract difficulty label */
  function extractDifficulty() {
    const selectors = [
      '[diff]',
      '.text-difficulty-easy',
      '.text-difficulty-medium',
      '.text-difficulty-hard',
      '[class*="difficulty"]',
      'div[class*="Difficulty"]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent.trim();
        if (['Easy', 'Medium', 'Hard'].includes(text)) return text;
      }
    }

    // Fallback: look for coloured spans
    const spans = document.querySelectorAll('span, div');
    for (const span of spans) {
      const t = span.textContent.trim();
      if (t === 'Easy' || t === 'Medium' || t === 'Hard') return t;
    }

    return null;
  }

  /** Extract topic tags */
  function extractTags() {
    const tagSelectors = [
      'a[class*="topic-tag"]',
      '[data-cy="question-tags"] a',
      'div[class*="tag-"] span',
      '.topic-tag',
    ];

    for (const sel of tagSelectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        return Array.from(els)
          .map((el) => el.textContent.trim())
          .filter(Boolean);
      }
    }

    return [];
  }

  /**
   * Keep the problem statement markup so examples, lists, and images survive
   * the trip to Supabase. LeetCode commonly uses relative or lazy-loaded image
   * URLs; make them absolute because the saved description is rendered on a
   * different origin (the LC Sync web app).
   */
  function serializeDescription(element) {
    const clone = element.cloneNode(true);
    const toAbsoluteUrl = (value) => {
      if (!value || value.startsWith('data:')) return value;
      try { return new URL(value, window.location.origin).href; }
      catch { return value; }
    };

    clone.querySelectorAll('img').forEach((image) => {
      let rawSrc = image.getAttribute('src');
      let dataSrc = image.getAttribute('data-src') || image.getAttribute('data-original') || image.getAttribute('data-lazy-src');
      
      // If src is a data URI placeholder, prefer the real data-src/data-original if present
      let source = (rawSrc && !rawSrc.startsWith('data:')) ? rawSrc : (dataSrc || rawSrc);

      if (source) image.setAttribute('src', toAbsoluteUrl(source));

      const sourceSet = image.getAttribute('srcset') || image.getAttribute('data-srcset');
      if (sourceSet) {
        image.setAttribute('srcset', sourceSet.split(',').map((entry) => {
          const [url, descriptor] = entry.trim().split(/\s+/, 2);
          return [toAbsoluteUrl(url), descriptor].filter(Boolean).join(' ');
        }).join(', '));
      }
      image.removeAttribute('data-src');
      image.removeAttribute('data-original');
      image.removeAttribute('data-lazy-src');
      image.removeAttribute('data-srcset');
      image.setAttribute('referrerpolicy', 'no-referrer');
      image.loading = 'lazy';
    });

    return clone.innerHTML.trim();
  }

  /** Extract problem description — robust against LeetCode DOM changes */
  function extractDescription() {
    // ── Tier 1: stable data-attribute selectors (LeetCode 2024-2025) ──
    const stableSelectors = [
      '[data-track-load="description_content"]',
      '[data-cy="question-content"]',
      '[data-cy="question-detail-main-tabs"] [class*="content"]',
    ];
    for (const sel of stableSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText.trim();
        if (text.length > 40) return serializeDescription(el);
      }
    }

    // ── Tier 2: legacy class-based selectors ──
    const legacySelectors = [
      '[data-cy="question-detail-main-tabs"] .content__QFAE',
      'div[class*="content__"]',
      '.question-content',
      'div[class*="description__"]',
      'div[class*="Description"]',
      '.xFUwe',   // observed class name 2024
      '.elfjS',   // observed class name 2024-2025
    ];
    for (const sel of legacySelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText.trim();
        if (text.length > 40) return serializeDescription(el);
      }
    }

    // ── Tier 3: heuristic — find the div that contains problem statement ──
    // LeetCode problem descriptions always have "Example" + "Input" + "Output".
    // Walk divs from smallest to largest to find the tightest matching container.
    const candidates = [];
    document.querySelectorAll('div').forEach((div) => {
      // Skip script/style containers and huge layout wrappers
      if (div.children.length < 2 || div.children.length > 80) return;
      const text = (div.innerText || '').trim();
      if (
        text.length > 80 &&
        text.length < 15000 &&
        /example/i.test(text) &&
        /input/i.test(text) &&
        /output/i.test(text)
      ) {
        candidates.push({ el: div, len: text.length, text });
      }
    });
    if (candidates.length > 0) {
      // Pick the smallest container that still has enough content
      candidates.sort((a, b) => a.len - b.len);
      return serializeDescription(candidates[0].el);
    }

    return null;
  }

  /** Extract the code from the editor (Monaco or CodeMirror) */
  function extractCode() {
    // Monaco editor (most common on LeetCode)
    if (window.monaco) {
      const models = window.monaco.editor.getModels();
      if (models.length > 0) {
        return models[0].getValue();
      }
    }

    // Try the Monaco editor API through the DOM
    const monacoInstances = document.querySelectorAll('.monaco-editor');
    for (const el of monacoInstances) {
      if (el._monacoEditor || el.__zone_symbol__addEventListeners) {
        try {
          // Attempt to get value from the editor instance attached to the DOM
          const editorInstance =
            el._monacoEditor ||
            (window.monaco && window.monaco.editor.getEditors && window.monaco.editor.getEditors()[0]);
          if (editorInstance) return editorInstance.getValue();
        } catch (_) {}
      }
    }

    // CodeMirror fallback
    const cmEl = document.querySelector('.CodeMirror');
    if (cmEl && cmEl.CodeMirror) {
      return cmEl.CodeMirror.getValue();
    }

    // Last resort: grab visible text from editor lines
    const lines = document.querySelectorAll(
      '.view-lines .view-line, .CodeMirror-line'
    );
    if (lines.length > 0) {
      return Array.from(lines)
        .map((l) => l.textContent)
        .join('\n');
    }

    return null;
  }

  /** Extract the selected programming language — robust against LeetCode DOM changes */
  function extractLanguage() {
    // ── Tier 1: stable data attributes ──
    const editorEl = document.querySelector('[data-lang]');
    if (editorEl && editorEl.dataset.lang) return editorEl.dataset.lang;

    // ── Tier 2: explicit selector list (LeetCode 2024-2025) ──
    const selectorList = [
      // Modern headless-UI language button (shown in the editor toolbar)
      'button[id^="headlessui-listbox-button"]',
      // Older antd selector
      '.ant-select-selection-item',
      '[class*="lang-select"] .ant-select-selection-item',
      // Generic select-like containers
      'div[class*="Select"] span',
      'button[id*="lang"]',
    ];
    for (const sel of selectorList) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent.trim();
        if (text.length > 0 && text.length < 30) return text;
      }
    }

    // ── Tier 3: scan for known language names in the editor toolbar region ──
    // This is the most reliable fallback — LeetCode always shows the current
    // language as visible text somewhere near the code editor.
    const KNOWN_LANGS = [
      'Python3','Python','Java','C++','C','C#','JavaScript','TypeScript',
      'Go','Golang','Rust','Ruby','Swift','Kotlin','Scala','Dart','PHP',
      'Racket','Erlang','Elixir','MySQL','MS SQL Server','Oracle',
    ];

    // Search within the editor toolbar first (better precision)
    const toolbarCandidates = document.querySelectorAll(
      '[class*="toolbar"], [class*="editor"] button, [class*="language"], [class*="lang"]'
    );
    for (const el of toolbarCandidates) {
      const text = el.textContent.trim();
      if (KNOWN_LANGS.includes(text)) return text;
    }

    // Broader search — any visible element whose full text is exactly a known language
    const allInteractive = document.querySelectorAll('button, span, div[role="option"], div[role="button"]');
    for (const el of allInteractive) {
      if (!el.offsetParent) continue; // skip hidden elements
      const text = el.textContent.trim();
      if (KNOWN_LANGS.includes(text)) return text;
    }

    return 'Unknown';
  }

  /** Build the full submission payload from the current page state */
  function buildSubmissionPayload(overrides = {}) {
    const slugMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
    const problemSlug = slugMatch ? slugMatch[1] : null;

    return {
      problemNumber: extractProblemNumber(),
      problemTitle:  extractProblemTitle(),
      problemSlug:   problemSlug,
      difficulty:    extractDifficulty(),
      tags:          extractTags(),
      description:   extractDescription(),
      code:          overrides.code || extractCode(),
      language:      overrides.language || extractLanguage(),
      leetcodeUrl:   window.location.href,
      submittedAt:   new Date().toISOString(),
      runtime:       overrides.runtime || null,
      memory:        overrides.memory  || null,
      notes:         null,
      images:        [],
      chatgptUrl:    null,  // filled by user in the save modal
    };
  }

  // ─────────────────────────────────────────────
  // Main World Script Injection & Message Routing
  // ─────────────────────────────────────────────

  // Listen for messages posted by our main-world inject.js script
  window.addEventListener('message', (event) => {
    // Only accept messages from the same page window
    if (event.source !== window) return;
    
    if (event.data && event.data.type === 'LC_SYNC_SUBMISSION_DETECTED') {
      tracePopup(8, 'Content script received acceptance message', { id: event.data.data?._verified_submission_id ?? null });
      handleSubmissionResponse(event.data.data);
    }
  });

  // inject.js is loaded directly into the Main World via manifest.json
  // (content_scripts → world: "MAIN", run_at: "document_start").
  // This guarantees window.fetch is intercepted before any page code runs.
  // No dynamic <script> injection needed here.

  function checkDuplicateBeforePopup(payload) {
    return new Promise((resolve) => {
      // A slow or unavailable database must not permanently hide the save UI.
      const timeout = setTimeout(() => resolve({ success: false, duplicate: false }), 5000);
      try {
        chrome.runtime.sendMessage({
          type: 'CHECK_SUBMISSION_DUPLICATE',
          payload: {
            problemNumber: payload.problemNumber, problemSlug: payload.problemSlug,
            problemTitle: payload.problemTitle, language: payload.language, code: payload.code,
          },
        }, (result) => {
          clearTimeout(timeout);
          resolve(chrome.runtime.lastError ? { success: false, duplicate: false } : (result || { success: false, duplicate: false }));
        });
      } catch (_) {
        clearTimeout(timeout);
        resolve({ success: false, duplicate: false });
      }
    });
  }

  /**
   * Parse a submission response object from LeetCode's API and decide
   * whether it represents an "Accepted" result.
   */
  function handleSubmissionResponse(data) {
    // Only inject.js can correlate a final check with a fresh Submit request.
    const submissionId = data?._verified_submission_id;
    const stop = (reason) => tracePopup(9, 'STOP: ' + reason, { id: submissionId ?? null });
    if (!submissionId || data.state !== 'SUCCESS') return stop('missing verified ID or completed state');
    if (data.status_msg !== 'Accepted' && String(data.status_code) !== '10') return stop('verdict not Accepted');
    if (data.status_msg != null && data.status_msg !== 'Accepted') return stop('status text conflicts');
    if (data.status_code != null && String(data.status_code) !== '10') return stop('status code conflicts');
    if (data.total_correct != null || data.total_testcases != null) {
      const total = Number(data.total_testcases);
      if (!Number.isInteger(total) || total <= 0 || Number(data.total_correct) !== total) return stop('test-count checks failed');
    }
    const isCurrentProblem = () =>
      window.location.pathname.match(/^\/problems\/([^/]+)/)?.[1] === data._submitted_problem_slug;
    if (!isCurrentProblem()) return stop('current problem changed');
    if (handledSubmissionIds.has(submissionId)) return stop('duplicate submission message');
    if (modalOpen) return stop('another popup is already open');
    handledSubmissionIds.add(submissionId);

    tracePopup(9, 'PASS: popup scheduled', { id: submissionId, delayMs: 800 });

    // Give the DOM a moment to update after acceptance.
    // Prefer values extracted directly from the API response by inject.js
    // (lang, code, runtime, memory) — they are more reliable than DOM scraping.
    setTimeout(async () => {
      if (!isCurrentProblem() || modalOpen) return stop('problem changed or another popup opened during delay');
      try {
        tracePopup(10, 'Reading problem metadata', { id: submissionId });
        const payload = buildSubmissionPayload({
          code:     data?._extracted_code    || null,
          language: data?._extracted_lang    || null,
          runtime:  data?._extracted_runtime || data?.status_runtime || data?.submissionDetails?.runtimeDisplay || null,
          memory:   data?._extracted_memory  || data?.status_memory  || data?.submissionDetails?.memoryDisplay  || null,
        });

        tracePopup(10, 'Checking saved primary and alternate solutions for identical code', { id: submissionId });
        const existing = await checkDuplicateBeforePopup(payload);
        if (!isCurrentProblem() || modalOpen) return stop('problem changed or another popup opened during duplicate check');
        if (existing.success && existing.duplicate) {
          tracePopup(10, 'SKIP: identical solution already saved; no popup', { id: submissionId, match: existing.match });
          return;
        }
        tracePopup(10, existing.success ? 'PASS: no identical saved solution' : 'Duplicate check unavailable; allowing save popup', { id: submissionId });
        lastSubmissionData = payload;
        tracePopup(10, 'PASS: metadata ready; constructing popup', {
          id: submissionId, slug: payload.problemSlug, hasCode: Boolean(payload.code),
        });
        showSaveModal(payload);
      } catch (error) {
        modalOpen = false;
        handledSubmissionIds.delete(submissionId);
        tracePopup(10, 'ERROR: popup construction failed', { id: submissionId, error: error.message, stack: error.stack });
      }
    }, 800);
  }

  // ─────────────────────────────────────────────
  // In-Page Save Modal
  // ─────────────────────────────────────────────

  /** Create and display the floating save modal */
  function showSaveModal(submissionPayload) {
    if (modalOpen) return;
    modalOpen = true;

    let selectedFiles = [];
    // Topics data loaded from DB; fallback to empty
    let dbTopics    = [];    // [{ name, description }]
    let dbSubtopics = [];    // [{ topic_name, name }]
    let categoryLookupSucceeded = false;

    // ── Inject styles once ──────────────────────
    if (!document.getElementById('lc-sync-styles')) {
      const style = document.createElement('style');
      style.id = 'lc-sync-styles';
      style.textContent = `
        @keyframes lcSyncFadeIn {
          from { opacity: 0; transform: translateY(-20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)     scale(1);    }
        }
        @keyframes lcSyncToastIn {
          from { opacity: 0; transform: translateX(120%); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes lcSyncToastOut {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(120%); }
        }
        @keyframes lcSyncSpin {
          to { transform: rotate(360deg); }
        }
        .lcsync-btn {
          padding: 9px 18px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: opacity 0.15s, transform 0.1s;
          font-family: inherit;
        }
        .lcsync-btn:hover  { opacity: 0.85; transform: translateY(-1px); }
        .lcsync-btn:active { transform: translateY(0); }
        .lcsync-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
        .lcsync-input {
          width: 100%;
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 8px;
          color: #fafafa;
          font-size: 12.5px;
          padding: 9px 12px;
          outline: none;
          box-sizing: border-box;
          font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .lcsync-input:focus {
          border-color: #FFA116;
          box-shadow: 0 0 0 3px rgba(255,161,22,0.10);
        }
        .lcsync-input::placeholder { color: #52525b; }
        .lcsync-select {
          width: 100%;
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 8px;
          color: #fafafa;
          font-size: 12.5px;
          padding: 9px 30px 9px 12px;
          outline: none;
          box-sizing: border-box;
          font-family: inherit;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%2352525b' d='M5 7L0.5 2.5h9z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .lcsync-select:focus { border-color: #FFA116; box-shadow: 0 0 0 3px rgba(255,161,22,0.10); }
        .lcsync-select:disabled { opacity: 0.4; cursor: not-allowed; }
        .lcsync-select option { background: #18181b; color: #fafafa; }
        .lcsync-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #a1a1aa;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .lcsync-field { margin-bottom: 14px; }
        .lcsync-field:last-child { margin-bottom: 0; }
        .lcsync-thumb-wrapper {
          position: relative;
          display: inline-block;
        }
        .lcsync-thumb-remove {
          position: absolute;
          top: -5px;
          right: -5px;
          width: 16px;
          height: 16px;
          background: #ef4444;
          border: none;
          border-radius: 50%;
          color: #fff;
          font-size: 10px;
          line-height: 16px;
          text-align: center;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }
        .lcsync-col-divider {
          width: 1px;
          background: #27272a;
          flex-shrink: 0;
        }
        .lcsync-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid #27272a;
          border-top-color: #FFA116;
          border-radius: 50%;
          animation: lcSyncSpin 0.7s linear infinite;
          display: inline-block;
          flex-shrink: 0;
        }
        .lcsync-create-row {
          display: flex;
          gap: 6px;
          margin-top: 7px;
        }
        .lcsync-create-btn {
          padding: 8px 12px;
          border: 1px solid #3f3f46;
          border-radius: 8px;
          background: #27272a;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          font-family: inherit;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .lcsync-create-btn:hover {
          background: rgba(255,161,22,0.10);
          color: #FFA116;
          border-color: rgba(255,161,22,0.3);
        }
        .lcsync-section-title {
          font-size: 10.5px;
          font-weight: 700;
          color: #52525b;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .lcsync-section-title::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #27272a;
        }
      `;
      document.head.appendChild(style);
    }

    // ── Backdrop ──────────────────────────────
    const backdrop = document.createElement('div');
    Object.assign(backdrop.style, {
      position:       'fixed',
      inset:          '0',
      background:     'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(6px)',
      zIndex:         '2147483646',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontFamily:     "'Inter', 'Segoe UI', system-ui, sans-serif",
      padding:        '16px',
    });

    // ── Modal card ───────────────────────────
    const modal = document.createElement('div');
    Object.assign(modal.style, {
      background:    '#18181b',
      border:        '1px solid #27272a',
      borderRadius:  '16px',
      width:         '840px',
      maxWidth:      'calc(100vw - 32px)',
      maxHeight:     'calc(100vh - 48px)',
      boxShadow:     '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,161,22,0.06)',
      color:         '#fafafa',
      position:      'relative',
      animation:     'lcSyncFadeIn 0.25s ease',
      display:       'flex',
      flexDirection: 'column',
      overflow:      'hidden',
    });

    // ── Modal Header ─────────────────────────
    const header = document.createElement('div');
    Object.assign(header.style, {
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '16px 20px 14px',
      borderBottom:   '1px solid #27272a',
      flexShrink:     '0',
      background:     'linear-gradient(135deg, #1c1c1f 0%, #18181b 100%)',
    });

    const headerLeft = document.createElement('div');
    headerLeft.style.display = 'flex';
    headerLeft.style.alignItems = 'center';
    headerLeft.style.gap = '10px';

    const badge = document.createElement('span');
    Object.assign(badge.style, {
      display:      'inline-flex',
      alignItems:   'center',
      gap:          '5px',
      background:   'rgba(34,197,94,0.12)',
      color:        '#22c55e',
      border:       '1px solid rgba(34,197,94,0.25)',
      borderRadius: '20px',
      padding:      '3px 9px',
      fontSize:     '11px',
      fontWeight:   '600',
    });
    badge.innerHTML = '<svg width="7" height="7" viewBox="0 0 8 8" fill="#22c55e"><circle cx="4" cy="4" r="4"/></svg> Accepted';

    const titleEl = document.createElement('h2');
    Object.assign(titleEl.style, {
      margin:        '0',
      fontSize:      '16px',
      fontWeight:    '800',
      color:         '#fafafa',
      letterSpacing: '-0.3px',
    });
    titleEl.textContent = 'Save to LC Sync';

    headerLeft.appendChild(badge);
    headerLeft.appendChild(titleEl);

    const headerRight = document.createElement('div');
    headerRight.style.display = 'flex';
    headerRight.style.alignItems = 'center';
    headerRight.style.gap = '10px';

    const difficultyColor = { Easy: '#22c55e', Medium: '#f59e0b', Hard: '#ef4444' }[submissionPayload.difficulty] || '#a1a1aa';
    const problemChip = document.createElement('div');
    Object.assign(problemChip.style, {
      background:   '#09090b',
      border:       '1px solid #27272a',
      borderRadius: '8px',
      padding:      '6px 10px',
      maxWidth:     '260px',
      overflow:     'hidden',
    });
    problemChip.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:#fafafa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${submissionPayload.problemNumber ? `#${submissionPayload.problemNumber} &middot; ` : ''}${submissionPayload.problemTitle}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px;margin-top:2px;">
        <span style="color:${difficultyColor};font-weight:600;">${submissionPayload.difficulty || 'Unknown'}</span>
        ${submissionPayload.language && submissionPayload.language !== 'Unknown' ? `<span style="color:#FFA116;">&#9000; ${submissionPayload.language}</span>` : ''}
        ${submissionPayload.runtime ? `<span style="color:#a78bfa;">&#9889; ${submissionPayload.runtime}</span>` : ''}
        ${submissionPayload.memory  ? `<span style="color:#60a5fa;">&#128230; ${submissionPayload.memory}</span>` : ''}
      </div>
    `;

    const closeBtn = document.createElement('button');
    Object.assign(closeBtn.style, {
      background:   'none',
      border:       '1px solid #27272a',
      color:        '#52525b',
      cursor:       'pointer',
      fontSize:     '18px',
      lineHeight:   '1',
      padding:      '4px 8px',
      borderRadius: '8px',
      transition:   'color 0.15s, border-color 0.15s',
    });
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Dismiss';
    closeBtn.addEventListener('mouseover', () => { closeBtn.style.color = '#fafafa'; closeBtn.style.borderColor = '#3f3f46'; });
    closeBtn.addEventListener('mouseout',  () => { closeBtn.style.color = '#52525b'; closeBtn.style.borderColor = '#27272a'; });
    closeBtn.addEventListener('click', () => closeModal(backdrop));

    headerRight.appendChild(problemChip);
    headerRight.appendChild(closeBtn);
    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // ── Body: Two columns ────────────────────
    const body = document.createElement('div');
    Object.assign(body.style, {
      display:  'flex',
      flex:     '1',
      overflow: 'hidden',
      minHeight:'0',
    });

    // LEFT COLUMN: Topics & categorization
    const leftCol = document.createElement('div');
    Object.assign(leftCol.style, {
      width:      '310px',
      flexShrink: '0',
      padding:    '18px 18px',
      overflowY:  'auto',
    });

    // RIGHT COLUMN: Notes, links, images
    const rightCol = document.createElement('div');
    Object.assign(rightCol.style, {
      flex:       '1',
      padding:    '18px 18px',
      overflowY:  'auto',
      background: '#1c1c1f',
      minWidth:   '0',
    });

    const divider = document.createElement('div');
    divider.className = 'lcsync-col-divider';

    // ─── LEFT COLUMN: Topics (DB-fetched) ────
    const topicsSectionTitle = document.createElement('div');
    topicsSectionTitle.className = 'lcsync-section-title';
    topicsSectionTitle.textContent = 'Categorize';

    const categoryHint = document.createElement('div');
    categoryHint.style.cssText = 'font-size:12px;color:#a1a1aa;margin-bottom:12px;';
    categoryHint.textContent = 'Loading saved categorization\u2026';

    // Topic field
    const topicField = document.createElement('div');
    topicField.className = 'lcsync-field';

    const topicLabel = document.createElement('label');
    topicLabel.className = 'lcsync-label';
    topicLabel.textContent = 'Main Topic';

    const topicRow = document.createElement('div');
    topicRow.style.cssText = 'display:flex;align-items:center;gap:6px;';

    const topicSelect = document.createElement('select');
    topicSelect.className = 'lcsync-select';
    topicSelect.style.flex = '1';
    topicSelect.innerHTML = '<option value="">Loading topics&#8230;</option>';
    topicSelect.disabled = true;

    const topicSpinner = document.createElement('span');
    topicSpinner.className = 'lcsync-spinner';

    topicRow.appendChild(topicSelect);
    topicRow.appendChild(topicSpinner);

    const newTopicRow = document.createElement('div');
    newTopicRow.className = 'lcsync-create-row';
    newTopicRow.style.display = 'none';

    const newTopicInput = document.createElement('input');
    newTopicInput.className = 'lcsync-input';
    newTopicInput.placeholder = 'New topic name\u2026';

    const newTopicBtn = document.createElement('button');
    newTopicBtn.className = 'lcsync-create-btn';
    newTopicBtn.textContent = '+ Add';

    newTopicRow.appendChild(newTopicInput);
    newTopicRow.appendChild(newTopicBtn);

    topicField.appendChild(topicLabel);
    topicField.appendChild(topicRow);
    topicField.appendChild(newTopicRow);

    // Subtopic field
    const subtopicField = document.createElement('div');
    subtopicField.className = 'lcsync-field';

    const subtopicLabel = document.createElement('label');
    subtopicLabel.className = 'lcsync-label';
    subtopicLabel.textContent = 'Subtopic / Pattern';

    const subtopicSelect = document.createElement('select');
    subtopicSelect.className = 'lcsync-select';
    subtopicSelect.innerHTML = '<option value="">Select topic first\u2026</option>';
    subtopicSelect.disabled = true;

    const newSubtopicRow = document.createElement('div');
    newSubtopicRow.className = 'lcsync-create-row';
    newSubtopicRow.style.display = 'none';

    const newSubtopicInput = document.createElement('input');
    newSubtopicInput.className = 'lcsync-input';
    newSubtopicInput.placeholder = 'New subtopic name\u2026';

    const newSubtopicBtn = document.createElement('button');
    newSubtopicBtn.className = 'lcsync-create-btn';
    newSubtopicBtn.textContent = '+ Add';

    newSubtopicRow.appendChild(newSubtopicInput);
    newSubtopicRow.appendChild(newSubtopicBtn);

    subtopicField.appendChild(subtopicLabel);
    subtopicField.appendChild(subtopicSelect);
    subtopicField.appendChild(newSubtopicRow);

    // Populate helpers
    function populateTopics(topics, subtopics) {
      dbTopics    = topics    || [];
      dbSubtopics = subtopics || [];
      topicSpinner.style.display = 'none';
      topicSelect.innerHTML = '<option value="">Select main topic\u2026</option>';
      dbTopics.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name; opt.textContent = t.name;
        topicSelect.appendChild(opt);
      });
      const createOpt = document.createElement('option');
      createOpt.value = '__create__'; createOpt.textContent = '+ Create new topic\u2026';
      topicSelect.appendChild(createOpt);
      topicSelect.disabled = false;
    }

    function populateSubtopics(topicName) {
      subtopicSelect.innerHTML = '';
      const filtered = dbSubtopics.filter(s => s.topic_name === topicName);
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = filtered.length > 0 ? 'Select subtopic\u2026' : 'No subtopics yet';
      subtopicSelect.appendChild(placeholder);
      filtered.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name; opt.textContent = s.name;
        subtopicSelect.appendChild(opt);
      });
      const createOpt = document.createElement('option');
      createOpt.value = '__create__'; createOpt.textContent = '+ Create new subtopic\u2026';
      subtopicSelect.appendChild(createOpt);
      subtopicSelect.disabled = false;
    }

    topicSelect.addEventListener('change', () => {
      const val = topicSelect.value;
      newSubtopicInput.value = '';
      if (val === '__create__') {
        newTopicRow.style.display = 'flex';
        newTopicInput.focus();
        topicSelect.value = '';
        subtopicSelect.innerHTML = '<option value="">Select topic first\u2026</option>';
        subtopicSelect.disabled = true;
        newSubtopicRow.style.display = 'none';
      } else {
        newTopicRow.style.display = 'none';
        if (val) {
          populateSubtopics(val);
          newSubtopicRow.style.display = 'flex';
        } else {
          subtopicSelect.innerHTML = '<option value="">Select topic first\u2026</option>';
          subtopicSelect.disabled = true;
          newSubtopicRow.style.display = 'none';
        }
      }
    });

    subtopicSelect.addEventListener('change', () => {
      if (subtopicSelect.value === '__create__') {
        newSubtopicRow.style.display = 'flex';
        newSubtopicInput.focus();
        subtopicSelect.value = '';
      } else {
        // hide the create row if they select a real subtopic
        if (subtopicSelect.value) newSubtopicRow.style.display = 'none';
      }
    });

    newTopicInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); newTopicBtn.click(); }
    });

    newTopicBtn.addEventListener('click', async () => {
      const name = newTopicInput.value.trim();
      if (!name) return;
      newTopicBtn.textContent = '\u2026'; newTopicBtn.disabled = true;
      const result = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'CREATE_TOPIC', payload: { name } }, resolve);
      });
      if (result && result.success) {
        dbTopics.push({ name, description: '', sort_order: 999 });
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        topicSelect.insertBefore(opt, topicSelect.lastElementChild);
        topicSelect.value = name;
        newTopicRow.style.display = 'none';
        newTopicInput.value = '';
        populateSubtopics(name);
        newSubtopicRow.style.display = 'flex';
      } else {
        newTopicInput.style.borderColor = '#ef4444';
        setTimeout(() => { newTopicInput.style.borderColor = ''; }, 2000);
      }
      newTopicBtn.textContent = '+ Add'; newTopicBtn.disabled = false;
    });

    newSubtopicInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); newSubtopicBtn.click(); }
    });

    newSubtopicBtn.addEventListener('click', async () => {
      const topicName = topicSelect.value || newTopicInput.value.trim();
      const name = newSubtopicInput.value.trim();
      if (!name || !topicName || topicName === '__create__') return;
      newSubtopicBtn.textContent = '\u2026'; newSubtopicBtn.disabled = true;
      const result = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'CREATE_SUBTOPIC', payload: { topicName, name } }, resolve);
      });
      if (result && result.success) {
        dbSubtopics.push({ topic_name: topicName, name, description: '', sort_order: 999 });
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        subtopicSelect.insertBefore(opt, subtopicSelect.lastElementChild);
        subtopicSelect.value = name;
        newSubtopicRow.style.display = 'none';
        newSubtopicInput.value = '';
      } else {
        newSubtopicInput.style.borderColor = '#ef4444';
        setTimeout(() => { newSubtopicInput.style.borderColor = ''; }, 2000);
      }
      newSubtopicBtn.textContent = '+ Add'; newSubtopicBtn.disabled = false;
    });

    leftCol.appendChild(topicsSectionTitle);
    leftCol.appendChild(categoryHint);
    leftCol.appendChild(topicField);
    leftCol.appendChild(subtopicField);

    // ─── RIGHT COLUMN CONTENT ─────────────────

    // Notes
    const notesSectionTitle = document.createElement('div');
    notesSectionTitle.className = 'lcsync-section-title';
    notesSectionTitle.textContent = 'Notes';

    const notesField = document.createElement('div');
    notesField.className = 'lcsync-field';

    const notesArea = document.createElement('textarea');
    notesArea.className = 'lcsync-input';
    Object.assign(notesArea.style, { height: '80px', resize: 'vertical', minHeight: '60px' });
    notesArea.placeholder = 'Key insight, edge case, time/space complexity\u2026';
    notesField.appendChild(notesArea);

    rightCol.appendChild(notesSectionTitle);
    rightCol.appendChild(notesField);

    // Links
    const linksSectionTitle = document.createElement('div');
    linksSectionTitle.className = 'lcsync-section-title';
    linksSectionTitle.style.marginTop = '10px';
    linksSectionTitle.textContent = 'Links';

    const chatField = document.createElement('div');
    chatField.className = 'lcsync-field';
    const chatLabelEl = document.createElement('label');
    chatLabelEl.className = 'lcsync-label';
    chatLabelEl.textContent = 'ChatGPT Chat URL';
    const chatInput = document.createElement('input');
    chatInput.type = 'url'; chatInput.className = 'lcsync-input';
    chatInput.placeholder = 'https://chatgpt.com/c/\u2026';
    chatField.appendChild(chatLabelEl); chatField.appendChild(chatInput);

    const ytField = document.createElement('div');
    ytField.className = 'lcsync-field';
    const ytLabelEl = document.createElement('label');
    ytLabelEl.className = 'lcsync-label';
    ytLabelEl.textContent = 'YouTube Tutorial URL';
    const ytInput = document.createElement('input');
    ytInput.type = 'url'; ytInput.className = 'lcsync-input';
    ytInput.placeholder = 'https://youtube.com/watch?v=\u2026';
    ytField.appendChild(ytLabelEl); ytField.appendChild(ytInput);

    rightCol.appendChild(linksSectionTitle);
    rightCol.appendChild(chatField);
    rightCol.appendChild(ytField);

    // Images
    const imagesSectionTitle = document.createElement('div');
    imagesSectionTitle.className = 'lcsync-section-title';
    imagesSectionTitle.style.marginTop = '10px';
    imagesSectionTitle.textContent = 'Images';

    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.multiple = true;
    fileInput.style.display = 'none';

    const fileDropZone = document.createElement('div');
    Object.assign(fileDropZone.style, {
      border:       '2px dashed #27272a',
      borderRadius: '8px',
      padding:      '12px 14px',
      textAlign:    'center',
      cursor:       'pointer',
      fontSize:     '12px',
      color:        '#52525b',
      transition:   'border-color 0.2s, background 0.2s',
    });
    fileDropZone.innerHTML = '&#128206; Click to select or drag &amp; drop images';

    fileDropZone.addEventListener('click', () => fileInput.click());
    fileDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileDropZone.style.borderColor = '#FFA116';
      fileDropZone.style.background  = 'rgba(255,161,22,0.04)';
    });
    fileDropZone.addEventListener('dragleave', () => {
      fileDropZone.style.borderColor = '#27272a';
      fileDropZone.style.background  = 'transparent';
    });
    fileDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      fileDropZone.style.borderColor = '#27272a';
      fileDropZone.style.background  = 'transparent';
      Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')).forEach(f => selectedFiles.push(f));
      renderPreviews();
    });

    const filePreview = document.createElement('div');
    Object.assign(filePreview.style, {
      display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px',
    });

    function renderPreviews() {
      filePreview.innerHTML = '';
      fileDropZone.innerHTML = selectedFiles.length > 0
        ? `&#10003; ${selectedFiles.length} image${selectedFiles.length > 1 ? 's' : ''} selected`
        : '&#128206; Click to select or drag &amp; drop images';
      selectedFiles.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'lcsync-thumb-wrapper';
          const img = document.createElement('img');
          Object.assign(img.style, {
            width: '52px', height: '52px', objectFit: 'cover',
            borderRadius: '6px', border: '1px solid #27272a', display: 'block',
          });
          img.src = ev.target.result;
          const removeBtn = document.createElement('button');
          removeBtn.className = 'lcsync-thumb-remove';
          removeBtn.title = 'Remove image';
          removeBtn.textContent = '\u2715';
          removeBtn.addEventListener('click', () => {
            selectedFiles.splice(idx, 1);
            renderPreviews();
          });
          wrapper.appendChild(img);
          wrapper.appendChild(removeBtn);
          filePreview.appendChild(wrapper);
        };
        reader.readAsDataURL(file);
      });
    }

    fileInput.addEventListener('change', () => {
      Array.from(fileInput.files).forEach(f => selectedFiles.push(f));
      fileInput.value = '';
      renderPreviews();
    });

    rightCol.appendChild(imagesSectionTitle);
    rightCol.appendChild(fileInput);
    rightCol.appendChild(fileDropZone);
    rightCol.appendChild(filePreview);

    // Assemble body
    body.appendChild(leftCol);
    body.appendChild(divider);
    body.appendChild(rightCol);

    // ── Footer: action buttons ────────────────
    const footer = document.createElement('div');
    Object.assign(footer.style, {
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'flex-end',
      gap:            '10px',
      padding:        '12px 20px',
      borderTop:      '1px solid #27272a',
      flexShrink:     '0',
      background:     '#18181b',
    });

    const skipBtn = document.createElement('button');
    skipBtn.className   = 'lcsync-btn';
    skipBtn.textContent = 'Skip';
    Object.assign(skipBtn.style, {
      background: 'transparent', color: '#a1a1aa', border: '1px solid #27272a',
    });
    skipBtn.addEventListener('click', () => closeModal(backdrop));

    const saveBtn = document.createElement('button');
    saveBtn.disabled = true;
    saveBtn.className = 'lcsync-btn';
    Object.assign(saveBtn.style, {
      background: '#f97316', color: '#ffffff', minWidth: '130px', fontWeight: '600',
      boxShadow: '0 2px 10px rgba(249,115,22,0.25)',
    });
    saveBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round"
           style="display:inline-block;vertical-align:-2px;margin-right:5px;">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Save Solution`;

    saveBtn.addEventListener('click', async () => {
      if (saveBtn.disabled) return;
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        showToast('Extension reloaded \u2014 please refresh the page.', 'error');
        return;
      }
      try {
        const images = await Promise.all(selectedFiles.map(f => resizeImage(f)));
        let resolvedTopic    = topicSelect.value === '__create__'    ? null : (topicSelect.value    || null);
        let resolvedSubtopic = subtopicSelect.value === '__create__' ? null : (subtopicSelect.value || null);

        if (!resolvedTopic && newTopicInput.value.trim()) {
          resolvedTopic = newTopicInput.value.trim();
        }
        if (!resolvedSubtopic && newSubtopicInput.value.trim()) {
          resolvedSubtopic = newSubtopicInput.value.trim();
        }

        const payload = {
          ...submissionPayload,
          notes:        notesArea.value.trim() || null,
          chatgptUrl:   chatInput.value.trim() || null,
          youtubeUrl:   ytInput.value.trim()   || null,
          images,
          // If the lookup failed and no selection was made, preserve any
          // categorization already stored instead of clearing unknown values.
          ...(categoryLookupSucceeded || resolvedTopic || resolvedSubtopic ? {
            userTopic:    resolvedTopic,
            userSubtopic: resolvedSubtopic,
            subtopic:     resolvedSubtopic,
          } : {}),
        };
        closeModal(backdrop);
        showToast('Saving solution in background\u2026', 'info');
        chrome.runtime.sendMessage({ type: 'SAVE_SUBMISSION', payload });
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      }
    });

    footer.appendChild(skipBtn);
    footer.appendChild(saveBtn);

    // ── Assemble modal ─────────────────────────
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    tracePopup(11, 'PASS: popup attached to page', { slug: submissionPayload.problemSlug, attached: backdrop.isConnected });

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    });

    // Auto-focus notes
    setTimeout(() => notesArea.focus(), 100);

    // Wait for both reads before enabling selection, so a late saved value
    // cannot overwrite the user's choices or be omitted from an early save.
    const requestModalData = (message) => new Promise((resolve) => {
      tracePopup(12, 'Requesting categorization data', { request: message.type });
      try {
        chrome.runtime.sendMessage(message, (result) => {
          tracePopup(12, 'Categorization response received', {
            request: message.type, success: Boolean(result?.success && !chrome.runtime.lastError),
          });
          resolve(chrome.runtime.lastError ? { success: false } : (result || { success: false }));
        });
      } catch (_) { resolve({ success: false }); }
    });
    Promise.all([
      requestModalData({ type: 'FETCH_TOPICS' }),
      requestModalData({
        type: 'FETCH_SUBMISSION_CATEGORIZATION',
        payload: {
          problemNumber: submissionPayload.problemNumber,
          problemSlug: submissionPayload.problemSlug,
          problemTitle: submissionPayload.problemTitle,
          language: submissionPayload.language,
        },
      }),
    ]).then(([result, savedResult]) => {
      if (!backdrop.isConnected) return;
      categoryLookupSucceeded = savedResult.success === true;
      const fallbackTopics = [
        'Array','Strings','Binary Search','Stack','Recursion','Linked List',
        'Double Linked List','HashMap','Tree','Binary Search Tree','Graph',
        'Heap','Backtracking','Greedy','Dynamic Programming','Trie','Bit Manipulation',
      ];
      const topics = result.success ? [...(result.topics || [])] : fallbackTopics.map(name => ({ name }));
      const subtopics = result.success ? [...(result.subtopics || [])] : [];
      const saved = savedResult.success ? savedResult.categorization : null;
      // Preserve saved custom names even if they are absent from the catalog.
      if (saved?.topic && !topics.some(topic => topic.name === saved.topic)) {
        topics.push({ name: saved.topic });
      }
      if (saved?.topic && saved.subtopic && !subtopics.some(sub => sub.topic_name === saved.topic && sub.name === saved.subtopic)) {
        subtopics.push({ topic_name: saved.topic, name: saved.subtopic });
      }
      populateTopics(topics, subtopics);
      if (saved?.topic) {
        topicSelect.value = saved.topic;
        populateSubtopics(saved.topic);
        subtopicSelect.value = saved.subtopic || '';
      }
      categoryHint.textContent = !savedResult.success
        ? 'Could not load saved categorization. Please select it below.'
        : saved?.topic ? 'Saved categorization loaded. You can change it below.' : '';
      saveBtn.disabled = false;
      tracePopup(12, 'DONE: category selectors and Save enabled', {
        savedCategoryLoaded: Boolean(saved?.topic), catalogLoaded: Boolean(result.success),
      });
    });
  }

  function closeModal(backdrop) {
    backdrop.style.opacity    = '0';
    backdrop.style.transition = 'opacity 0.2s';
    setTimeout(() => {
      backdrop.remove();
      modalOpen = false;
    }, 200);
  }


  // ─────────────────────────────────────────────
  // Toast notification helper (Feature 1)
  // ─────────────────────────────────────────────

  /** Track active toasts for max-3 stacking */
  const _activeToasts = [];
  const TOAST_MAX = 3;

  /**
   * Show a sliding toast at the bottom-right.
   * @param {string} message
   * @param {'success'|'error'|'info'} type
   */
  function showToast(message, type = 'info') {
    // Enforce max 3 toasts
    if (_activeToasts.length >= TOAST_MAX) {
      const oldest = _activeToasts.shift();
      oldest && oldest.remove();
    }

    const borderColor = type === 'success' ? '#22c55e'
      : type === 'error'   ? '#ef4444'
      : '#FFA116';

    const toast = document.createElement('div');
    Object.assign(toast.style, {
      position:     'fixed',
      bottom:       `${24 + _activeToasts.length * 72}px`,
      right:        '20px',
      zIndex:       '2147483647',
      background:   '#1a1a2e',
      border:       `1px solid ${borderColor}`,
      borderLeft:   `4px solid ${borderColor}`,
      borderRadius: '10px',
      padding:      '12px 16px',
      fontSize:     '13px',
      color:        '#e1e1e6',
      maxWidth:     '320px',
      boxShadow:    '0 8px 32px rgba(0,0,0,0.5)',
      fontFamily:   "'Inter', 'Segoe UI', system-ui, sans-serif",
      animation:    'lcSyncToastIn 0.3s ease forwards',
      lineHeight:   '1.4',
    });
    toast.textContent = message;

    document.body.appendChild(toast);
    _activeToasts.push(toast);

    // Auto-dismiss after 4 s
    const dismissTimer = setTimeout(() => {
      toast.style.animation = 'lcSyncToastOut 0.3s ease forwards';
      setTimeout(() => {
        toast.remove();
        const i = _activeToasts.indexOf(toast);
        if (i !== -1) _activeToasts.splice(i, 1);
        // Re-stack remaining toasts
        _activeToasts.forEach((t, idx) => {
          t.style.bottom = `${24 + idx * 72}px`;
        });
      }, 300);
    }, 4000);

    // Click to dismiss early
    toast.addEventListener('click', () => {
      clearTimeout(dismissTimer);
      toast.style.animation = 'lcSyncToastOut 0.3s ease forwards';
      setTimeout(() => {
        toast.remove();
        const i = _activeToasts.indexOf(toast);
        if (i !== -1) _activeToasts.splice(i, 1);
        _activeToasts.forEach((t, idx) => {
          t.style.bottom = `${24 + idx * 72}px`;
        });
      }, 300);
    });
  }

  // ─────────────────────────────────────────────
  // Image resize helper (Feature 2)
  // ─────────────────────────────────────────────

  /**
   * Resize an image file to at most maxWidth px wide using a canvas,
   * then return a JPEG data-URL at 85% quality.
   */
  async function resizeImage(file, maxWidth = 800) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale  = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = img.width  * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => {
        // Fallback to plain base64 if canvas fails
        URL.revokeObjectURL(url);
        fileToBase64(file).then(resolve);
      };
      img.src = url;
    });
  }

  // ─────────────────────────────────────────────
  // SPA Navigation Detection (MutationObserver)
  // ─────────────────────────────────────────────

  /**
   * LeetCode is a Single-Page Application; URL changes don't trigger
   * a full page reload. We watch for URL changes and re-apply our hooks.
   */
  let _lastHref = window.location.href;
  const _navObserver = new MutationObserver(
    debounce(() => {
      if (window.location.href !== _lastHref) {
        _lastHref = window.location.href;
        console.log('[LC Sync] SPA navigation detected:', _lastHref);
        // Reset modal state on navigation
        modalOpen = false;
      }
    }, 300)
  );

  _navObserver.observe(document.body, { childList: true, subtree: true });

  // ─────────────────────────────────────────────
  // Listen for messages from background / popup
  // ─────────────────────────────────────────────
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'GET_PAGE_DATA') {
        sendResponse({ payload: buildSubmissionPayload() });
        return false;
      }

      // Feature 1: receive SAVE_RESULT from background.js and show toast
      if (message.type === 'SAVE_RESULT') {
        if (message.success) {
          if (message.skipped) {
            showToast('⚠️ Identical solution already saved — skipped.', 'info');
          } else if (message.isAlternate) {
            showToast(`✅ Saved as ${message.alternateLabel || 'Alternate Approach'}!`, 'success');
          } else {
            showToast('✅ Solution synced to Supabase!', 'success');
          }
        } else {
          showToast(`❌ Save failed: ${message.error || 'Unknown error'}`, 'error');
        }
        return false;
      }

      return false;
    });
  }

  console.log('[LC Sync] Content script loaded on', window.location.href);
})();
