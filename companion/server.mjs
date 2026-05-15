#!/usr/bin/env node
/**
 * Local companion for the gh-ocd Chrome extension.
 * Git cannot run inside the browser; this listens on localhost and runs git.
 *
 * Run:
 *   GITHUB_PR_CHECKOUT_TOKEN=optional-secret node server.mjs
 *
 * Or: npm start (from companion/)
 */

import http from "node:http";
import { spawn } from "node:child_process";
import process from "node:process";
import { existsSync } from "node:fs";

const PORT = Number(process.env.GITHUB_PR_CHECKOUT_PORT || 17373);
const TOKEN = process.env.GITHUB_PR_CHECKOUT_TOKEN || "";

function runGit(cwd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const err = new Error(stderr.trim() || stdout.trim() || `git exited ${code}`);
        err.code = code;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      }
    });
  });
}

async function ensureRemote(cwd, name, owner, repo) {
  const url = `git@github.com:${owner}/${repo}.git`;
  try {
    await runGit(cwd, ["remote", "get-url", name]);
  } catch {
    await runGit(cwd, ["remote", "add", name, url]);
    return { step: "remote add", detail: `${name} -> ${url}` };
  }
  return { step: "remote exists", detail: name };
}

async function fetchAndCheckout(cwd, remoteName, branch) {
  const log = [];
  const refspec = `+refs/heads/${branch}:refs/remotes/${remoteName}/${branch}`;
  log.push(`git fetch ${remoteName} ${refspec}`);
  await runGit(cwd, ["fetch", remoteName, refspec]);
  log.push(`git checkout -B ${branch} refs/remotes/${remoteName}/${branch}`);
  await runGit(cwd, ["checkout", "-B", branch, `refs/remotes/${remoteName}/${branch}`]);
  return log;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function jsonHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    ...extra,
  };
}

function sendJson(res, status, body) {
  res.writeHead(status, jsonHeaders());
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-GH-OCD-Token",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/checkout") {
    sendJson(res, 404, { ok: false, error: "Not found" });
    return;
  }

  if (TOKEN) {
    const got = req.headers["x-gh-ocd-token"];
    if (got !== TOKEN) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return;
    }
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { ok: false, error: "Invalid JSON" });
    return;
  }

  const cwd = body.cwd;
  const headOwner = body.headOwner;
  const headRepo = body.headRepo;
  const branch = body.branch;

  if (!cwd || !headOwner || !headRepo || !branch) {
    sendJson(res, 400, { ok: false, error: "Missing cwd, headOwner, headRepo, or branch" });
    return;
  }
  if (!existsSync(cwd)) {
    sendJson(res, 400, { ok: false, error: `cwd does not exist: ${cwd}` });
    return;
  }

  const remoteName = headOwner;
  const log = [];

  try {
    const r = await ensureRemote(cwd, remoteName, headOwner, headRepo);
    log.push(`${r.step}: ${r.detail}`);
    const gLog = await fetchAndCheckout(cwd, remoteName, branch);
    log.push(...gLog);
    res.writeHead(200, jsonHeaders());
    res.end(JSON.stringify({ ok: true, log }));
  } catch (e) {
    res.writeHead(500, jsonHeaders());
    res.end(
      JSON.stringify({
        ok: false,
        error: e?.message || String(e),
        stderr: e?.stderr,
      }),
    );
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.error(`gh-ocd companion listening on http://127.0.0.1:${PORT}`);
});
