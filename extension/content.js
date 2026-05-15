/**
 * Intercept GitHub's "Copy head branch name" control and run fetch+checkout
 * via the extension background + localhost companion.
 *
 * GitHub's PR UI (Primer / react-partial) uses IconButton + aria-labelledby
 * pointing at a tooltip span — the old .commit-ref.head-ref selectors no longer apply.
 */

const COPY_HEAD_BRANCH_RE = /copy\s+head\s+branch\s+name/i;

function parseTreeHref(href) {
  try {
    const u = new URL(href, location.origin);
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/tree\/(.+)$/);
    if (!m) {
      return null;
    }
    const [, owner, repo, branch] = m;
    return { owner, repo, branch: decodeURIComponent(branch) };
  } catch {
    return null;
  }
}

function tooltipLabelForButton(btn) {
  const id = btn.getAttribute("aria-labelledby");
  if (!id) {
    return "";
  }
  const tip = document.getElementById(id);
  return (tip && (tip.getAttribute("aria-label") || tip.textContent)) || "";
}

/**
 * Each PR header block (main + sticky) has an IconButton; tooltip says "Copy head branch name…".
 * The head fork link is in the same flex row as that button.
 */
function findCopyHeadBranchTargets() {
  const buttons = document.querySelectorAll(
    'button[data-component="IconButton"][aria-labelledby]',
  );
  /** @type {Array<{ button: Element, head: { owner: string, repo: string, branch: string } }>} */
  const out = [];
  for (const btn of buttons) {
    if (!COPY_HEAD_BRANCH_RE.test(tooltipLabelForButton(btn))) {
      continue;
    }
    const row = btn.closest("div.d-flex.flex-items-center.gap-1");
    if (!row) {
      continue;
    }
    const link = row.querySelector('a[href*="/tree/"]');
    if (!link) {
      continue;
    }
    const parsed = parseTreeHref(link.getAttribute("href") || "");
    if (!parsed) {
      continue;
    }
    out.push({ button: btn, head: parsed });
  }
  return out;
}

function bindOne(button, head) {
  if (button.dataset.ghOcdBound === "1") {
    return;
  }
  button.dataset.ghOcdBound = "1";
  const remote = head.owner;
  const row = button.closest("div.d-flex.flex-items-center.gap-1");
  if (row && !row.querySelector(".gh-ocd-hint")) {
    const span = document.createElement("span");
    span.className = "gh-ocd-hint";
    span.style.cssText = "margin-left:6px;font-size:12px;color:#57606a;white-space:nowrap;";
    span.textContent = `(gh-ocd → ${remote})`;
    row.appendChild(span);
  }

  const intercept = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    if (
      !confirm(`Fetch from remote "${remote}" and checkout "${head.branch}"?`)
    ) {
      return;
    }
    chrome.runtime.sendMessage(
      {
        type: "GH_OCD_CHECKOUT",
        headOwner: head.owner,
        headRepo: head.repo,
        branch: head.branch,
      },
      (resp) => {
        if (chrome.runtime.lastError) {
          alert(`gh-ocd: ${chrome.runtime.lastError.message}`);
          return;
        }
        if (!resp?.ok) {
          alert(`gh-ocd: ${resp?.error || "Unknown error"}`);
          return;
        }
        const lines = (resp.out?.log || []).join("\n");
        alert(`gh-ocd: done.\n\n${lines}`);
      },
    );
  };

  // Capture: run before GitHub's React listeners copy to clipboard.
  button.addEventListener("click", intercept, true);
}

function attachInterceptor() {
  for (const { button, head } of findCopyHeadBranchTargets()) {
    bindOne(button, head);
  }
}

const mo = new MutationObserver(() => {
  attachInterceptor();
});

attachInterceptor();
mo.observe(document.documentElement, { childList: true, subtree: true });
