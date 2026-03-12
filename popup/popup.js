const enabledEl = document.getElementById("enabled");
const suffixEl = document.getElementById("suffix");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

// Load saved settings
chrome.storage.sync.get(
  { enabled: true, injectionSuffix: DEFAULT_SUFFIX },
  (items) => {
    enabledEl.checked = items.enabled;
    suffixEl.value = items.injectionSuffix;
  }
);

// Save
saveBtn.addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      enabled: enabledEl.checked,
      injectionSuffix: suffixEl.value,
    },
    () => {
      statusEl.textContent = "Saved ✓";
      setTimeout(() => (statusEl.textContent = ""), 2000);
    }
  );
});
