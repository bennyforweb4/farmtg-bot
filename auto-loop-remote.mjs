#!/usr/bin/env node
/**
 * FarmTG auto-loop — fixed: ???
 *
 * Plant ??? on every available plot.
 *
 * Daily routine (every 3 loops):
 *   1. Steal crops — friends first (free), then paid visits (1000 coins each, max 3)
 *   2. Put weeds/pests on visited farms ? completes daily tasks
 *   3. Clean own marks (weed/pest)
 *   4. Claim unlocked tasks + unread mails
 */

import { spawn } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FarmtgClient } from "./farmtg-client.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const JWT_FILE = join(ROOT, ".farmtg_jwt");
const DAILY_STATE_FILE = join(ROOT, ".daily_state.json");
const CHALLENGE_STATE_FILE = join(ROOT, ".challenge_state.json");
const HUMAN_PASS_FILE = join(ROOT, ".farmtg_human_pass");
const GAME_ORIGIN = "https://farmtg.top";

// Fixed crop: ???
const CROP_CABBAGE = "69f862b32c24a6892a6110d0";  // ?? (300s, 3600 coins/hr)
const CROP_RADISH  = "69f85a3a2c24a6892a6110bf";  // ??? (60s, 600 coins/hr)

const CROP_PRIORITY = [CROP_RADISH];

const CROP_NAMES = {
  [CROP_CABBAGE]: "??",
  [CROP_RADISH]: "???",
};

const CROP_INTERVAL_MS = {
  [CROP_CABBAGE]: 302_000,
  [CROP_RADISH]: 62_000,
};

const DEFAULT_LOOP_INTERVAL_MS = CROP_INTERVAL_MS[CROP_RADISH];
const DAILY_EVERY_LOOPS = 3;       // run daily routine every 3 loops
const MAX_PAID_VISITS   = 3;       // max paid visits per daily run (3000 coins/day)

const CHALLENGE_BASE_MS = 10 * 60 * 1000;
const CHALLENGE_MAX_MS = 60 * 60 * 1000;

// --- JWT ---------------------------------------------------------------------

function readJwt() {
  if (process.env.FARMTG_JWT) return process.env.FARMTG_JWT.trim();
  if (existsSync(JWT_FILE)) return readFileSync(JWT_FILE, "utf8").trim();
  throw new Error(`No JWT. Run: python3 ${join(ROOT, "get_farmtg_jwt.py")}`);
}

function readHumanPass() {
  if (process.env.FARMTG_HUMAN_PASS) {
    const value = process.env.FARMTG_HUMAN_PASS.trim();
    if (value) return value;
  }

  try {
    const value = readFileSync(HUMAN_PASS_FILE, "utf8").trim();
    if (value) return value;
  } catch {}

  return "";
}

function jwtExpiresAt(jwt) {
  try {
    const raw = jwt.split(".")[1];
    const payload = JSON.parse(Buffer.from(raw, "base64url").toString());
    return payload.exp * 1000;
  } catch { return 0; }
}

async function ensureJwt(current) {
  if (jwtExpiresAt(current) - Date.now() > 10 * 60 * 1000) return current;
  console.log("[jwt] ????,???...");
  await new Promise((resolve, reject) => {
    const proc = spawn("python3", [join(ROOT, "get_farmtg_jwt.py")], { stdio: "inherit" });
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`refresh exited ${code}`)));
  });
  return readJwt();
}

// --- challenge state --------------------------------------------------------

function loadChallengeState() {
  try {
    const state = JSON.parse(readFileSync(CHALLENGE_STATE_FILE, "utf8"));
    const now = Date.now();
    return {
      failures: Number(state.failures) || 0,
      challengePauseUntil: Number(state.challengePauseUntil) || 0,
      lastError: state.lastError || null,
      notified: Boolean(state.notified),
      ...state,
      challengePauseUntil: (state.challengePauseUntil || 0) > now ? state.challengePauseUntil : 0,
    };
  } catch {
    return { failures: 0, challengePauseUntil: 0, lastError: null, notified: false };
  }
}

function saveChallengeState(state) {
  try { writeFileSync(CHALLENGE_STATE_FILE, JSON.stringify(state)); } catch {}
}

function clearChallengeState() {
  const next = { failures: 0, challengePauseUntil: 0, lastError: null, notified: false };
  saveChallengeState(next);
  return next;
}

function applyChallengeFailure(state, err, loopNum) {
  const failures = (state.failures || 0) + 1;
  const base = Math.max(1, failures - 1);
  const backoffMs = Math.min(CHALLENGE_MAX_MS, CHALLENGE_BASE_MS * (2 ** base));

  const next = {
    failures,
    challengePauseUntil: Date.now() + backoffMs,
    lastError: {
      time: new Date().toISOString(),
      loop: loopNum,
      message: String(err?.message || ""),
      action: err?.action || null,
      code: err?.code || null,
    },
    notified: false,
  };

  saveChallengeState(next);
  return next;
}

function classifyFailure(err) {
  const msg = String(err?.message || "").toLowerCase();
  const code = String(err?.code || "").toLowerCase();
  const keys = [
    "challenge",
    "cloudflare",
    "captcha",
    "turnstile",
    "x-human-pass",
    "human-pass",
    "need_human_verification",
    "need human verification",
    "human verification",
    "??????",
    "forbidden",
    "unauthorized",
    "auth",
    "blocked",
    "permission denied",
    "ray-id",
    "429",
    "403",
  ];

  return keys.some((key) => msg.includes(key) || code.includes(key)) ? "challenge" : "action";
}

function takeChallengePause(state) {
  if (!state?.challengePauseUntil || state.challengePauseUntil <= Date.now()) {
    if (state?.challengePauseUntil) {
      state = clearChallengeState();
    }
    return { paused: false, state, waitMs: 0 };
  }

  const manualPass = readHumanPass();
  if (manualPass) {
    console.log("[challenge] ?????????,????,????");
    state = clearChallengeState();
    return { paused: false, state, waitMs: 0 };
  }

  const waitMs = state.challengePauseUntil - Date.now();
  if (!state.notified) {
    console.warn(`[challenge] ?? Cloudflare ????,???? ${Math.ceil(waitMs / 1000)} ?`);
    console.warn(`        ??: ${state.lastError?.message || "?"}`);
    console.warn(`        ????:? ${HUMAN_PASS_FILE} ???????? token,??? FARMTG_HUMAN_PASS ?????????`);
    state.notified = true;
    saveChallengeState(state);
  }

  return { paused: true, state, waitMs };
}

// --- HTTP ---------------------------------------------------------------------

function buildHeaders(jwt) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${jwt}`,
    "Origin": GAME_ORIGIN,
    "Referer": GAME_ORIGIN + "/",
    "User-Agent": "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36",
  };

  const humanPass = readHumanPass();
  if (humanPass) {
    headers["X-Human-Pass"] = humanPass;
  }

  return headers;
}

async function apiGet(path, jwt) {
  const res = await fetch(`${GAME_ORIGIN}${path}`, { headers: buildHeaders(jwt) });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: tryJson(text) };
}

async function apiPost(path, jwt, body = {}) {
  const res = await fetch(`${GAME_ORIGIN}${path}`, {
    method: "POST",
    headers: buildHeaders(jwt),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: tryJson(text) };
}

function tryJson(text) {
  try { return JSON.parse(text); } catch { return text; }
}

// --- Daily state (track visited players to avoid double-paying) --------------

function loadDailyState() {
  try {
    const raw = JSON.parse(readFileSync(DAILY_STATE_FILE, "utf8"));
    const today = new Date().toISOString().slice(0, 10);
    if (raw.date === today) return raw;
  } catch {}
  return { date: new Date().toISOString().slice(0, 10), visited: [] };
}

function saveDailyState(state) {
  try { writeFileSync(DAILY_STATE_FILE, JSON.stringify(state)); } catch {}
}

// --- Auto-accept friend requests ---------------------------------------------

async function acceptFriendRequests(jwt) {
  let page = 1, accepted = 0;
  while (true) {
    const r = await apiGet(`/api/game/friend-requests?status=pending&page=${page}&page_size=20`, jwt);
    const items = r.data?.data ?? [];
    if (items.length === 0) break;
    for (const req of items) {
      const ar = await apiPost(`/api/game/friend-requests/${req.id}/accept`, jwt);
      if (ar.ok) {
        console.log(`  [friend] ??????: ${req.from_first_name} (lv${req.from_level})`);
        accepted++;
      }
    }
    if (items.length < 20) break;
    page++;
  }
  return accepted;
}

// --- Task / mail claiming ----------------------------------------------------

async function claimMails(jwt) {
  const r = await apiGet("/api/game/mails", jwt);
  const mails = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
  let n = 0;
  for (const mail of mails) {
    if (!mail.reward_claimed && mail.id) {
      const cr = await apiPost(`/api/game/mails/${mail.id}/claim`, jwt);
      if (cr.ok) { console.log(`  [mail] ??: ${mail.title ?? mail.id}`); n++; }
    }
  }
  return n;
}

async function claimTasks(jwt) {
  const r = await apiGet("/api/game/tasks", jwt);
  const tasks = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
  let n = 0;
  for (const task of tasks) {
    if (task.status === "todo" && task.progress_percent === 100 && task.task_code) {
      const cr = await apiPost(`/api/game/tasks/${encodeURIComponent(task.task_code)}/claim`, jwt);
      if (cr.ok) { console.log(`  [task] ??: ${task.name ?? task.task_code}`); n++; }
    }
  }
  return n;
}

// --- Daily: clean own farm marks ---------------------------------------------

async function cleanOwnMarks(jwt) {
  let cleaned = 0;
  for (const cleanType of ["weeds", "worm"]) {
    const r = await apiPost("/api/game/clean-marks", jwt, { clean_type: cleanType });
    if (r.ok && r.data?.cleaned_count > 0) {
      console.log(`  [clean] ?? ${cleanType} ×${r.data.cleaned_count}`);
      cleaned += r.data.cleaned_count;
    }
  }
  return cleaned;
}

// --- Daily: steal crops + put marks ------------------------------------------

async function dailyRoutine(jwt) {
  console.log("[daily] ??????...");
  const state = loadDailyState();
  const today = new Date().toISOString().slice(0, 10);
  if (state.date !== today) {
    state.date = today;
