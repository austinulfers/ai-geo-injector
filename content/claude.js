/**
 * Content script for claude.ai (runs in the ISOLATED world).
 *
 * Responsibilities:
 *  1. Read settings from chrome.storage.sync and forward them to the
 *     page-level inject.js (MAIN world) via CustomEvents on the document.
 *  2. Listen for storage changes and push updates in real-time.
 *
 * inject.js runs in the MAIN world (configured via manifest.json) and
 * patches window.fetch — it listens for "__ami_settings__" events.
 */

(function () {
  "use strict";

  /**
   * Guard: returns true if the extension context is still valid.
   * After an extension reload/update, stale content scripts lose their
   * chrome.runtime connection, causing "Extension context invalidated" errors.
   */
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

  // Push settings on various timings to ensure the MAIN world script receives them
  // (it may load before or after this isolated-world script)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => loadAndPushSettings());
  }
  setTimeout(loadAndPushSettings, 0);
  setTimeout(loadAndPushSettings, 200);

  // React to storage changes from the popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    loadAndPushSettings();
  });

  console.log("[AI Marketing Injector] Content script (isolated) loaded");
})();
