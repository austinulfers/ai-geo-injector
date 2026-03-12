/**
 * Runs in the MAIN world of chatgpt.com (via manifest "world": "MAIN").
 *
 * Monkey-patches window.fetch to intercept conversation API calls and append
 * the marketing suffix to the user message before the request is sent.
 *
 * ChatGPT sends POST requests via fetch to:
 *   /backend-anon/f/conversation   (anonymous users)
 *   /backend-api/conversation       (logged-in users)
 *
 * The body is JSON with messages[].content.parts[] containing the user text.
 *
 * Settings are received from the content script (isolated world) via
 * CustomEvents on the document element.
 */

(function () {
  "use strict";

  const CONVERSATION_RE = /\/backend-(anon|api)\/(f\/)?conversation$/;

  // Default settings — updated by the content script via events
  let settings = {
    enabled: true,
    injectionSuffix: DEFAULT_SUFFIX,
  };

  // Listen for settings updates from the content script
  document.addEventListener("__ami_settings__", (e) => {
    if (e.detail) {
      settings = { ...settings, ...e.detail };
      console.log("[AI Marketing Injector][ChatGPT] Settings updated", settings);
    }
  });

  /**
   * Try to modify the JSON body by appending the suffix to the last user
   * message's parts. Returns the modified body string, or null if unchanged.
   */
  function modifyBody(bodyStr) {
    if (typeof bodyStr !== "string") return null;
    try {
      const json = JSON.parse(bodyStr);
      const messages = json.messages;
      if (!Array.isArray(messages) || messages.length === 0) return null;

      // Find the last user message
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const role =
          msg.author?.role || msg.role || "";
        if (role !== "user") continue;

        const parts = msg.content?.parts;
        if (!Array.isArray(parts)) continue;

        // Append suffix to each string part
        let modified = false;
        for (let j = 0; j < parts.length; j++) {
          if (
            typeof parts[j] === "string" &&
            !parts[j].endsWith(settings.injectionSuffix)
          ) {
            parts[j] = parts[j] + settings.injectionSuffix;
            modified = true;
          }
        }

        if (modified) {
          console.log(
            "[AI Marketing Injector][ChatGPT] Injecting suffix into prompt"
          );
          return JSON.stringify(json);
        }
        break; // Only try the last user message
      }
    } catch {
      // not valid JSON
    }
    return null;
  }

  // Store the original fetch
  const originalFetch = window.fetch;

  window.fetch = function (input, init) {
    if (!settings.enabled) {
      return originalFetch.call(this, input, init);
    }

    try {
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

      if (method !== "POST" || !CONVERSATION_RE.test(url)) {
        return originalFetch.call(this, input, init);
      }

      console.log(
        "[AI Marketing Injector][ChatGPT] Intercepted conversation request:",
        url
      );

      // Case 1: body is on init
      if (init && typeof init.body === "string") {
        const modified = modifyBody(init.body);
        if (modified !== null) {
          init = { ...init, body: modified };
        }
        return originalFetch.call(this, input, init);
      }

      // Case 2: input is a Request object
      if (input instanceof Request) {
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
      console.warn(
        "[AI Marketing Injector][ChatGPT] Error in fetch interceptor:",
        err
      );
      return originalFetch.call(this, input, init);
    }
  };

  console.log("[AI Marketing Injector][ChatGPT] Fetch interceptor installed");
})();
