/**
 * background.js — Service Worker for LC Sync Chrome Extension (Manifest v3)
 *
 * Responsibilities:
 *  - Intercepts and validates accepted LeetCode submissions sent by content.js
 *  - Persists accepted solutions to the user's private Supabase instance
 *  - Deduplicates submissions and manages alternate approach solutions
 *  - Serves statistics and recent activity data to the extension popup
 *  - Synchronizes user credentials stored in chrome.storage.sync
 */

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const SUPABASE_TABLE = 'submissions';

// ─────────────────────────────────────────────
// Database & Utility Helpers
// ─────────────────────────────────────────────

/**
 * Retrieve user Supabase credentials from chrome.storage.sync.
 */
async function getCredentials() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['supabaseUrl', 'supabaseKey'], (result) => {
      resolve({
        supabaseUrl: result.supabaseUrl || '',
        supabaseKey: result.supabaseKey || '',
      });
    });
  });
}

/**
 * Construct standard headers for Supabase REST API calls.
 */
function buildHeaders(key) {
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: 'return=representation',
  };
}

/**
 * Generate an RFC4122 v4 compliant UUID.
 */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normalize image URLs in LeetCode HTML content to absolute URLs and append referrer policy.
 */
function normalizeDescriptionImageUrls(description) {
  if (!description) return description;
  return description.replace(/<img\b([^>]*)>/gi, (imgTag, attributes) => {
    let newAttrs = attributes.replace(/(\bsrc\s*=\s*["'])([^"']+)(["'])/gi, (match, prefix, url, suffix) => {
      if (url.startsWith('data:')) return match;
      try { return `${prefix}${new URL(url, 'https://leetcode.com').href}${suffix}`; }
      catch { return match; }
    });
    if (!/referrerpolicy/i.test(newAttrs)) {
      newAttrs += ' referrerpolicy="no-referrer"';
    }
    return `<img${newAttrs}>`;
  });
}

/**
 * Locate an existing submission for a problem by ID, slug, or title matching the target language.
 */
async function findExistingSubmission(supabaseUrl, supabaseKey, problemId, language, problemSlug, problemTitle) {
  // ── 1. Match by problem_id (primary key lookup) ────────────────────────────
  if (problemId && problemId !== 0) {
    const endpoint =
      `${supabaseUrl}/rest/v1/${SUPABASE_TABLE}` +
      `?problem_id=eq.${problemId}&language=eq.${encodeURIComponent(language)}&select=id,problem_id,code,alternate_codes,problem_title,description,url,tags,difficulty&limit=1`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: buildHeaders(supabaseKey),
      });
      if (response.ok) {
        const rows = await response.json();
        if (rows.length > 0) return rows[0];
      }
    } catch { /* fall through */ }
  }

  // ── 2. Match by problem_slug + language (fallback for unnumbered problems) ─
  if (problemSlug) {
    const endpoint =
      `${supabaseUrl}/rest/v1/${SUPABASE_TABLE}` +
      `?problem_slug=eq.${encodeURIComponent(problemSlug)}&language=eq.${encodeURIComponent(language)}&select=id,problem_id,code,alternate_codes,problem_title,description,url,tags,difficulty&limit=1`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: buildHeaders(supabaseKey),
      });
      if (response.ok) {
        const rows = await response.json();
        if (rows.length > 0) return rows[0];
      }
    } catch { /* fall through */ }
  }

  // ── 3. Match by problem_title + language (last resort fallback) ────────────
  if (problemTitle && problemTitle !== 'Unknown Problem') {
    const endpoint =
      `${supabaseUrl}/rest/v1/${SUPABASE_TABLE}` +
      `?problem_title=eq.${encodeURIComponent(problemTitle)}&language=eq.${encodeURIComponent(language)}&select=id,problem_id,code,alternate_codes,problem_title,description,url,tags,difficulty&limit=1`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: buildHeaders(supabaseKey),
      });
      if (response.ok) {
        const rows = await response.json();
        if (rows.length > 0) return rows[0];
      }
    } catch { /* fall through */ }
  }

  return null;
}

/**
 * Fetch problem details (ID, description, difficulty, topic tags) from LeetCode's GraphQL API.
 * Serves as a fallback when client-side DOM scraping is incomplete.
 */
async function fetchQuestionDetailsFromGraphQL(problemSlug) {
  if (!problemSlug) return null;
  const endpoint = 'https://leetcode.com/graphql';
  const query = `
    query questionContent($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionFrontendId
        content
        difficulty
        topicTags {
          name
        }
      }
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { titleSlug: problemSlug }
      })
    });

    if (!response.ok) return null;
    const resJson = await response.json();
    const q = resJson?.data?.question;
    if (!q) return null;

    return {
      problemNumber: q.questionFrontendId || null,
      description: q.content || null,
      difficulty: q.difficulty || null,
      tags: Array.isArray(q.topicTags) ? q.topicTags.map(t => t.name) : []
    };
  } catch (err) {
    console.error('[LC Sync BG] Failed to fetch question details from GraphQL:', err);
    return null;
  }
}

/**
 * Persist an accepted submission to Supabase.
 * Appends to alternate_codes if a submission for the same problem and language already exists.
 */
async function saveSubmission(data) {
  const { supabaseUrl, supabaseKey } = await getCredentials();

  if (!supabaseUrl || !supabaseKey) {
    return { success: false, error: 'Supabase credentials not configured. Please open Options.' };
  }

  // Guard: Only process accepted submissions
  if (data.isAccepted === false) {
    return { success: false, error: 'Submission was not accepted — not saved.' };
  }

  let problemId = parseInt(data.problemNumber, 10) || 0;
  const language  = data.language || 'Unknown';
  const newCode   = data.code || '';
  const problemSlug = data.problemSlug || null;

  let description = normalizeDescriptionImageUrls(data.description || null);
  let difficulty  = (data.difficulty && data.difficulty !== 'Unknown') ? data.difficulty : null;
  let tags        = Array.isArray(data.tags) ? [...data.tags] : [];

  // Fallback: Query GraphQL API if DOM metadata or description is missing
  if (((!description || description.trim() === '') || !problemId) && problemSlug) {
    console.log('[LC Sync BG] Fetching question details from GraphQL for slug:', problemSlug);
    const details = await fetchQuestionDetailsFromGraphQL(problemSlug);
    if (details) {
      if (!problemId && details.problemNumber) problemId = parseInt(details.problemNumber, 10) || 0;
      if (details.description) description = normalizeDescriptionImageUrls(details.description);
      if (!difficulty && details.difficulty)   difficulty = details.difficulty;
      if (tags.length === 0 && details.tags)   tags = details.tags;
      console.log('[LC Sync BG] GraphQL fetch complete. Description length:', description?.length || 0);
    }
  }

  // Convert plain text notes into block editor format if needed
  let pageBlocks = data.pageBlocks || null;
  if (!pageBlocks && data.notes) {
    pageBlocks = [
      { id: uuid(), type: 'h2',  content: 'Notes from submission' },
      { id: uuid(), type: 'text', content: data.notes },
    ];
  }

  // Search for existing submission for current problem + language
  const existing = await findExistingSubmission(
    supabaseUrl, supabaseKey, problemId, language, problemSlug,
    data.problemTitle || 'Unknown Problem'
  );

  if (existing) {
    const freshDescriptionHasImages = /<img\b/i.test(description || '');
    const existingDescriptionHasImages = /<img\b/i.test(existing.description || '');
    const shouldBackfillDescription = Boolean(
      description && (!existing.description || (freshDescriptionHasImages && !existingDescriptionHasImages))
    );
    const shouldBackfillProblemId = Boolean(problemId && !existing.problem_id);
    const endpoint = `${supabaseUrl}/rest/v1/${SUPABASE_TABLE}?id=eq.${existing.id}`;

    // Skip duplicate if primary solution code is identical
    if (existing.code && existing.code.trim() === newCode.trim()) {
      if (shouldBackfillDescription || shouldBackfillProblemId) {
        const patchBody = {};
        if (shouldBackfillDescription) patchBody.description = description;
        if (shouldBackfillProblemId) patchBody.problem_id = problemId;
        try {
          const response = await fetch(endpoint, {
            method: 'PATCH', headers: buildHeaders(supabaseKey), body: JSON.stringify(patchBody),
          });
          if (!response.ok) throw new Error(await response.text());
          return { success: true, data: await response.json(), skipped: true, backfilled: true };
        } catch (err) {
          return { success: false, error: `Could not update problem metadata: ${err.message}` };
        }
      }
      return { success: true, data: existing, skipped: true, reason: 'Identical code already saved.' };
    }

    // Skip duplicate if alternate approach code is identical
    const alternates = Array.isArray(existing.alternate_codes) ? existing.alternate_codes : [];
    const isDuplicateAlternate = alternates.some(
      (alt) => alt.code && alt.code.trim() === newCode.trim()
    );
    if (isDuplicateAlternate) {
      return { success: true, data: existing, skipped: true, reason: 'Identical alternate code already saved.' };
    }

    // Append new code version as an alternate approach
    const altEntry = {
      id:        uuid(),
      code:      newCode,
      language,
      label:     `Alternate Approach ${alternates.length + 1}`,
      runtime:   data.runtime  || null,
      memory:    data.memory   || null,
      notes:     data.notes    || null,
      saved_at:  new Date().toISOString(),
    };

    const updatedAlternates = [...alternates, altEntry];

    // Build update payload
    const patchBody = { alternate_codes: updatedAlternates };
    if (data.userTopic    != null) patchBody.user_topic    = data.userTopic;
    if (data.userSubtopic != null) patchBody.user_subtopic = data.userSubtopic;
    if (data.subtopic     != null) patchBody.subtopic      = data.subtopic;
    else if (data.userSubtopic != null) patchBody.subtopic = data.userSubtopic;

    if (shouldBackfillDescription) patchBody.description = description;
    if (shouldBackfillProblemId) patchBody.problem_id = problemId;

    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: buildHeaders(supabaseKey),
        body: JSON.stringify(patchBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        return { success: false, error: `Supabase PATCH error ${response.status}: ${errText}` };
      }

      const responseData = await response.json();
      console.log('[LC Sync] Alternate code saved:', altEntry.label);
      return { success: true, data: responseData, isAlternate: true, alternateLabel: altEntry.label };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Insert new submission record
  const endpoint = `${supabaseUrl}/rest/v1/${SUPABASE_TABLE}`;

  // Merge userTopic into tags array if missing
  const mergedTags = [...tags];
  if (data.userTopic && !mergedTags.includes(data.userTopic)) {
    mergedTags.push(data.userTopic);
  }

  const row = {
    problem_id:      problemId,
    problem_title:   data.problemTitle   || 'Unknown Problem',
    problem_slug:    problemSlug,
    difficulty:      difficulty,
    tags:            mergedTags,
    description:     description,
    language,
    code:            newCode,
    notes:           data.notes          || null,
    page_blocks:     pageBlocks          || [],
    alternate_codes: [],
    images:          data.images         || [],
    submission_time: data.submittedAt    || new Date().toISOString(),
    is_accepted:     true,
    runtime:         data.runtime        || null,
    memory:          data.memory         || null,
    url:             data.leetcodeUrl    || null,
    chatgpt_url:     data.chatgptUrl     || null,
    youtube_url:     data.youtubeUrl     || null,
    user_topic:      data.userTopic      || null,
    user_subtopic:   data.userSubtopic   || null,
    subtopic:        data.subtopic       || data.userSubtopic || null,
    is_revised:      false,
    quality:         null,
  };

  // Ensure topic and subtopic entries exist in database tables
  if (data.userTopic) {
    createTopic(data.userTopic).catch(() => {});
    if (data.userSubtopic || data.subtopic) {
      createSubtopic(data.userTopic, data.userSubtopic || data.subtopic).catch(() => {});
    }
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(supabaseKey),
      body: JSON.stringify(row),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[LC Sync] Supabase error:', errText);
      return { success: false, error: `Supabase returned ${response.status}: ${errText}` };
    }

    const responseData = await response.json();
    console.log('[LC Sync] Submission saved:', responseData);
    return { success: true, data: responseData };
  } catch (err) {
    console.error('[LC Sync] Network error saving submission:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch total submission count from Supabase using HTTP HEAD/Count headers.
 */
async function fetchSubmissionCount() {
  const { supabaseUrl, supabaseKey } = await getCredentials();
  if (!supabaseUrl || !supabaseKey) {
    return { success: false, count: 0, error: 'Not configured' };
  }

  const endpoint = `${supabaseUrl}/rest/v1/${SUPABASE_TABLE}?select=id`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        ...buildHeaders(supabaseKey),
        Prefer: 'count=exact',
        'Range-Unit': 'items',
        Range: '0-0',
      },
    });

    if (!response.ok) {
      return { success: false, count: 0, error: `HTTP ${response.status}` };
    }

    const contentRange = response.headers.get('Content-Range') || '';
    const match = contentRange.match(/\/(\d+)$/);
    const count = match ? parseInt(match[1], 10) : 0;
    return { success: true, count };
  } catch (err) {
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Fetch recent submissions ordered by creation timestamp.
 */
async function fetchRecentSubmissions(limit = 5) {
  const { supabaseUrl, supabaseKey } = await getCredentials();
  if (!supabaseUrl || !supabaseKey) {
    return { success: false, submissions: [], error: 'Not configured' };
  }

  const endpoint =
    `${supabaseUrl}/rest/v1/${SUPABASE_TABLE}` +
    `?select=id,problem_id,problem_title,difficulty,language,created_at` +
    `&order=created_at.desc` +
    `&limit=${limit}`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: buildHeaders(supabaseKey),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, submissions: [], error: errText };
    }

    const submissions = await response.json();
    return { success: true, submissions };
  } catch (err) {
    return { success: false, submissions: [], error: err.message };
  }
}

/**
 * Fetch custom topics and subtopics list from Supabase.
 */
async function fetchTopicsFromDB() {
  const { supabaseUrl, supabaseKey } = await getCredentials();
  if (!supabaseUrl || !supabaseKey) {
    return { success: false, topics: [], subtopics: [], error: 'Not configured' };
  }

  try {
    const [topicsRes, subtopicsRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/topics?select=name,description,sort_order&order=sort_order.asc`, {
        method: 'GET', headers: buildHeaders(supabaseKey),
      }),
      fetch(`${supabaseUrl}/rest/v1/subtopics?select=topic_name,name,description,sort_order&order=topic_name.asc,sort_order.asc`, {
        method: 'GET', headers: buildHeaders(supabaseKey),
      }),
    ]);

    if (!topicsRes.ok || !subtopicsRes.ok) {
      return { success: false, topics: [], subtopics: [], error: 'DB fetch failed' };
    }

    const topics = await topicsRes.json();
    const subtopics = await subtopicsRes.json();
    return { success: true, topics, subtopics };
  } catch (err) {
    return { success: false, topics: [], subtopics: [], error: err.message };
  }
}

/**
 * Insert a new topic into Supabase topics table.
 */
async function createTopic(name) {
  const { supabaseUrl, supabaseKey } = await getCredentials();
  if (!supabaseUrl || !supabaseKey) return { success: false, error: 'Not configured' };

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/topics`, {
      method: 'POST',
      headers: buildHeaders(supabaseKey),
      body: JSON.stringify({ name: name.trim(), description: '', sort_order: 999 }),
    });
    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: errText };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Insert a new subtopic into Supabase subtopics table.
 */
async function createSubtopic(topicName, name) {
  const { supabaseUrl, supabaseKey } = await getCredentials();
  if (!supabaseUrl || !supabaseKey) return { success: false, error: 'Not configured' };

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/subtopics`, {
      method: 'POST',
      headers: buildHeaders(supabaseKey),
      body: JSON.stringify({ topic_name: topicName.trim(), name: name.trim(), description: '', sort_order: 999 }),
    });
    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: errText };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete a topic from Supabase by name.
 */
async function deleteTopic(name) {
  const { supabaseUrl, supabaseKey } = await getCredentials();
  if (!supabaseUrl || !supabaseKey) return { success: false, error: 'Not configured' };

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/topics?name=eq.${encodeURIComponent(name.trim())}`, {
      method: 'DELETE',
      headers: buildHeaders(supabaseKey),
    });
    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: errText };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete a subtopic from Supabase by topic name and subtopic name.
 */
async function deleteSubtopic(topicName, name) {
  const { supabaseUrl, supabaseKey } = await getCredentials();
  if (!supabaseUrl || !supabaseKey) return { success: false, error: 'Not configured' };

  try {
    const endpoint = `${supabaseUrl}/rest/v1/subtopics?topic_name=eq.${encodeURIComponent(topicName.trim())}&name=eq.${encodeURIComponent(name.trim())}`;
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: buildHeaders(supabaseKey),
    });
    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: errText };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Test connectivity and API key validity against Supabase REST endpoint.
 */
async function testConnection() {
  const { supabaseUrl, supabaseKey } = await getCredentials();
  if (!supabaseUrl || !supabaseKey) {
    return { success: false, error: 'Credentials not set' };
  }

  const endpoint = `${supabaseUrl}/rest/v1/${SUPABASE_TABLE}?select=id&limit=0`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: buildHeaders(supabaseKey),
    });

    if (response.ok || response.status === 406) {
      return { success: true };
    }
    if (response.status === 401 || response.status === 403) {
      return { success: false, error: 'Invalid API key or insufficient permissions.' };
    }

    const errText = await response.text();
    return { success: false, error: `HTTP ${response.status}: ${errText}` };
  } catch (err) {
    return { success: false, error: `Network error: ${err.message}` };
  }
}

// ─────────────────────────────────────────────
// Message Router
// ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[LC Sync BG] Received message:', message.type);

  switch (message.type) {
    case 'SAVE_SUBMISSION':
      saveSubmission(message.payload)
        .then((res) => {
          try { sendResponse(res); } catch (_) {}

          // Notify content script of save status
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type:           'SAVE_RESULT',
                success:        res.success,
                skipped:        res.skipped        || false,
                isAlternate:    res.isAlternate    || false,
                alternateLabel: res.alternateLabel || null,
                error:          res.error          || null,
              });
            }
          });
        })
        .catch((err) => {
          try { sendResponse({ success: false, error: err.message }); } catch (_) {}
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type:    'SAVE_RESULT',
                success: false,
                error:   err.message,
              });
            }
          });
        });
      return true;

    case 'FETCH_STATS':
      Promise.all([fetchSubmissionCount(), fetchRecentSubmissions(5)])
        .then(([countResult, recentResult]) => {
          sendResponse({
            success: true,
            count: countResult.count || 0,
            recentSubmissions: recentResult.submissions || [],
          });
        })
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case 'TEST_CONNECTION':
      testConnection()
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case 'GET_CREDENTIALS_STATUS': {
      getCredentials().then(({ supabaseUrl, supabaseKey }) => {
        sendResponse({ configured: !!(supabaseUrl && supabaseKey) });
      });
      return true;
    }

    case 'FETCH_TOPICS':
      fetchTopicsFromDB()
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, topics: [], subtopics: [], error: err.message }));
      return true;

    case 'CREATE_TOPIC':
      createTopic(message.payload?.name || '')
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case 'CREATE_SUBTOPIC':
      createSubtopic(message.payload?.topicName || '', message.payload?.name || '')
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case 'DELETE_TOPIC':
      deleteTopic(message.payload?.name || '')
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case 'DELETE_SUBTOPIC':
      deleteSubtopic(message.payload?.topicName || '', message.payload?.name || '')
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    default:
      console.warn('[LC Sync BG] Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

// ─────────────────────────────────────────────
// Installation / Update Handler
// ─────────────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[LC Sync] Extension installed. Opening options page...');
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log(`[LC Sync] Extension updated to v${chrome.runtime.getManifest().version}`);
  }
});
