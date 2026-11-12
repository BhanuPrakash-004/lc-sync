(function () {
  "use strict";

  // Run and Submit share the check endpoint. Only a check for an ID returned
  // by a new Submit request is eligible to open the save modal.
  let activeSubmission = null;
  function trace(step, event, details = {}) {
    console.info(`[LC Sync][STEP ${step}] ${event} ${JSON.stringify(details)}`);
  }
  trace(0, "Network detector ready", { version: "1.0.1" });

  function getEditorCode() {
    try {
      const editor = window.monaco?.editor;
      const model = editor?.getModels()[0];
      if (model) return model.getValue();
      const instance = editor?.getEditors?.()[0];
      if (instance) return instance.getValue();
      return (
        document.querySelector(".CodeMirror")?.CodeMirror?.getValue() || null
      );
    } catch (_) {
      return null;
    }
  }

  function problemSlug() {
    return window.location.pathname.match(/^\/problems\/([^/]+)/)?.[1] || null;
  }

  function parseBody(body) {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  // responseText throws for binary XHR responses. LeetCode also sends its
  // GraphQL JSON as a Blob, so decode the selected transport format first.
  async function readXHRResponse(xhr) {
    switch (xhr.responseType) {
      case "json":
        return xhr.response;
      case "blob":
        return JSON.parse(await xhr.response.text());
      case "arraybuffer":
        return JSON.parse(new TextDecoder().decode(xhr.response));
      case "":
      case "text":
        return JSON.parse(xhr.responseText);
      default:
        throw new Error(`Unsupported XHR response type: ${xhr.responseType}`);
    }
  }

  function trackRequest(input, method, body) {
    const url = new URL(input, window.location.href);
    if (url.origin !== window.location.origin) return null;

    const submit = url.pathname.match(/^\/problems\/([^/]+)\/submit\/?$/);
    if (method.toUpperCase() === "POST" && submit) {
      activeSubmission?.resolveReady();
      let resolveReady;
      const submission = {
        id: null,
        slug: submit[1],
        code: getEditorCode(),
        body: Promise.resolve(body)
          .then(parseBody)
          .catch(() => ({})),
        ready: new Promise((resolve) => {
          resolveReady = resolve;
        }),
      };
      submission.resolveReady = resolveReady;
      activeSubmission = submission;
      trace(1, "Submit request detected", { slug: submission.slug });
      return { kind: "submit", submission };
    }

    if (
      method.toUpperCase() === "POST" &&
      /\/interpret_solution\/?$/.test(url.pathname)
    ) {
      trace(1, "Run detected; popup tracking cancelled");
      activeSubmission?.resolveReady();
      activeSubmission = null;
    }

    const check = url.pathname.match(
      /^\/submissions\/detail\/(\d+)\/check\/?$/,
    );
    if (
      check &&
      activeSubmission &&
      (!activeSubmission.id || activeSubmission.id === check[1])
    ) {
      return { kind: "check", id: check[1], submission: activeSubmission };
    }
    if (/^\/graphql\/?$/.test(url.pathname) && activeSubmission) {
      return {
        kind: "graphql",
        body: Promise.resolve(body)
          .then(parseBody)
          .catch(() => ({})),
        submission: activeSubmission,
      };
    }
    // Untracked checks and history are not new submissions.
    return null;
  }

  async function handleResponse(request, data) {
    if (!request || !data || typeof data !== "object") return;
    const submission = request.submission;
    if (submission !== activeSubmission) return;

    if (request.kind === "submit") {
      const id = String(data.submission_id ?? data.submissionId ?? "");
      if (/^\d+$/.test(id)) submission.id = id;
      submission.resolveReady();
      trace(
        2,
        submission.id ? "Submit ID received" : "STOP: Submit ID missing",
        { id: submission.id },
      );
      return;
    }

    // An XHR page handler can start the first poll before our Submit load
    // handler runs. Wait for that handler instead of dropping the first poll.
    let graphqlQuery;
    if (request.kind === "graphql") {
      graphqlQuery = await request.body;
      console.info(
        "[LC Sync] GraphQL response:",
        JSON.stringify({
          operation: graphqlQuery.operationName || "(unnamed)",
          submissionId:
            graphqlQuery.variables?.submissionId ??
            graphqlQuery.variables?.submission_id ??
            null,
          fields: Object.keys(data.data || {}),
          errorCount: Array.isArray(data.errors) ? data.errors.length : 0,
        }),
      );
      if (!data.data?.submissionDetails && !data.data?.submissionResult) return;
    }
    await submission.ready;
    if (submission !== activeSubmission || !submission.id) return;
    if (request.kind === "check" && request.id !== submission.id) return;
    trace(3, "Submission result decoded", {
      id: submission.id,
      source: request.kind,
    });

    if (request.kind === "graphql") {
      const query = graphqlQuery;
      const details =
        data.data?.submissionDetails || data.data?.submissionResult;
      if (!details) return;
      const id =
        query.variables?.submissionId ??
        query.variables?.submission_id ??
        details.id;
      if (
        String(id) !== submission.id ||
        (details.id != null && String(details.id) !== submission.id)
      ) {
        console.info(
          "[LC Sync] Ignoring GraphQL result for a different submission.",
        );
        return;
      }
      // LeetCode submissionDetails uses camelCase statusCode and can omit
      // statusDisplay entirely. Normalize it to the REST verdict field.
      const statusCode =
        details.statusCode ??
        details.status_code ??
        (/^\d+$/.test(String(details.status)) ? details.status : undefined);
      data = {
        ...details,
        status_msg: details.statusDisplay ?? details.status_msg,
        status_code: statusCode,
        total_correct: details.totalCorrect ?? details.total_correct,
        total_testcases: details.totalTestcases ?? details.total_testcases,
        status_runtime: details.runtimeDisplay ?? details.runtime,
        status_memory: details.memoryDisplay ?? details.memory,
        pretty_lang:
          details.lang?.name ||
          details.langName ||
          (typeof details.lang === "string" ? details.lang : null),
      };
    }
    trace(4, "Result matched to current Submit", {
      id: submission.id,
      source: request.kind,
    });

    // A successful execution (status_code=10) alone does not mean that all
    // tests passed. Require a final verdict and reject conflicting evidence.
    if (submission !== activeSubmission) return;
    trace(5, "Verdict fields received", {
      id: submission.id,
      source: request.kind,
      state: data.state ?? null,
      statusText: data.status_msg ?? null,
      statusCode: data.status_code ?? null,
      statusCodeType: typeof data.status_code,
      passed: data.total_correct ?? null,
      total: data.total_testcases ?? null,
      hasRuntimeError: Boolean(data.runtimeError || data.runtime_error),
      hasCompileError: Boolean(data.compileError || data.compile_error),
    });
    if (
      (data.state && data.state !== "SUCCESS") ||
      /^(pending|started|judging)$/i.test(data.status_msg || "")
    ) {
      trace(6, "WAIT: judging has not completed; still tracking", {
        id: submission.id,
      });
      return;
    }
    // Some final responses (notably GraphQL) have a verdict but no state.
    // An empty/intermediate response must not consume the tracked submission.
    if (!data.status_msg && data.status_code == null) {
      trace(6, "WAIT: no verdict yet; still tracking", {
        id: submission.id,
        fields: Object.keys(data),
      });
      return;
    }
    const hasAcceptedVerdict =
      data.status_msg === "Accepted" || String(data.status_code) === "10";
    if (
      !hasAcceptedVerdict ||
      (data.status_msg != null && data.status_msg !== "Accepted") ||
      (data.status_code != null && String(data.status_code) !== "10")
    ) {
      trace(
        6,
        "WAIT: no Accepted verdict; popup withheld, still tracking later updates",
        {
          id: submission.id,
          receivedStatusCode: data.status_code ?? null,
          acceptedStatusCode: 10,
        },
      );
      return;
    }
    if (
      data.submission_id != null &&
      String(data.submission_id) !== submission.id
    ) {
      trace(6, "STOP: response submission ID does not match", {
        id: submission.id,
      });
      return;
    }

    if (data.total_correct != null || data.total_testcases != null) {
      const correct = Number(data.total_correct);
      const total = Number(data.total_testcases);
      if (!Number.isInteger(total) || total <= 0 || correct !== total) {
        trace(
          6,
          "WAIT: test counts incomplete or not all passed; still tracking",
          { id: submission.id, passed: correct, total },
        );
        return;
      }
    }
    if (problemSlug() !== submission.slug) {
      trace(6, "STOP: current problem changed", { id: submission.id });
      return;
    }

    trace(6, "PASS: accepted verdict and test-count checks passed", {
      id: submission.id,
    });
    const body = await submission.body;
    if (submission !== activeSubmission || problemSlug() !== submission.slug)
      return;
    // Only consume the submission after acceptance. A first details response
    // can have an unresolved/non-accepted verdict and be updated later.
    activeSubmission = null;
    trace(7, "Posting accepted submission to content script", {
      id: submission.id,
    });
    window.postMessage(
      {
        type: "LC_SYNC_SUBMISSION_DETECTED",
        data: {
          ...data,
          state: "SUCCESS",
          _verified_submission_id: submission.id,
          _submitted_problem_slug: submission.slug,
          _extracted_code: body.typed_code ?? data.code ?? submission.code,
          _extracted_lang:
            data.pretty_lang ||
            data.lang_name ||
            body.lang ||
            data.lang ||
            null,
          _extracted_runtime: data.status_runtime || null,
          _extracted_memory: data.status_memory || null,
        },
      },
      window.location.origin,
    );
  }

  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    let request = null;
    try {
      const url =
        typeof input === "string" || input instanceof URL
          ? String(input)
          : input.url;
      const method = init?.method || input?.method || "GET";
      request = trackRequest(url, method, init?.body);
      // Read only submission bodies, using a clone to leave the request intact.
      if (
        (request?.kind === "submit" || request?.kind === "graphql") &&
        init?.body == null &&
        typeof input?.clone === "function"
      ) {
        const body = input
          .clone()
          .text()
          .then(parseBody)
          .catch(() => ({}));
        if (request.kind === "submit") request.submission.body = body;
        else request.body = body;
      }
    } catch (error) {
      console.warn("[LC Sync] Request tracking failed:", error.message);
    }

    let response;
    try {
      response = await originalFetch.apply(this, arguments);
    } catch (error) {
      if (request?.kind === "submit") request.submission.resolveReady();
      throw error;
    }
    if (request) {
      try {
        // Register the submit ID before returning its response to the caller,
        // so even an immediate first poll can be correlated correctly.
        if (response.ok)
          await handleResponse(request, await response.clone().json());
      } catch (error) {
        console.warn("[LC Sync] Response detection failed:", error.message);
      } finally {
        if (request.kind === "submit") request.submission.resolveReady();
      }
    }
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._lcMethod = method;
    this._lcUrl = url;
    return originalOpen.apply(this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.send = function (body) {
    let request = null;
    try {
      request = trackRequest(this._lcUrl, this._lcMethod, body);
    } catch (_) {}
    if (request) {
      this.addEventListener(
        "load",
        async function () {
          try {
            console.info(
              "[LC Sync] XHR response:",
              JSON.stringify({
                source: request.kind,
                status: this.status,
                responseType: this.responseType || "text",
              }),
            );
            if (this.status < 200 || this.status >= 300) return;
            const data = await readXHRResponse(this);
            await handleResponse(request, data);
          } catch (error) {
            console.warn(
              "[LC Sync] XHR detection failed:",
              request.kind,
              error.message,
            );
          } finally {
            if (request.kind === "submit") request.submission.resolveReady();
          }
        },
        { once: true },
      );
      if (request.kind === "submit") {
        // loadend fires before asynchronous Blob decoding finishes. Only
        // release a successful Submit after its ID has been decoded above.
        for (const event of ["error", "abort", "timeout"]) {
          this.addEventListener(
            event,
            () => request.submission.resolveReady(),
            { once: true },
          );
        }
      }
    }
    return originalSend.apply(this, arguments);
  };
})();
