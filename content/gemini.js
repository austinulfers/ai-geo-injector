/**
 * Content script for gemini.google.com (runs in the ISOLATED world).
 *
 * Responsibilities:
 *  1. Read settings from chrome.storage.sync and forward them to the
 *     page-level gemini-inject.js (MAIN world) via CustomEvents.
 *  2. Listen for storage changes and push updates in real-time.
 */

(function () {
  "use strict";

  function isContextValid() {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }

  function pushSettings(settings) {
    document.dispatchEvent(
      new CustomEvent("__ami_settings__", { detail: settings })
    );
  }

  function loadAndPushSettings() {
    if (!isContextValid()) return;
    chrome.storage.sync.get(
      { enabled: true, injectionSuffix: DEFAULT_SUFFIX },
      (items) => pushSettings(items)
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => loadAndPushSettings());
  }
  setTimeout(loadAndPushSettings, 0);
  setTimeout(loadAndPushSettings, 200);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    loadAndPushSettings();
  });

  console.log("[AI Marketing Injector][Gemini] Content script (isolated) loaded");
})();
