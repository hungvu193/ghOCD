# gh-ocd — GitHub PR branch checkout helpers

Chrome extension for **pull request** pages on GitHub. It adds a **second action** next to “Copy head branch name” and can **replace** that button’s behavior so you run **fetch + checkout** on your machine instead of only copying the branch name.

Browsers cannot run `git` directly, so **one-click checkout** uses a tiny **local companion** server. **Copy script** works anywhere—paste the generated shell into a terminal inside your clone.

---

## Demo

GitHub **strips `<video>` and most HTML** from repository READMEs, and the README **web editor preview** (`…/edit/…`) can fail or look blank when that markup is present. This section stays **Markdown-only** so rendering and previews stay reliable.

| Default copy button — `demo/demo.mp4` | Copy script button — `demo/demo2.mp4` |
| --- | --- |
| **[Watch on GitHub (player + thumbnail)](https://github.com/hungvu193/ghOCD/blob/main/demo/demo.mp4)** · [Raw `.mp4`](https://raw.githubusercontent.com/hungvu193/ghOCD/main/demo/demo.mp4) | **[Watch on GitHub (player + thumbnail)](https://github.com/hungvu193/ghOCD/blob/main/demo/demo2.mp4)** · [Raw `.mp4`](https://raw.githubusercontent.com/hungvu193/ghOCD/main/demo/demo2.mp4) |

**Inline playback on the readme itself:** on github.com open this file → **edit** → drag each demo MP4 into the editor. GitHub inserts a `https://github.com/user-attachments/assets/…` URL—leave that alone on its own line and commit; those links render as the familiar inline GitHub player. The copies under `demo/` remain the canonical files for the repo and clones.

Can't open **`/edit/main/README.md`?** You must be [**signed in**](https://github.com/login) and have **push** access to [`hungvu193/ghOCD`](https://github.com/hungvu193/ghOCD). Forks keep the fork’s URL (for example `/edit/main/README.md` on *your* fork).

---

## What you get on a PR page

GitHub shows the usual **copy** icon for the **head branch**. This extension adds:

1. **Gradient copy icon (green / cyan / blue)** — copies a ready-to-run **bash script** that:
   - adds the head fork as a `git` remote when missing (`git@github.com:<owner>/<repo>.git`, remote name = fork owner, e.g. `margelo`);
   - **fetches** the head branch with an explicit refspec;
   - **checks out** that branch (`git checkout -B …`).

   After a successful copy, the icon briefly shows a **checkmark**, then an **alert**, then returns to the copy icon.

2. **Native copy button (intercepted)** — if the **companion** is configured and running, a click can run **fetch + checkout** in your chosen directory instead of only copying to the clipboard (you’ll get a confirmation dialog first).

---

## Requirements

- **Google Chrome** (or another Chromium browser that supports Manifest V3 extensions).
- **Git** and SSH access to GitHub (`git@github.com:…`) for the script or companion flows.
- **Node.js** (optional, for the companion): only needed for one-click checkout via the server.

---

## Install the extension

1. Clone or download this repository.
2. Open **`chrome://extensions`**.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the **`extension`** folder (the one that contains `manifest.json`).

---

## Configure options

1. On the extensions page, open **GH PR checkout (gh-ocd)** → **Extension options** (or details → Options).
2. Set **Git working directory** to the root of your local clone (e.g. your `Expensify/App` checkout).
3. **Companion URL** defaults to `http://127.0.0.1:17373` unless you change the server port.
4. Optionally set a **shared token**: if you start the companion with `GITHUB_PR_CHECKOUT_TOKEN`, paste the same value here so only your browser can call the server.

---

## Run the companion (one-click checkout)

From the repo root:

```bash
cd companion
node server.mjs
```

Optional:

```bash
GITHUB_PR_CHECKOUT_TOKEN=your-secret node server.mjs
GITHUB_PR_CHECKOUT_PORT=17373 node server.mjs
```

Leave this process running while you use one-click checkout. It listens on **127.0.0.1** only.

---

## Day-to-day use

1. Open any **pull request** on `github.com` (including **Conversation**, **Files changed**, etc.).
2. Find the head branch line (**from `owner:branch`**) and the **copy** control GitHub provides.
3. **Pasteable script:** click the **gradient copy** icon next to it → script is on the clipboard after the flow completes; run it from **inside your clone** in a terminal.
4. **Direct checkout:** ensure options + companion are set, then use the **original** copy icon (confirm in the dialog) to run git via the server.

If something breaks after a GitHub UI update, the extension looks up the head branch link and the “copy head branch name” control by structure; you may need an update to match new markup.

---

## Repository layout

| Path | Purpose |
|------|---------|
| `extension/` | Chrome extension (content script, background, options UI) |
| `companion/` | Local HTTP server that runs `git` for one-click checkout |
| `demo/` | Demo videos for the README |

---

## License

See [`LICENSE`](LICENSE).
