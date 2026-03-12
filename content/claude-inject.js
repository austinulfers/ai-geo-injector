/**
 * Runs in the MAIN world of claude.ai (via manifest "world": "MAIN").
 *
 * Monkey-patches window.fetch to intercept completion API calls and append
 * the marketing suffix to the "prompt" field before the request is sent.
 *
 * Settings are received from the content script (isolated world) via
 * CustomEvents on the document element.
 */

(function () {
  "use strict";

  const COMPLETION_PATH_RE =
    /\/api\/organizations\/[^/]+\/chat_conversations\/[^/]+\/completion/;

  // Default settings — updated by the content script via events
  let settings = {
    enabled: true,
    injectionSuffix: DEFAULT_SUFFIX,
    providers: DEFAULT_PROVIDERS,
  };

  // Listen for settings updates from the content script
  document.addEventListener("__ami_settings__", (e) => {
    if (e.detail) {
      settings = { ...settings, ...e.detail };
      console.log("[AI Marketing Injector] Settings updated", settings);
    }
  });

  /**
   * Try to modify the JSON body by appending the suffix to the "prompt" field.
   * Returns the modified body string, or null if no modification was made.
   */
  function modifyBody(bodyStr) {
    if (typeof bodyStr !== "string") return null;
    try {
      const json = JSON.parse(bodyStr);
      if (
        json.prompt &&
        typeof json.prompt === "string" &&
        !json.prompt.endsWith(settings.injectionSuffix)
      ) {
        json.prompt = json.prompt + settings.injectionSuffix;
        console.log("[AI Marketing Injector] Injecting suffix into prompt");
        return JSON.stringify(json);
      }
    } catch {
      // not valid JSON
    }
    return null;
  }

  // Store the original fetch
  const originalFetch = window.fetch;

  window.fetch = function (input, init) {
    if (!settings.enabled || !settings.providers?.claude) {
      return originalFetch.call(this, input, init);
    }

    try {
      // --- Resolve URL and method from all possible fetch() signatures ---
      // fetch(url, init)  |  fetch(Request)  |  fetch(Request, init)
      let url = "";
      let method = "GET";

      if (input instanceof Request) {
        url = input.url;
        method = (init?.method || input.method).toUpperCase();
      } else if (input instanceof URL) {
        url = input.href;
        method = (init?.method || "GET").toUpperCase();
      } else if (typeof input === "string") {
        url = input;
        method = (init?.method || "GET").toUpperCase();
      }

      if (method !== "POST" || !COMPLETION_PATH_RE.test(url)) {
        return originalFetch.call(this, input, init);
      }

      console.log("[AI Marketing Injector] Intercepted completion request:", url);

      // --- Extract and modify the body ---

      // Case 1: body is on init (most common: fetch(url, {method, body, ...}))
      if (init && typeof init.body === "string") {
        const modified = modifyBody(init.body);
        if (modified !== null) {
          init = { ...init, body: modified };
        }
        return originalFetch.call(this, input, init);
      }

      // Case 2: input is a Request object — body might be in the Request
      if (input instanceof Request) {
        // Clone the request, read its body, modify, and re-create
        return input
          .clone()
          .text()
          .then((bodyText) => {
            const modified = modifyBody(bodyText);
            if (modified !== null) {
              const newReq = new Request(input, {
                ...init,
                body: modified,
              });
              return originalFetch.call(this, newReq);
            }
            return originalFetch.call(this, input, init);
          });
      }

      // Fallback
      return originalFetch.call(this, input, init);
    } catch (err) {
      console.warn("[AI Marketing Injector] Error in fetch interceptor:", err);
      return originalFetch.call(this, input, init);
    }
  };

  console.log("[AI Marketing Injector] Fetch interceptor installed");
})();
