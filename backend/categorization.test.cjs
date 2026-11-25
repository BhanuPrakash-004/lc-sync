const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const background = readFileSync(require.resolve('./background.js'), 'utf8');
const content = readFileSync(require.resolve('./content.js'), 'utf8');
const flush = () => new Promise(setImmediate);
const plain = (value) => JSON.parse(JSON.stringify(value));

function backgroundHarness(respond, configured = true) {
  const calls = [];
  let listener;
  vm.runInNewContext(background, {
    URL, console: { log() {}, error() {}, warn() {} },
    fetch: async (url, init) => {
      calls.push({ url: new URL(url), ...init });
      return respond(new URL(url), init);
    },
    chrome: {
      storage: { sync: { get: (_, callback) => callback(configured ? {
        supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key',
      } : {}) } },
      runtime: {
        onMessage: { addListener: (callback) => { listener = callback; } },
        onInstalled: { addListener() {} },
      },
      tabs: { query: (_, callback) => callback([]) },
    },
  });
  return {
    calls,
    request: (type, payload) => new Promise((resolve) => {
      assert.equal(listener({ type, payload }, {}, resolve), true);
    }),
  };
}
const json = (data) => new Response(JSON.stringify(data));

test('categorization lookup prefers the saved language and canonical subtopic', async () => {
  const h = backgroundHarness(() => json([
    { problem_id: 1, user_topic: 'Graph', subtopic: 'BFS', language: 'java' },
    { problem_id: 1, user_topic: 'Array', subtopic: 'Two Pointers', user_subtopic: 'Old name', language: 'python3' },
  ]));
  const result = await h.request('FETCH_SUBMISSION_CATEGORIZATION', { problemNumber: '1', language: 'python3' });
  assert.deepEqual(plain(result), { success: true, categorization: { topic: 'Array', subtopic: 'Two Pointers' } });
  assert.equal(h.calls[0].url.searchParams.get('or'), '(problem_id.eq.1)');
  assert.equal(h.calls[0].url.searchParams.get('order'), 'created_at.desc');
  assert.equal(h.calls[0].method, 'GET');
});

test('lookup falls back to slug, another language, and the legacy subtopic field', async () => {
  const h = backgroundHarness(() => json([
    { problem_id: 0, problem_slug: 'two-sum', user_topic: 'Array', user_subtopic: 'Hash Map', language: 'java' },
  ]));
  const result = await h.request('FETCH_SUBMISSION_CATEGORIZATION', {
    problemNumber: '1', problemSlug: 'two-sum', problemTitle: 'Two Sum', language: 'python3',
  });
  assert.deepEqual(plain(result.categorization), { topic: 'Array', subtopic: 'Hash Map' });
  assert.equal(h.calls.length, 1, 'all identifiers are checked in a single request');
  assert.equal(h.calls[0].url.searchParams.get('or'),
    '(problem_id.eq.1,problem_slug.eq."two-sum",problem_title.eq."Two Sum")');
});

test('new problems return no preselection, including title fallback', async () => {
  const h = backgroundHarness(() => json([]));
  const result = await h.request('FETCH_SUBMISSION_CATEGORIZATION', { problemTitle: 'A & B?' });
  assert.deepEqual(plain(result), { success: true, categorization: null });
  assert.equal(h.calls[0].url.searchParams.get('or'), '(problem_title.eq."A & B?")');
});

test('lookups without any problem identifier make no request', async () => {
  const h = backgroundHarness(() => { throw new Error('must not fetch'); });
  const result = await h.request('FETCH_SUBMISSION_CATEGORIZATION', { problemTitle: 'Unknown Problem' });
  assert.deepEqual(plain(result), { success: true, categorization: null });
  assert.equal(h.calls.length, 0);
});

test('single-request lookups keep the problem_id > slug > title priority', async () => {
  // Newest first, as ordered by the categorization request.
  const rows = [
    { id: 9, problem_id: 0, problem_slug: 'two-sum', problem_title: 'Two Sum', user_topic: 'Graph', language: 'python3', code: 'slug row', alternate_codes: [] },
    { id: 8, problem_id: 0, problem_slug: 'old-slug', problem_title: 'Two Sum', user_topic: 'Tree', language: 'python3', code: 'title row', alternate_codes: [] },
    { id: 7, problem_id: 1, problem_slug: 'two-sum', problem_title: 'Two Sum', user_topic: 'Array', language: 'python3', code: 'id row', alternate_codes: [] },
  ];
  const h = backgroundHarness(() => json(rows));
  const ids = { problemNumber: 1, problemSlug: 'two-sum', problemTitle: 'Two Sum', language: 'python3' };
  assert.equal((await h.request('FETCH_SUBMISSION_CATEGORIZATION', ids)).categorization.topic, 'Array');
  assert.equal((await h.request('CHECK_SUBMISSION_DUPLICATE', { ...ids, code: 'id row' })).match, 'primary');
  assert.equal((await h.request('CHECK_SUBMISSION_DUPLICATE', { ...ids, code: 'slug row' })).duplicate, false,
    'a lower-priority match must not shadow the problem_id match');
  const noId = { ...ids, problemNumber: null };
  assert.equal((await h.request('FETCH_SUBMISSION_CATEGORIZATION', noId)).categorization.topic, 'Graph');
  assert.equal((await h.request('CHECK_SUBMISSION_DUPLICATE', { ...noId, code: 'slug row' })).match, 'primary');
  const titleOnly = { ...ids, problemNumber: null, problemSlug: 'renamed-slug' };
  assert.equal((await h.request('FETCH_SUBMISSION_CATEGORIZATION', titleOnly)).categorization.topic, 'Graph');
});

test('identifiers with PostgREST reserved characters are quoted and escaped', async () => {
  const h = backgroundHarness(() => json([]));
  await h.request('CHECK_SUBMISSION_DUPLICATE', { problemTitle: 'Pow(x, n) "a\\b".', language: 'C++', code: 'x' });
  assert.equal(h.calls[0].url.searchParams.get('or'), '(problem_title.eq."Pow(x, n) \\"a\\\\b\\".")');
  assert.equal(h.calls[0].url.searchParams.get('language'), 'eq.C++');
});

test('an uncategorized language record still reuses another saved categorization', async () => {
  const h = backgroundHarness(() => json([
    { problem_id: 1, user_topic: null, language: 'python3' },
    { problem_id: 1, user_topic: 'Array', subtopic: 'Hash Map', language: 'java' },
  ]));
  const result = await h.request('FETCH_SUBMISSION_CATEGORIZATION', { problemNumber: 1, language: 'python3' });
  assert.equal(result.categorization.topic, 'Array');
});

test('lookup reports database failures and missing configuration', async () => {
  const failed = backgroundHarness(() => new Response('', { status: 503 }));
  assert.equal((await failed.request('FETCH_SUBMISSION_CATEGORIZATION', { problemNumber: 1 })).success, false);
  const missing = backgroundHarness(() => { throw new Error('must not fetch'); }, false);
  assert.equal((await missing.request('FETCH_SUBMISSION_CATEGORIZATION', { problemNumber: 1 })).success, false);
  assert.equal(missing.calls.length, 0);
});

test('alternate saves preserve, change, or clear the chosen categorization', async () => {
  for (const [topic, subtopic] of [['Array', 'Hash Map'], ['Graph', 'BFS'], ['Graph', null], [null, null]]) {
    const h = backgroundHarness((url, init) => json(init.method === 'GET'
      ? [{ id: 7, problem_id: 1, code: 'first approach', description: 'description', alternate_codes: [] }]
      : [{ id: 7 }]));
    const result = await h.request('SAVE_SUBMISSION', {
      problemNumber: 1, problemSlug: 'two-sum', description: 'description',
      language: 'python3', code: 'second approach',
      userTopic: topic, userSubtopic: subtopic, subtopic,
    });
    assert.equal(result.success, true);
    assert.equal(result.isAlternate, true);
    const update = JSON.parse(h.calls.find(call => call.method === 'PATCH').body);
    assert.equal(update.user_topic, topic);
    assert.equal(update.user_subtopic, subtopic);
    assert.equal(update.subtopic, subtopic);
    assert.equal(update.alternate_codes[0].code, 'second approach');
  }
});

test('a new save creates the subtopic only after its topic request finishes', async () => {
  for (const topicStatus of [201, 409]) { // 409: topic already exists
    let releaseTopic;
    const h = backgroundHarness((url, init) => {
      if (url.pathname.endsWith('/topics')) {
        return new Promise((resolve) => { releaseTopic = () => resolve(new Response('[]', { status: topicStatus })); });
      }
      return json(init.method === 'GET' ? [] : [{ id: 1 }]);
    });
    const result = await h.request('SAVE_SUBMISSION', {
      problemNumber: 1, problemSlug: 'two-sum', description: 'description', language: 'python3',
      code: 'code', userTopic: 'New Topic', userSubtopic: 'New Pattern',
    });
    assert.equal(result.success, true);
    await flush();
    const subtopicCalls = () => h.calls.filter(call => call.url.pathname.endsWith('/subtopics'));
    assert.equal(subtopicCalls().length, 0, 'subtopic must wait for the topic (foreign key)');
    releaseTopic();
    await flush(); await flush();
    assert.equal(subtopicCalls().length, 1);
    assert.deepEqual(JSON.parse(subtopicCalls()[0].body).name, 'New Pattern');
  }
});

test('duplicate lookup detects primary and alternate code using the same rules as saving, without writes', async () => {
  const existing = { id: 7, problem_id: 1, description: 'description', code: 'first approach', alternate_codes: [{ code: 'second approach' }] };
  for (const [code, match] of [['\n first approach \n', 'primary'], ['second approach', 'alternate'], ['third approach', null], ['first  approach', null]]) {
    const h = backgroundHarness(() => json([existing]));
    const payload = { problemNumber: 1, problemSlug: 'two-sum', language: 'Python3', description: 'description', code };
    const result = await h.request('CHECK_SUBMISSION_DUPLICATE', payload);
    assert.deepEqual(plain(result), { success: true, duplicate: Boolean(match), match });
    assert.equal(h.calls[0].url.searchParams.get('language'), 'eq.Python3');
    assert.equal(h.calls[0].url.searchParams.get('or'), '(problem_id.eq.1,problem_slug.eq."two-sum")');
    assert.equal(h.calls[0].url.searchParams.get('select').includes('description'), false,
      'the pre-popup check does not download the description HTML');
    if (match) {
      const saveResult = await h.request('SAVE_SUBMISSION', payload);
      assert.equal(saveResult.skipped, true, 'preflight and final save must agree');
    }
    assert.equal(h.calls.every(call => call.method === 'GET'), true);
  }
});

test('duplicate lookup uses slug/title fallbacks and respects language', async () => {
  // Saved under an older slug, so only the title identifies it.
  const h = backgroundHarness(url => json(
    url.searchParams.get('language') === 'eq.Python3'
      ? [{ problem_id: 0, problem_slug: 'old-slug', problem_title: 'Two Sum', code: 'saved code' }] : []
  ));
  const payload = { problemSlug: 'two-sum', problemTitle: 'Two Sum', language: 'Python3', code: 'saved code' };
  assert.equal((await h.request('CHECK_SUBMISSION_DUPLICATE', payload)).duplicate, true);
  assert.equal(h.calls.length, 1, 'all identifiers are checked in a single request');
  assert.equal(h.calls[0].url.searchParams.get('or'), '(problem_slug.eq."two-sum",problem_title.eq."Two Sum")');
  assert.equal((await h.request('CHECK_SUBMISSION_DUPLICATE', { ...payload, language: 'Java' })).duplicate, false);
});

test('duplicate lookup reports unavailable checks and never treats missing code as a duplicate', async () => {
  const failed = backgroundHarness(() => new Response('', { status: 503 }));
  const payload = { problemNumber: 1, language: 'Python3', code: 'saved code' };
  assert.deepEqual(plain(await failed.request('CHECK_SUBMISSION_DUPLICATE', payload)), { success: false, duplicate: false });
  const missing = backgroundHarness(() => { throw new Error('must not fetch'); }, false);
  assert.equal((await missing.request('CHECK_SUBMISSION_DUPLICATE', payload)).success, false);
  const empty = backgroundHarness(() => { throw new Error('must not fetch'); });
  assert.equal((await empty.request('CHECK_SUBMISSION_DUPLICATE', { ...payload, code: '  ' })).duplicate, false);
  assert.equal(empty.calls.length, 0);
});

// Minimal DOM double: exercises the actual modal and its event handlers without
// installing a browser dependency. Select values must correspond to an option.
async function modalHarness({ duplicateResult = { success: true, duplicate: false }, navigateDuringCheck = false } = {}) {
  const elements = [];
  const logs = [];
  class Element {
    constructor(tag) {
      this.tagName = tag;
      this.children = [];
      this.style = {};
      this.listeners = {};
      this.valueText = '';
      this.textContent = '';
      this.disabled = false;
      elements.push(this);
    }
    get isConnected() { return this.root || !!this.parent?.isConnected; }
    get lastElementChild() { return this.children.at(-1); }
    get value() { return this.valueText; }
    set value(value) {
      this.valueText = this.tagName !== 'select' || this.children.some(child => child.value === value) ? value : '';
    }
    set innerHTML(value) {
      this.html = value;
      this.children = [];
      if (this.tagName === 'select') {
        this.valueText = '';
        for (const match of value.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)) {
          const option = new Element('option');
          option.value = match[1];
          option.textContent = match[2];
          this.appendChild(option);
        }
      }
    }
    get innerHTML() { return this.html || ''; }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    insertBefore(child, before) { child.parent = this; this.children.splice(this.children.indexOf(before), 0, child); }
    remove() { this.parent = null; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    focus() {}
    async fire(type) {
      if (!this.disabled) await this.listeners[type]?.({ target: this, preventDefault() {} });
    }
  }
  const document = {
    title: '1. Two Sum - LeetCode',
    body: new Element('body'), head: new Element('head'),
    createElement: (tag) => new Element(tag),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  };
  document.body.root = document.head.root = true;
  const timers = [];
  const pending = {};
  const sent = [];
  let listener;
  const window = {
    location: new URL('https://leetcode.com/problems/two-sum/'),
    addEventListener: (type, callback) => { if (type === 'message') listener = callback; },
  };
  vm.runInNewContext(content, {
    window, document, console: { log: (...args) => logs.push(args.join(' ')) },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); },
    clearTimeout() {},
    MutationObserver: class { observe() {} },
    chrome: { runtime: {
      id: 'test-extension', onMessage: { addListener() {} },
      sendMessage: (message, callback) => {
        sent.push(message);
        if (message.type === 'CHECK_SUBMISSION_DUPLICATE') {
          if (navigateDuringCheck) window.location = new URL('https://leetcode.com/problems/add-two-numbers/');
          if (duplicateResult) callback(duplicateResult);
        } else if (callback) pending[message.type] = callback;
      },
    } },
  });
  listener({ source: window, data: { type: 'LC_SYNC_SUBMISSION_DETECTED', data: {
    state: 'SUCCESS', status_msg: 'Accepted', status_code: 10,
    _verified_submission_id: '123', _submitted_problem_slug: 'two-sum',
    _extracted_code: 'second approach', _extracted_lang: 'python3',
  } } });
  const opening = timers.find(timer => timer.delay === 800).callback();
  if (!duplicateResult) timers.find(timer => timer.delay === 5000).callback();
  await opening;
  const [topic, subtopic] = elements.filter(element => element.tagName === 'select');
  const save = elements.find(element => element.tagName === 'button' && element.innerHTML.includes('Save Solution'));
  return { elements, topic, subtopic, save, sent, pending, logs,
    answer: async (type, response) => { pending[type](response); await flush(); },
  };
}
const catalog = {
  success: true, topics: [{ name: 'Array' }, { name: 'Graph' }],
  subtopics: [{ topic_name: 'Array', name: 'Hash Map' }, { topic_name: 'Graph', name: 'BFS' }],
};
const saved = { success: true, categorization: { topic: 'Array', subtopic: 'Hash Map' } };

test('saved primary and alternate duplicates never construct the popup or fetch its topics', async () => {
  for (const match of ['primary', 'alternate']) {
    const h = await modalHarness({ duplicateResult: { success: true, duplicate: true, match } });
    assert.equal(h.save, undefined);
    assert.equal(h.elements.some(element => element.textContent === 'Save to LC Sync'), false);
    assert.deepEqual(h.sent.map(message => message.type), ['CHECK_SUBMISSION_DUPLICATE']);
    assert.match(h.logs.join('\n'), /SKIP: identical solution already saved; no popup/);
  }
});

test('failed or timed-out duplicate checks keep the normal save popup available', async () => {
  for (const duplicateResult of [{ success: false }, null]) {
    const h = await modalHarness({ duplicateResult });
    assert.ok(h.save);
    assert.match(h.logs.join('\n'), /Duplicate check unavailable; allowing save popup/);
    await h.answer('FETCH_TOPICS', catalog);
    await h.answer('FETCH_SUBMISSION_CATEGORIZATION', saved);
    assert.equal(h.topic.value, 'Array');
    assert.equal(h.subtopic.value, 'Hash Map');
    assert.equal(h.save.disabled, false);
  }
});

test('navigating away during the duplicate check does not open a stale popup', async () => {
  const h = await modalHarness({ navigateDuringCheck: true });
  assert.equal(h.save, undefined);
  assert.match(h.logs.join('\n'), /problem changed or another popup opened during duplicate check/);
});

test('modal waits for both reads, prefills saved choices, and saves them unchanged', async () => {
  for (const savedFirst of [true, false]) {
    const h = await modalHarness();
    assert.equal(h.topic.disabled, true);
    assert.equal(h.save.disabled, true);
    const first = savedFirst ? 'FETCH_SUBMISSION_CATEGORIZATION' : 'FETCH_TOPICS';
    const second = savedFirst ? 'FETCH_TOPICS' : 'FETCH_SUBMISSION_CATEGORIZATION';
    await h.answer(first, savedFirst ? saved : catalog);
    assert.equal(h.topic.disabled, true);
    await h.answer(second, savedFirst ? catalog : saved);
    assert.equal(h.topic.value, 'Array');
    assert.equal(h.subtopic.value, 'Hash Map');
    assert.equal(h.topic.disabled, false);
    assert.equal(h.subtopic.disabled, false);
    assert.equal(h.save.disabled, false);
    const trace = h.logs.join('\n');
    for (const step of [8, 9, 10, 11, 12]) assert.match(trace, new RegExp('STEP ' + step + '\\]'));
    assert.match(trace, /PASS: popup attached to page/);
    assert.match(trace, /DONE: category selectors and Save enabled/);
    await h.save.fire('click');
    const payload = h.sent.find(message => message.type === 'SAVE_SUBMISSION').payload;
    assert.equal(payload.userTopic, 'Array');
    assert.equal(payload.userSubtopic, 'Hash Map');
    assert.equal(payload.subtopic, 'Hash Map');
  }
});

test('prefilled topic and subtopic remain editable and old subtopics are cleared', async () => {
  const h = await modalHarness();
  await h.answer('FETCH_TOPICS', catalog);
  await h.answer('FETCH_SUBMISSION_CATEGORIZATION', saved);
  h.topic.value = 'Graph';
  await h.topic.fire('change');
  assert.equal(h.subtopic.value, '');
  assert.equal(h.subtopic.children.some(option => option.value === 'Hash Map'), false);
  h.subtopic.value = 'BFS';
  await h.save.fire('click');
  const payload = h.sent.find(message => message.type === 'SAVE_SUBMISSION').payload;
  assert.equal(payload.userTopic, 'Graph');
  assert.equal(payload.subtopic, 'BFS');
});

test('new problems start blank and lookup errors allow manual categorization', async () => {
  for (const response of [{ success: true, categorization: null }, { success: false }]) {
    const h = await modalHarness();
    await h.answer('FETCH_TOPICS', catalog);
    await h.answer('FETCH_SUBMISSION_CATEGORIZATION', response);
    assert.equal(h.topic.value, '');
    assert.equal(h.subtopic.value, '');
    assert.equal(h.topic.disabled, false);
    assert.equal(h.subtopic.disabled, true);
    assert.equal(h.save.disabled, false);
  }
});

test('saved custom choices are available when absent from the catalog or catalog loading fails', async () => {
  for (const response of [catalog, { success: false }]) {
    const h = await modalHarness();
    await h.answer('FETCH_TOPICS', response);
    await h.answer('FETCH_SUBMISSION_CATEGORIZATION', {
      success: true, categorization: { topic: 'Custom Topic', subtopic: 'Custom Pattern' },
    });
    assert.equal(h.topic.value, 'Custom Topic');
    assert.equal(h.subtopic.value, 'Custom Pattern');
  }
});

test('saving after a failed lookup does not clear unknown saved categories', async () => {
  const h = await modalHarness();
  await h.answer('FETCH_TOPICS', catalog);
  await h.answer('FETCH_SUBMISSION_CATEGORIZATION', { success: false });
  await h.save.fire('click');
  const payload = h.sent.find(message => message.type === 'SAVE_SUBMISSION').payload;
  assert.equal(Object.hasOwn(payload, 'userTopic'), false);
  assert.equal(Object.hasOwn(payload, 'subtopic'), false);
});
