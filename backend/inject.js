(function () {
  'use strict';

  console.log('[LC Sync Inject] ✅ Loaded in MAIN world — fetch/XHR hooked.');

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  function getEditorCode() {
    try {
      if (window.monaco) {
        const models = window.monaco.editor.getModels();
        if (models.length > 0) return models[0].getValue();
        if (window.monaco.editor.getEditors) {
          const eds = window.monaco.editor.getEditors();
          if (eds.length > 0) return eds[0].getValue();
        }
      }
    } catch (_) {}
    try {
      const cm = document.querySelector('.CodeMirror');
      if (cm && cm.CodeMirror) return cm.CodeMirror.getValue();
    } catch (_) {}
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Core: accept any LeetCode response shape and forward to content.js
  // ─────────────────────────────────────────────────────────────────────────────
  function checkAndForward(raw) {
    if (!raw || typeof raw !== 'object') return;

    const inner =
      raw.submissionDetails ||
      raw.submissionResult  ||
      raw;

    const state = raw.state || inner.state || '';
    if (state === 'PENDING' || state === 'STARTED') return;

    const statusMsg =
      raw.status_msg        ||
      raw.statusDisplay     ||
      inner.statusDisplay   ||
      inner.status_msg      ||
      '';

    const statusCode =
      raw.status_code  ??
      raw.status       ??
      inner.status_code ??
      inner.status      ??
      null;

    const isAccepted =
      statusMsg === 'Accepted' ||
      statusCode === 10        ||
      String(statusCode) === '10';

    console.log('[LC Sync Inject] checkAndForward →', {
      statusMsg, statusCode, isAccepted, state,
    });

    if (!isAccepted) return;

    const lang =
      raw.pretty_lang  || raw.lang_name || raw.lang    ||
      inner.langName   || inner.lang    || inner.langSlug || null;

    const code =
      raw.code   || inner.code  || getEditorCode() || null;

    const runtime =
      raw.status_runtime || inner.runtimeDisplay || inner.runtime || null;

    const memory =
      raw.status_memory  || inner.memoryDisplay  || inner.memory  || null;

    console.log('[LC Sync Inject] ✅ Accepted! Forwarding →', { lang, runtime, memory, hasCode: Boolean(code) });

    window.postMessage({
      type: 'LC_SYNC_SUBMISSION_DETECTED',
      data: { ...raw, _extracted_lang: lang, _extracted_code: code, _extracted_runtime: runtime, _extracted_memory: memory },
    }, '*');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Fetch intercept — log EVERY request to help diagnose URL patterns
  // ─────────────────────────────────────────────────────────────────────────────
  const _origFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await _origFetch.apply(this, args);

    try {
      const url  = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '');
      const body = args[1]?.body;

      // ── Log every LeetCode fetch so we can see what URLs are used ──────────
      if (url.includes('leetcode.com') || url.startsWith('/')) {
        const bodySnippet = (typeof body === 'string') ? body.slice(0, 120) : '(no body)';
        console.log('[LC Sync Inject] Fetch →', url, '|', bodySnippet);
      }

      // ── A. REST check endpoint ─────────────────────────────────────────────
      if (/\/submissions\/detail\/\d+\/check\/?/.test(url)) {
        console.log('[LC Sync Inject] ✔ REST check matched');
        response.clone().json()
          .then(data => checkAndForward(data))
          .catch(e => console.warn('[LC Sync Inject] REST parse error:', e));
      }

      // ── B. Any URL that looks like a submission check ──────────────────────
      else if (/\/submit\/|\/check\/|\/submission/.test(url) && !url.includes('graphql')) {
        console.log('[LC Sync Inject] ✔ Submit/check URL matched (broad):', url);
        response.clone().json()
          .then(data => checkAndForward(data))
          .catch(() => {});
      }

      // ── C. GraphQL — match any graphql endpoint ────────────────────────────
      else if (url.includes('graphql')) {
        if (typeof body === 'string') {
          // Log the operation name so we know what to look for
          const opMatch = body.match(/"operationName"\s*:\s*"([^"]+)"/);
          const opName  = opMatch ? opMatch[1] : '(unknown op)';
          console.log('[LC Sync Inject] GraphQL op:', opName, '| URL:', url);

          const isSubmission =
            body.includes('ubmissionDetail')  ||   // submissionDetails / submissionDetail
            body.includes('ubmissionResult')  ||   // submissionResult / SubmissionResult
            body.includes('ubmitCode')        ||   // submitCode / SubmitCode
            body.includes('ubmit_code')       ||
            body.includes('checkSubmission')  ||
            body.includes('submissionCheck');

          if (isSubmission) {
            console.log('[LC Sync Inject] ✔ GraphQL submission op matched:', opName);
            response.clone().json()
              .then(json => {
                console.log('[LC Sync Inject] GraphQL data keys:', Object.keys(json?.data ?? {}));
                const result =
                  json?.data?.submissionDetails ||
                  json?.data?.submissionResult  ||
                  json?.data?.submitCode        ||
                  json?.data                    ||
                  json;
                checkAndForward(result);
              })
              .catch(e => console.warn('[LC Sync Inject] GraphQL parse error:', e));
          }
        }
      }
    } catch (err) {
      console.warn('[LC Sync Inject] Fetch hook error:', err);
    }

    return response;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // XHR fallback
  // ─────────────────────────────────────────────────────────────────────────────
  const _origOpen = XMLHttpRequest.prototype.open;
  const _origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._lcUrl = url;
    return _origOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        const url = this._lcUrl || '';
        if (url.includes('leetcode.com') || url.startsWith('/')) {
          console.log('[LC Sync Inject] XHR →', url);
        }
        if (/\/submissions\/detail\/\d+\/check\/?/.test(url)) {
          checkAndForward(JSON.parse(this.responseText));
        }
      } catch (_) {}
    });
    return _origSend.apply(this, args);
  };

})();
