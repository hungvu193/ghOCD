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

/** Bash-safe single-quoted literal. */
function shSingleQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/**
 * Pasteable script: ensure remote, fetch head branch refspec, checkout (same as companion).
 * @param {{ owner: string, repo: string, branch: string }} head
 */
function buildCheckoutScript(head) {
  const remote = head.owner;
  const url = `git@github.com:${head.owner}/${head.repo}.git`;
  const b = head.branch;
  return `#!/usr/bin/env bash
set -euo pipefail

REMOTE=${shSingleQuote(remote)}
REMOTE_URL=${shSingleQuote(url)}
BRANCH=${shSingleQuote(b)}

if ! git remote get-url "$REMOTE" &>/dev/null; then
  git remote add "$REMOTE" "$REMOTE_URL"
fi
git fetch "$REMOTE" "+refs/heads/\${BRANCH}:refs/remotes/\${REMOTE}/\${BRANCH}"
git checkout -B "$BRANCH" "refs/remotes/\${REMOTE}/\${BRANCH}"
`;
}

function setCheckmarkIcon(btn) {
  const gid = `gh-ocd-check-grad-${Math.random().toString(36).slice(2, 11)}`;
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false" style="display:block">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#3fb950"/>
          <stop offset="100%" stop-color="#56d364"/>
        </linearGradient>
      </defs>
      <path fill="url(#${gid})" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
    </svg>
  `;
}

function setScriptCopyIcon(btn) {
  const gid = `gh-ocd-copy-grad-${Math.random().toString(36).slice(2, 11)}`;
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false" style="display:block">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#3fb950"/>
          <stop offset="45%" stop-color="#39c5cf"/>
          <stop offset="100%" stop-color="#79c0ff"/>
        </linearGradient>
      </defs>
      <g fill="url(#${gid})">
        <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
        <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
      </g>
    </svg>
  `;
}

function styleScriptButton(btn) {
  btn.type = "button";
  Object.assign(btn.style, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    padding: "0",
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    cursor: "pointer",
    color: "inherit",
    verticalAlign: "middle",
    flexShrink: "0",
  });
  const hoverBg =
    "var(--control-transparent-bgColor-hover, rgba(175, 184, 193, 0.2))";
  btn.addEventListener("mouseenter", () => {
    btn.style.background = hoverBg;
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "transparent";
  });
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

function ensureScriptCopyButton(copyButton, head) {
  const next = copyButton.nextElementSibling;
  if (next && next.classList?.contains("gh-ocd-script-btn")) {
    return;
  }
  const btn = document.createElement("button");
  btn.classList.add("gh-ocd-script-btn");
  btn.dataset.ghOcdScriptBtn = "1";
  styleScriptButton(btn);
  setScriptCopyIcon(btn);
  const titleBase = "Copy fetch + checkout script for terminal (gh-ocd)";
  btn.title = titleBase;
  btn.setAttribute("aria-label", titleBase);

  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const text = buildCheckoutScript(head);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCheckmarkIcon(btn);
        btn.title = "Copied";
        btn.setAttribute("aria-label", "Copied");
        setTimeout(() => {
          alert(
            "gh-ocd: Checkout script copied. Paste it into your terminal (run from your local clone directory).",
          );
          setScriptCopyIcon(btn);
          btn.title = titleBase;
          btn.setAttribute("aria-label", titleBase);
        }, 2000);
      })
      .catch(() => {
        prompt("Copy this script (Ctrl+C / Cmd+C):", text);
      });
  });

  copyButton.insertAdjacentElement("afterend", btn);
}

function bindOne(button, head) {
  if (button.dataset.ghOcdBound !== "1") {
    button.dataset.ghOcdBound = "1";
    const remote = head.owner;

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

    button.addEventListener("click", intercept, true);
  }

  ensureScriptCopyButton(button, head);
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
