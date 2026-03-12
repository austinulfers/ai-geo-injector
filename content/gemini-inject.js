/**
 * Runs in the MAIN world of gemini.google.com (via manifest "world": "MAIN").
 *
 * Monkey-patches XMLHttpRequest to intercept StreamGenerate API calls and
 * append the GEO suffix to the user message before the request is sent.
 *
 * Gemini uses XHR (not fetch) to POST to:
 *   /_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate
 *
 * The body is URL-encoded form data with an `f.req` parameter containing
 * nested JSON:  f.req = [null, "<stringified array>"]
 * The user message lives at: inner[0][0]
 *
 * Settings are received from the content script (isolated world) via
 * CustomEvents on the document element.
 */

(function () {
  "use strict";

  const STREAM_GENERATE_RE =
    /\/BardChatUi\/data\/assistant\.lamda\.BardFrontendService\/StreamGenerate/;

  // Default settings — updated by the content script via events
  let settings = {
    enabled: true,
    injectionSuffix: DEFAULT_SUFFIX,
  };

  // Listen for settings updates from the content script
  document.addEventListener("__ami_settings__", (e) => {
    if (e.detail) {
      settings = { ...settings, ...e.detail };
      console.log("[AI GEO Injector][Gemini] Settings updated", settings);
    }
  });

  /**
   * Try to modify the URL-encoded form body by appending the suffix to the
   * user message inside the f.req parameter.
   * Returns the modified body string, or null if no modification was made.
   */
  function modifyBody(bodyStr) {
    if (typeof bodyStr !== "string") return null;
    try {
      const params = new URLSearchParams(bodyStr);
      const fReq = params.get("f.req");
      if (!fReq) return null;

      const outer = JSON.parse(fReq);
      if (!Array.isArray(outer) || typeof outer[1] !== "string") return null;

      const inner = JSON.parse(outer[1]);
      if (
        !Array.isArray(inner) ||
        !Array.isArray(inner[0]) ||
        typeof inner[0][0] !== "string"
      ) {
        return null;
      }

      // Don't double-inject
      if (inner[0][0].endsWith(settings.injectionSuffix)) return null;

      inner[0][0] = inner[0][0] + settings.injectionSuffix;
      console.log("[AI GEO Injector][Gemini] Injecting suffix into prompt");

      // Re-encode: inner -> stringified -> outer -> stringified -> URL-encoded
      outer[1] = JSON.stringify(inner);
      params.set("f.req", JSON.stringify(outer));
      return params.toString();
    } catch (err) {
      console.warn("[AI GEO Injector][Gemini] Error modifying body:", err);
    }
    return null;
  }

  // --- Patch XMLHttpRequest (Gemini uses XHR, not fetch) ---
  //
  // Gemini uses Zone.js (Angular) which heavily wraps XHR. Patching both
  // open() and send() can conflict with Zone.js's own patches.
  //
  // Safe approach: only patch send(). Detect the StreamGenerate request by
  // checking whether the body is a string containing the f.req parameter
  // with the expected nested JSON structure (modifyBody returns non-null
  // only when the structure matches). This avoids any need to track URLs.

  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.send = function (body) {
    if (settings.enabled && typeof body === "string") {
      try {
        const modified = modifyBody(body);
        if (modified !== null) {
          console.log(
            "[AI GEO Injector][Gemini] Intercepted StreamGenerate XHR"
          );
          return originalSend.call(this, modified);
        }
      } catch (err) {
        console.warn(
          "[AI GEO Injector][Gemini] Error in XHR interceptor:",
          err
        );
      }
    }
    return originalSend.call(this, body);
  };

  console.log("[AI GEO Injector][Gemini] XHR interceptor installed");
})();
