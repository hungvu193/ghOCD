function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/$/, "");
}

async function checkoutViaCompanion(payload) {
  const { companionBaseUrl, companionToken, repoCwd, headOwner, headRepo, branch } = payload;
  const base = normalizeBaseUrl(companionBaseUrl) || "http://127.0.0.1:17373";
  const headers = { "Content-Type": "application/json" };
  if (companionToken) {
    headers["X-GH-OCD-Token"] = companionToken;
  }
  const res = await fetch(`${base}/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      cwd: repoCwd,
      headOwner,
      headRepo,
      branch,
    }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { ok: false, error: text || `HTTP ${res.status}` };
  }
  if (!res.ok) {
    throw new Error(body.error || body.stderr || `HTTP ${res.status}`);
  }
  if (body && body.ok === false) {
    throw new Error(body.error || body.stderr || "Checkout failed");
  }
  return body;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "GH_OCD_CHECKOUT") {
    return;
  }
  (async () => {
    try {
      const settings = await chrome.storage.sync.get({
        repoCwd: "",
        companionBaseUrl: "http://127.0.0.1:17373",
        companionToken: "",
      });
      const { headOwner, headRepo, branch } = msg;
      if (!settings.repoCwd) {
        throw new Error("Set your clone path in gh-ocd options.");
      }
      if (!headOwner || !headRepo || !branch) {
        throw new Error("Could not read head fork/branch from this page.");
      }
      const out = await checkoutViaCompanion({
        companionBaseUrl: settings.companionBaseUrl,
        companionToken: settings.companionToken,
        repoCwd: settings.repoCwd,
        headOwner,
        headRepo,
        branch,
      });
      sendResponse({ ok: true, out });
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
  })();
  return true;
});
