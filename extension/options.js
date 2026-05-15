const cwdEl = document.getElementById("cwd");
const baseUrlEl = document.getElementById("baseUrl");
const tokenEl = document.getElementById("token");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

function load() {
  chrome.storage.sync.get(
    {
      repoCwd: "",
      companionBaseUrl: "http://127.0.0.1:17373",
      companionToken: "",
    },
    (s) => {
      cwdEl.value = s.repoCwd || "";
      baseUrlEl.value = s.companionBaseUrl || "http://127.0.0.1:17373";
      tokenEl.value = s.companionToken || "";
    },
  );
}

saveBtn.addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      repoCwd: cwdEl.value.trim(),
      companionBaseUrl: baseUrlEl.value.trim().replace(/\/$/, ""),
      companionToken: tokenEl.value.trim(),
    },
    () => {
      statusEl.textContent = "Saved.";
      setTimeout(() => {
        statusEl.textContent = "";
      }, 2000);
    },
  );
});

load();
