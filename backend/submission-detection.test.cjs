const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const injectSource = readFileSync(require.resolve('./inject.js'), 'utf8');
const contentSource = readFileSync(require.resolve('./content.js'), 'utf8');
const accepted = {
  state: 'SUCCESS', status_code: 10, status_msg: 'Accepted',
  total_correct: 100, total_testcases: 100,
};
const submitPath = '/problems/two-sum/submit/';
const checkPath = (id = 123) => '/submissions/detail/' + id + '/check/';

function harness() {
  const messages = [];
  const logs = [];
  let nextResponse;
  class XHR {
    constructor() { this.listeners = new Map(); this.responseType = ''; }
    open() {}
    send() {}
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(callback);
    }
    get responseText() {
      if (this.responseType !== '' && this.responseType !== 'text') {
        throw new Error("responseText is not accessible for responseType=" + this.responseType);
      }
      return this.serialized;
    }
    respond(data, status = 200, responseOverride) {
      this.status = status;
      this.serialized = JSON.stringify(data);
      if (this.responseType === 'blob') this.response = new Blob([this.serialized], { type: 'application/json' });
      else if (this.responseType === 'arraybuffer') this.response = new TextEncoder().encode(this.serialized).buffer;
      else this.response = this.responseType === 'json' ? data : this.serialized;
      if (responseOverride) this.response = responseOverride;
      const pending = [];
      for (const type of ['load', 'loadend']) {
        const callbacks = this.listeners.get(type) || [];
        this.listeners.delete(type);
        for (const callback of callbacks) pending.push(callback.call(this));
      }
      return Promise.all(pending);
    }
  }
  const window = {
    location: new URL('https://leetcode.com/problems/two-sum/'),
    monaco: { editor: { getModels: () => [{ getValue: () => 'editor code' }] } },
    fetch: async () => nextResponse,
    postMessage: (message) => messages.push(message),
  };
  const clock = { now: Date.now() };
  vm.runInNewContext(injectSource, {
    window, URL, TextDecoder, XMLHttpRequest: XHR, document: { querySelector: () => null },
    Date: { now: () => clock.now },
    console: Object.fromEntries(['info', 'warn', 'log'].map(level => [level, (...args) => logs.push(args)])),
  });
  return {
    window, messages, XHR, logs, clock,
    async fetch(url, data, init = {}, status = 200) {
      nextResponse = new Response(JSON.stringify(data), { status });
      const expected = nextResponse;
      assert.equal(await window.fetch(url, init), expected, 'original response is preserved');
      assert.deepEqual(await expected.json(), JSON.parse(JSON.stringify(data)), 'original response body stays readable');
      await new Promise(setImmediate); // GraphQL detection finishes in the background
    },
    async xhr(url, data, method = 'GET', body, status = 200, responseType = '') {
      const xhr = new XHR();
      xhr.open(method, url);
      xhr.responseType = responseType;
      xhr.send(body);
      await xhr.respond(data, status);
      await new Promise(setImmediate);
    },
  };
}

for (const transport of ['fetch', 'xhr']) {
  async function send(h, url, data, method = 'GET', body) {
    if (transport === 'fetch') return h.fetch(url, data, { method, body });
    return h.xhr(url, data, method, body);
  }
  async function submit(h, id = 123) {
    await send(h, submitPath, { submission_id: id }, 'POST',
      JSON.stringify({ typed_code: 'submitted code', lang: 'python3' }));
  }

  test(transport + ': Run never opens a popup, even with code 10 and all tests passing', async () => {
    for (const total_correct of [1, 100]) {
      const h = harness();
      await send(h, '/problems/two-sum/interpret_solution/', { interpret_id: 123 }, 'POST');
      await send(h, checkPath(), { ...accepted, total_correct });
      assert.equal(h.messages.length, 0);
    }
  });

  test(transport + ': accepted Submit forwards once with the submitted code', async () => {
    const h = harness();
    await submit(h);
    await send(h, checkPath(), { state: 'PENDING' });
    await send(h, checkPath(), { ...accepted, state: 'STARTED' });
    assert.equal(h.messages.length, 0);
    await send(h, checkPath(), accepted);
    await send(h, checkPath(), accepted);
    assert.equal(h.messages.length, 1);
    assert.equal(h.messages[0].data._verified_submission_id, '123');
    assert.equal(h.messages[0].data._extracted_code, 'submitted code');
    assert.equal(h.messages[0].data._extracted_lang, 'python3');
    await submit(h, 124);
    await send(h, checkPath(124), accepted);
    assert.equal(h.messages.length, 2, 'a later accepted submission is allowed');
  });

  test(transport + ': failed, partial, conflicting and incomplete verdicts never forward', async () => {
    const invalid = [
      { ...accepted, total_correct: 3 },
      { ...accepted, status_msg: 'Wrong Answer' },
      { ...accepted, status_code: 11 },
      { ...accepted, status_code: 14, status_msg: 'Time Limit Exceeded' },
      { ...accepted, status_code: 15, status_msg: 'Runtime Error' },
      { ...accepted, status_code: 20, status_msg: 'Compile Error' },
      { ...accepted, total_testcases: 0, total_correct: 0 },
      { ...accepted, total_correct: undefined },
      { ...accepted, total_testcases: undefined },
      { ...accepted, submission_id: 999 },
      { state: 'SUCCESS', total_correct: 100, total_testcases: 100 },
    ];
    for (const verdict of invalid) {
      const h = harness();
      await submit(h);
      await send(h, checkPath(), verdict);
      assert.equal(h.messages.length, 0, JSON.stringify(verdict));
    }
  });

  test(transport + ': history and checks unrelated to the latest Submit are ignored', async () => {
    const h = harness();
    await send(h, checkPath(), accepted);
    await send(h, '/graphql/', { data: { submissionDetails: { statusDisplay: 'Accepted' } } },
      'POST', JSON.stringify({ operationName: 'submissionDetails', variables: { submissionId: 123 } }));
    await submit(h);
    await send(h, checkPath(999), accepted);
    await submit(h, 124);
    await send(h, checkPath(), accepted);
    assert.equal(h.messages.length, 0);
    await send(h, checkPath(124), accepted);
    assert.equal(h.messages.length, 1);
  });

  const graphqlBody = (id = 123) => JSON.stringify({ operationName: 'submissionDetails', variables: { submissionId: id } });
  const graphqlAccepted = (id = 123) => ({ data: { submissionDetails: { id, statusDisplay: 'Accepted' } } });
  const inspectedGraphQL = (h) => h.logs.filter(args => args[0] === '[LC Sync] GraphQL response:').length;

  test(transport + ': a final failed check ends tracking, so later GraphQL traffic is not inspected', async () => {
    for (const verdict of [
      { status_code: 11, status_msg: 'Wrong Answer' },
      { status_code: 14, status_msg: 'Time Limit Exceeded' },
      { status_code: 20, status_msg: 'Compile Error' },
    ]) {
      const h = harness();
      await submit(h);
      await send(h, checkPath(), { state: 'SUCCESS', ...verdict, total_correct: 1, total_testcases: 100 });
      assert.match(h.logs.map(args => args.join(' ')).join('\n'), /STOP: final verdict is not Accepted.*tracking ended/);
      await send(h, '/graphql/', graphqlAccepted(), 'POST', graphqlBody());
      await send(h, checkPath(), accepted);
      assert.equal(h.messages.length, 0);
      assert.equal(inspectedGraphQL(h), 0, 'GraphQL responses are no longer read');
      await submit(h, 124);
      await send(h, checkPath(124), accepted);
      assert.equal(h.messages.length, 1, 'the next Submit is tracked normally');
    }
  });

  test(transport + ': a failed verdict without a completed state keeps tracking', async () => {
    const h = harness();
    await submit(h);
    await send(h, checkPath(), { status_code: 11, status_msg: 'Wrong Answer' });
    await send(h, checkPath(), accepted);
    assert.equal(h.messages.length, 1);
  });

  test(transport + ': tracking stops when no final verdict arrives within the time limit', async () => {
    const h = harness();
    await submit(h);
    h.clock.now += 5 * 60 * 1000;
    await send(h, '/graphql/', { data: { submissionDetails: { id: 123, statusCode: 16 } } }, 'POST', graphqlBody());
    assert.equal(inspectedGraphQL(h), 1, 'still tracked at exactly the limit');
    h.clock.now += 1;
    await send(h, '/graphql/', graphqlAccepted(), 'POST', graphqlBody());
    await send(h, checkPath(), accepted);
    assert.equal(h.messages.length, 0);
    assert.equal(inspectedGraphQL(h), 1, 'expired submission is no longer inspected');
    assert.match(h.logs.map(args => args.join(' ')).join('\n'), /STOP: no final verdict within the time limit/);
    await submit(h, 124);
    await send(h, checkPath(124), accepted);
    assert.equal(h.messages.length, 1);
  });

  test(transport + ': Run cancels an outstanding Submit and navigation ignores its result', async () => {
    const h = harness();
    await submit(h);
    await send(h, '/problems/two-sum/interpret_solution/', { interpret_id: 999 }, 'POST');
    await send(h, checkPath(), accepted);
    assert.equal(h.messages.length, 0);
    await submit(h);
    h.window.location = new URL('https://leetcode.com/problems/add-two-numbers/');
    await send(h, checkPath(), accepted);
    assert.equal(h.messages.length, 0);
  });
}

test('fetch supports Request bodies and URL objects', async () => {
  const h = harness();
  await h.fetch(new Request('https://leetcode.com' + submitPath, {
    method: 'POST', body: JSON.stringify({ typed_code: 'request code', lang: 'cpp' }),
  }), { submission_id: 123 });
  await h.fetch(new URL('https://leetcode.com' + checkPath()), accepted);
  assert.equal(h.messages.length, 1);
  assert.equal(h.messages[0].data._extracted_code, 'request code');
  assert.equal(h.messages[0].data._extracted_lang, 'cpp');
});

test('HTTP errors cannot register a submission or produce acceptance', async () => {
  for (const transport of ['fetch', 'xhr']) {
    const h = harness();
    const send = (url, data, method, status) => transport === 'fetch'
      ? h.fetch(url, data, { method }, status)
      : h.xhr(url, data, method, undefined, status);
    await send(submitPath, { submission_id: 123 }, 'POST', 500);
    await send(checkPath(), accepted, 'GET', 200);
    assert.equal(h.messages.length, 0);
    await send(submitPath, { submission_id: 123 }, 'POST', 200);
    await send(checkPath(), accepted, 'GET', 500);
    assert.equal(h.messages.length, 0);
  }
});

test('XHR supports JSON responses', async () => {
  const h = harness();
  await h.xhr(submitPath, { submission_id: 123 }, 'POST', undefined, 200, 'json');
  await h.xhr(checkPath(), accepted, 'GET', undefined, 200, 'json');
  assert.equal(h.messages.length, 1);
});

for (const responseType of ['blob', 'arraybuffer', 'text']) {
  test('XHR parses ' + responseType + ' Submit and check responses without accessing responseText for binary data', async () => {
    const h = harness();
    await h.xhr(submitPath, { submission_id: 123 }, 'POST', undefined, 200, responseType);
    await h.xhr(checkPath(), { state: 'PENDING' }, 'GET', undefined, 200, responseType);
    assert.equal(h.messages.length, 0);
    await h.xhr(checkPath(), accepted, 'GET', undefined, 200, responseType);
    assert.equal(h.messages.length, 1);
    assert.equal(h.logs.some(args => args.some(arg => String(arg).includes('parse failed'))), false);
  });

  test('XHR parses ' + responseType + ' GraphQL accepted results and still rejects wrong answers', async () => {
    for (const verdict of ['Accepted', 'Wrong Answer']) {
      const h = harness();
      await h.xhr(submitPath, { submission_id: 123 }, 'POST');
      await h.xhr('/graphql/', { data: { submissionDetails: {
        id: 123, statusDisplay: verdict, runtimeDisplay: '1 ms',
      } } }, 'POST', JSON.stringify({ operationName: 'submissionDetails', variables: { submissionId: 123 } }), 200, responseType);
      assert.equal(h.messages.length, verdict === 'Accepted' ? 1 : 0);
      if (verdict === 'Accepted') assert.equal(h.messages[0].data._extracted_runtime, '1 ms');
    }
  });
}

for (const transport of ['fetch', 'xhr']) {
  test(transport + ': a tracked accepted verdict can omit the polling state', async () => {
    const h = harness();
    if (transport === 'fetch') {
      await h.fetch(submitPath, { submission_id: 123 }, { method: 'POST' });
      await h.fetch(checkPath(), { ...accepted, state: undefined });
    } else {
      await h.xhr(submitPath, { submission_id: 123 }, 'POST');
      await h.xhr(checkPath(), { ...accepted, state: undefined });
    }
    assert.equal(h.messages.length, 1);
    assert.equal(h.messages[0].data.state, 'SUCCESS');
  });

  test(transport + ': GraphQL details for the new Submit ID open the popup once', async () => {
    const h = harness();
    const query = JSON.stringify({
      operationName: 'submissionDetails', variables: { submissionId: 123 },
      query: 'query submissionDetails($submissionId: Int!) { submissionDetails(submissionId: $submissionId) { id statusDisplay code } }',
    });
    const details = { data: { submissionDetails: {
      id: 123, statusDisplay: 'Accepted', code: 'accepted code', lang: { name: 'Python3' },
      runtimeDisplay: '1 ms', memoryDisplay: '10 MB',
    } } };
    if (transport === 'fetch') {
      await h.fetch(submitPath, { submission_id: 123 }, { method: 'POST' });
      await h.fetch('/graphql/', details, { method: 'POST', body: query });
      await h.fetch(checkPath(), accepted);
    } else {
      await h.xhr(submitPath, { submission_id: 123 }, 'POST');
      await h.xhr('/graphql/', details, 'POST', query);
      await h.xhr(checkPath(), accepted);
    }
    assert.equal(h.messages.length, 1);
    assert.equal(h.messages[0].data._verified_submission_id, '123');
    assert.equal(h.messages[0].data._extracted_runtime, '1 ms');
    assert.equal(h.messages[0].data._extracted_lang, 'Python3');
  });
}

test('GraphQL statusCode-only Blob result reaches the popup after submission-page navigation', async () => {
  for (const statusCode of [10, '10']) {
    const h = harness();
    const timers = [];
    let listener;
    h.window.addEventListener = (type, callback) => { if (type === 'message') listener = callback; };
    const postMessage = h.window.postMessage;
    h.window.postMessage = (message) => {
      postMessage(message);
      listener({ source: h.window, data: message });
    };
    vm.runInNewContext(contentSource, {
      window: h.window, document: { body: {} }, console: { log() {} },
      MutationObserver: class { observe() {} },
      setTimeout: (callback, delay) => timers.push({ callback, delay }),
    });
    await h.fetch(submitPath, { submission_id: 2194717030 }, { method: 'POST' });
    h.window.location = new URL('https://leetcode.com/problems/two-sum/submissions/2194717030/');
    // Matches the user's observed fields: no id, statusDisplay, or state.
    const response = { data: { submissionDetails: {
      statusCode, totalCorrect: 100, totalTestcases: 100,
      runtimeDisplay: '1 ms', memoryDisplay: '10 MB',
      lang: { name: 'Python3' }, code: 'accepted code',
      runtimeError: null, compileError: null,
    } } };
    const query = JSON.stringify({ operationName: 'submissionDetails', variables: { submissionId: '2194717030' } });
    await h.xhr('/graphql/', response, 'POST', query, 200, 'blob');
    await h.xhr('/graphql/', response, 'POST', query, 200, 'blob');
    assert.equal(h.messages.length, 1);
    assert.equal(h.messages[0].data.status_code, statusCode);
    assert.equal(timers.length, 1, 'content script must schedule the popup exactly once');
    assert.equal(timers[0].delay, 800);
  }
});

test('GraphQL statusCode-only results reject failures, partial passes, and untracked history', async () => {
  for (const details of [
    { statusCode: 11, totalCorrect: 1, totalTestcases: 100 },
    { statusCode: 14 }, { statusCode: 15 }, { statusCode: 20 },
    { statusCode: 10, totalCorrect: 99, totalTestcases: 100 },
    { statusCode: 11, statusDisplay: 'Accepted' },
  ]) {
    const h = harness();
    await h.fetch(submitPath, { submission_id: 123 }, { method: 'POST' });
    await h.xhr('/graphql/', { data: { submissionDetails: details } }, 'POST',
      JSON.stringify({ variables: { submissionId: '123' } }), 200, 'blob');
    assert.equal(h.messages.length, 0, JSON.stringify(details));
  }
  const h = harness();
  await h.xhr('/graphql/', { data: { submissionDetails: { statusCode: 10 } } }, 'POST',
    JSON.stringify({ variables: { submissionId: '123' } }), 200, 'blob');
  assert.equal(h.messages.length, 0);
});

test('observed statusCode 16 with zero tests remains tracked until a later Accepted update', async () => {
  const h = harness();
  await h.fetch(submitPath, { submission_id: 2194724891 }, { method: 'POST' });
  const body = JSON.stringify({ operationName: 'submissionDetails', variables: { submissionId: '2194724891' } });
  await h.xhr('/graphql/', { data: { submissionDetails: { statusCode: 16, totalTestcases: 0 } } }, 'POST', body, 200, 'blob');
  assert.equal(h.messages.length, 0, 'status 16 alone must not open the popup');
  const trace = h.logs.map(args => args.join(' ')).join('\n');
  for (const step of [1, 2, 3, 4, 5, 6]) assert.match(trace, new RegExp('STEP ' + step + '\\]'));
  assert.match(trace, /"statusCode":16/);
  assert.match(trace, /"passed":null,"total":0/);
  assert.match(trace, /still tracking later updates/);
  await h.xhr('/graphql/', { data: { submissionDetails: { statusCode: 10, totalCorrect: 100, totalTestcases: 100 } } }, 'POST', body, 200, 'blob');
  assert.equal(h.messages.length, 1, 'later acceptance must reach the content script');
  assert.match(h.logs.map(args => args.join(' ')).join('\n'), /STEP 7\] Posting accepted/);
  await h.xhr('/graphql/', { data: { submissionDetails: { statusCode: 10 } } }, 'POST', body, 200, 'blob');
  assert.equal(h.messages.length, 1, 'duplicate acceptance must not trigger again');
});

test('new Submit cancels an earlier unresolved status-16 submission', async () => {
  const h = harness();
  await h.fetch(submitPath, { submission_id: 123 }, { method: 'POST' });
  const response = (statusCode) => ({ data: { submissionDetails: { statusCode } } });
  const body = (id) => JSON.stringify({ variables: { submissionId: id } });
  await h.xhr('/graphql/', response(16), 'POST', body(123), 200, 'blob');
  await h.fetch(submitPath, { submission_id: 124 }, { method: 'POST' });
  await h.xhr('/graphql/', response(10), 'POST', body(123), 200, 'blob');
  assert.equal(h.messages.length, 0);
  await h.xhr('/graphql/', response(10), 'POST', body(124), 200, 'blob');
  assert.equal(h.messages.length, 1);
});

test('language display names remain compatible with existing saved submissions', async () => {
  const h = harness();
  await h.fetch(submitPath, { submission_id: 123 }, {
    method: 'POST', body: JSON.stringify({ typed_code: 'code', lang: 'python3' }),
  });
  await h.fetch(checkPath(), { ...accepted, pretty_lang: 'Python3' });
  assert.equal(h.messages[0].data._extracted_lang, 'Python3');
});

test('an immediate first check started by a page XHR handler is not dropped', async () => {
  const h = harness();
  const submission = new h.XHR();
  submission.open('POST', submitPath);
  // Page listeners are registered before the interceptor's send() listener.
  submission.addEventListener('load', () => {
    const check = new h.XHR();
    check.open('GET', checkPath());
    check.send();
    check.respond(accepted);
  });
  submission.send();
  submission.respond({ submission_id: 123 });
  await new Promise(setImmediate);
  assert.equal(h.messages.length, 1);
});

test('fetched GraphQL responses reach the page before the Submit ID is known', { timeout: 2000 }, async () => {
  const h = harness();
  const submission = new h.XHR();
  submission.open('POST', submitPath);
  submission.send(); // Submit sent; its response (and ID) has not arrived yet
  // This used to wait for the Submit response before returning to the page.
  await h.fetch('/graphql/', { data: { submissionDetails: { id: 123, statusDisplay: 'Accepted' } } },
    { method: 'POST', body: JSON.stringify({ variables: { submissionId: 123 } }) });
  assert.equal(h.messages.length, 0);
  await submission.respond({ submission_id: 123 });
  await new Promise(setImmediate);
  assert.equal(h.messages.length, 1, 'detection still completes once the ID arrives');
});

test('loadend does not release a Submit ID before asynchronous Blob decoding finishes', async () => {
  const h = harness();
  const submission = new h.XHR();
  submission.open('POST', submitPath);
  submission.responseType = 'blob';
  submission.send();
  let finishDecoding;
  const decodedText = new Promise(resolve => { finishDecoding = resolve; });
  const submitting = submission.respond({ submission_id: 123 }, 200, { text: () => decodedText });
  const checking = h.xhr(checkPath(), accepted, 'GET', undefined, 200, 'blob');
  await new Promise(setImmediate);
  assert.equal(h.messages.length, 0);
  finishDecoding(JSON.stringify({ submission_id: 123 }));
  await Promise.all([submitting, checking]);
  assert.equal(h.messages.length, 1);
});

test('a malformed Blob is logged without preventing a later valid submission', async () => {
  const h = harness();
  const submission = new h.XHR();
  submission.open('POST', submitPath);
  submission.responseType = 'blob';
  submission.send();
  await submission.respond({}, 200, new Blob(['not JSON']));
  assert.equal(h.messages.length, 0);
  assert.equal(h.logs.some(args => args[0] === '[LC Sync] XHR detection failed:'), true);
  await h.xhr(submitPath, { submission_id: 124 }, 'POST', undefined, 200, 'blob');
  await h.xhr(checkPath(124), accepted, 'GET', undefined, 200, 'blob');
  assert.equal(h.messages.length, 1);
});

test('GraphQL cannot accept an unrelated, failed, pending, or partial submission', async () => {
  const cases = [
    { id: 999, statusDisplay: 'Accepted' },
    { id: 123, statusDisplay: 'Wrong Answer', status: 10 },
    { id: 123, statusDisplay: 'Accepted', state: 'PENDING' },
    { id: 123, statusDisplay: 'Accepted', totalCorrect: 1, totalTestcases: 10 },
    { id: 123, status: 'ac' },
  ];
  for (const details of cases) {
    const h = harness();
    await h.fetch(submitPath, { submission_id: 123 }, { method: 'POST' });
    await h.fetch('/graphql/', { data: { submissionDetails: details } }, {
      method: 'POST', body: JSON.stringify({ variables: { submissionId: details.id } }),
    });
    assert.equal(h.messages.length, 0, JSON.stringify(details));
  }
});

test('content only schedules the popup for verified acceptance and deduplicates it', () => {
  const timers = [];
  let listener;
  const window = {
    location: new URL('https://leetcode.com/problems/two-sum/'),
    addEventListener: (type, callback) => { if (type === 'message') listener = callback; },
  };
  vm.runInNewContext(contentSource, {
    window, document: { body: {} }, console: { log() {} },
    MutationObserver: class { observe() {} },
    setTimeout: (callback) => { timers.push(callback); },
  });
  const deliver = (data) => listener({
    source: window, data: { type: 'LC_SYNC_SUBMISSION_DETECTED', data },
  });
  const verified = { ...accepted, _verified_submission_id: '123', _submitted_problem_slug: 'two-sum' };
  deliver(accepted);
  deliver({ ...verified, state: 'STARTED' });
  deliver({ ...verified, total_correct: 3 });
  deliver({ ...verified, status_msg: 'Wrong Answer' });
  deliver({ ...verified, status_code: 11 });
  deliver({ ...verified, _submitted_problem_slug: 'another-problem' });
  assert.equal(timers.length, 0);
  deliver(verified);
  deliver(verified);
  assert.equal(timers.length, 1);
  // Navigation during the DOM update delay must cancel the queued popup.
  window.location = new URL('https://leetcode.com/problems/add-two-numbers/');
  timers[0](); // Would access the unstubbed DOM if the popup were opened.
});
