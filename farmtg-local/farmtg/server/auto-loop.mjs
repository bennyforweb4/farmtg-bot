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

import { spawn, execSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, unlinkSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FarmtgClient } from "./farmtg-client.mjs";
import { startDashboard } from "./dashboard.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const JWT_FILE = join(ROOT, ".farmtg_jwt");
const DAILY_STATE_FILE = join(ROOT, ".daily_state.json");
const CHALLENGE_STATE_FILE = join(ROOT, ".challenge_state.json");
const HUMAN_PASS_FILE = join(ROOT, ".farmtg_human_pass");
const CAPTCHA_TOKEN_FILE = join(ROOT, ".farmtg_captcha_token");
const CAPSOLVER_KEY_FILE = join(ROOT, ".capsolver_key");
const GAME_ORIGIN = "https://farmtg.top";

const CROP_GINGER  = "6a0191d87bcc1d7f9f9b3ea9";  // 王英俊家的姜 (480s, 35400 coins/hr)
const CROP_GARLIC  = "6a018d007bcc1d7f9f9b3bda";  // 大蒜 (120s, 12000 coins/hr)
const CROP_RADISH  = "69f85a3a2c24a6892a6110bf";  // 白萝卜 (60s, 6000 coins/hr)
const CROP_CABBAGE = "69f862b32c24a6892a6110d0";  // 新手白菜 (60s, 3000 coins/hr)

// 优先级：姜 > 大蒜 > 白萝卜 > 白菜（按收益降级）
const CROP_PRIORITY = [CROP_GINGER, CROP_GARLIC, CROP_RADISH, CROP_CABBAGE];

const CROP_NAMES = {
  [CROP_GINGER]:  "王英俊家的姜",
  [CROP_GARLIC]:  "大蒜",
  [CROP_RADISH]:  "白萝卜",
  [CROP_CABBAGE]: "新手白菜",
};

const CROP_INTERVAL_MS = {
  [CROP_GINGER]:  482_000,
  [CROP_GARLIC]:  122_000,
  [CROP_RADISH]:   62_000,
  [CROP_CABBAGE]: 302_000,
};

const DEFAULT_LOOP_INTERVAL_MS = CROP_INTERVAL_MS[CROP_GINGER];
const DAILY_EVERY_LOOPS = 3;       // run daily routine every 3 loops
const MAX_PAID_VISITS   = 3;       // max paid visits per daily run (3000 coins/day)

// ─── Dashboard ───────────────────────────────────────────────────────────────
const { pushStatus, pushLog, getToken: getDashboardToken } = startDashboard();
{
  const L = console.log.bind(console);
  const W = console.warn.bind(console);
  const E = console.error.bind(console);
  console.log   = (...a) => { const s = a.join(" "); L(s);  pushLog(s); };
  console.warn  = (...a) => { const s = a.join(" "); W(s);  pushLog(s); };
  console.error = (...a) => { const s = a.join(" "); E(s);  pushLog(s); };
}

const CHALLENGE_BASE_MS = 10 * 60 * 1000;
const CHALLENGE_MAX_MS = 60 * 60 * 1000;
const HUMAN_VERIFY_PATH = "/api/game/human-verify";

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

function humanPassAgeMs() {
  try { return Date.now() - statSync(HUMAN_PASS_FILE).mtimeMs; } catch { return Infinity; }
}

function parseCaptchaToken(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";

  if (text.includes("\n")) {
    const firstLine = text.split(/\r?\n/).map((x) => x.trim()).find((x) => x);
    if (firstLine) return parseCaptchaToken(firstLine);
    return "";
  }

  try {
    const json = JSON.parse(text);
    if (typeof json?.token === "string") return json.token.trim();
    if (typeof json?.captcha_token === "string") return json.captcha_token.trim();
    if (typeof json?.data?.token === "string") return json.data.token.trim();
    if (typeof json?.data?.captcha_token === "string") return json.data.captcha_token.trim();
    if (typeof json?.solution === "string") return json.solution.trim();
    if (typeof json?.text === "string") return json.text.trim();
  } catch {}

  return text;
}

function readCaptchaToken() {
  if (process.env.FARMTG_CAPTCHA_TOKEN) {
    const envToken = parseCaptchaToken(process.env.FARMTG_CAPTCHA_TOKEN);
    if (envToken) return envToken;
  }

  if (process.env.FARMTG_CAPTCHA_TOKEN_FILE) {
    try {
      const token = parseCaptchaToken(readFileSync(process.env.FARMTG_CAPTCHA_TOKEN_FILE, "utf8"));
      if (token) return token;
    } catch {}
  }

  if (existsSync(CAPTCHA_TOKEN_FILE)) {
    try {
      const token = parseCaptchaToken(readFileSync(CAPTCHA_TOKEN_FILE, "utf8"));
      if (token) return token;
    } catch {}
  }

  const cmd = process.env.FARMTG_CAPTCHA_TOKEN_CMD || "";
  if (!cmd) return "";

  try {
    const output = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 }).trim();
    return parseCaptchaToken(output);
  } catch (e) {
    console.warn(`[challenge] 人机验证码命令执行失败: ${e.message}`);
    return "";
  }
}

function tryJsonText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
function clearCaptchaTokenFile(reason) {
  try {
    if (existsSync(CAPTCHA_TOKEN_FILE)) {
      unlinkSync(CAPTCHA_TOKEN_FILE);
      console.warn("[challenge] 已清理无效验证码 token: " + reason);
    }
  } catch (e) {
    console.warn("[challenge] 清理验证码 token 失败: " + e.message);
  }
}

function isInvalidCaptchaResponse(data) {
  const text = tryJsonText(data).toLowerCase();
  return text.includes("invalid-input-response")
    || text.includes("timeout-or-duplicate")
    || text.includes("invalid-input-secret")
    || text.includes("bad-request");
}

async function requestHumanPass(jwt, captchaToken) {
  if (!captchaToken) return false;

  // 兑换时不带旧 X-Human-Pass，避免过期 pass 导致服务器拒绝 captcha_token
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${jwt}`,
    "Origin": GAME_ORIGIN,
    "Referer": GAME_ORIGIN + "/",
    "User-Agent": "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36",
  };
  const rawRes = await fetch(`${GAME_ORIGIN}${HUMAN_VERIFY_PATH}`, {
    method: "POST", headers, body: JSON.stringify({ captcha_token: captchaToken }),
  });
  const res = { ok: rawRes.ok, status: rawRes.status, data: tryJson(await rawRes.text()) };
  if (!res.ok) {
    const detail = tryJsonText(res.data) || String(res.data || "");
    console.warn(`[challenge] 人机验证码兑换失败: ${detail}`);
    if (isInvalidCaptchaResponse(res.data)) {
      clearCaptchaTokenFile("invalid captcha response");
    }
    return false;
  }

  const data = res.data?.data ? res.data.data : res.data;
  const humanPass = typeof data?.human_pass === "string" ? data.human_pass.trim() : "";
  if (!humanPass) {
    console.warn("[challenge] 人机验证码接口未返回 human_pass");
    return false;
  }

  try {
    writeFileSync(HUMAN_PASS_FILE, humanPass);
  } catch {}

  try {
    if (existsSync(CAPTCHA_TOKEN_FILE)) unlinkSync(CAPTCHA_TOKEN_FILE);
  } catch {}

  const expireText = Number.isFinite(Number(data?.expires_in)) ? `${data.expires_in} 秒` : "?";
  console.log(`[challenge] 成功更新人机凭证 ${humanPass.slice(0, 8)}…（剩余 ${expireText}）`);
  capsolverLastAttemptMs = 0; // reset cooldown so next challenge gets a fresh token promptly
  return true;
}

let capsolverLastAttemptMs = 0;
const CAPSOLVER_COOLDOWN_MS = 5 * 60_000; // 5 min between CapSolver calls to avoid waste when server is down

async function getCapsolverToken() {
  if (!existsSync(CAPSOLVER_KEY_FILE)) return "";
  const apiKey = readFileSync(CAPSOLVER_KEY_FILE, "utf8").trim();
  if (!apiKey) return "";
  const sinceLast = Date.now() - capsolverLastAttemptMs;
  if (sinceLast < CAPSOLVER_COOLDOWN_MS) {
    console.log(`[capsolver] 冷却中（已过 ${Math.round(sinceLast / 1000)}s / 300s），跳过`);
    return "";
  }
  capsolverLastAttemptMs = Date.now();
  try {
    console.log("[capsolver] 正在获取 Turnstile token…");
    const createRes = await fetch("https://api.capsolver.com/createTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: apiKey,
        task: { type: "AntiTurnstileTaskProxyLess", websiteURL: GAME_ORIGIN, websiteKey: "0x4AAAAAADmotcK0lqq38R89" },
      }),
    });
    const createData = await createRes.json();
    if (createData.errorId) throw new Error(`${createData.errorCode}: ${createData.errorDescription}`);
    const taskId = createData.taskId;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await sleep(3000);
      const pollRes = await fetch("https://api.capsolver.com/getTaskResult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey: apiKey, taskId }),
      });
      const pollData = await pollRes.json();
      if (pollData.errorId) throw new Error(`${pollData.errorCode}: ${pollData.errorDescription}`);
      if (pollData.status === "ready") {
        console.log("[capsolver] ✅ 获取成功");
        return pollData.solution.token;
      }
    }
    throw new Error("CapSolver 超时");
  } catch (e) {
    console.warn("[capsolver] 失败: " + e.message);
    return "";
  }
}

async function tryAutoVerify(jwt) {
  let token = getDashboardToken() || readCaptchaToken();
  if (!token) token = await getCapsolverToken();
  if (!token) return false;
  return await requestHumanPass(jwt, token);
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

async function takeChallengePause(state, jwt) {
  if (!state?.challengePauseUntil || state.challengePauseUntil <= Date.now()) {
    if (state?.challengePauseUntil) {
      state = clearChallengeState();
    }
    return { paused: false, state, waitMs: 0 };
  }

  const autoVerified = await tryAutoVerify(jwt);
  if (autoVerified) {
    console.log("[challenge] 人机验证已自动完成，退出暂停");
    state = clearChallengeState();
    return { paused: false, state, waitMs: 0 };
  }

  const manualPass = readHumanPass();
  if (manualPass) {
    console.log("[challenge] 检测到人工校验凭证，退出暂停，继续运行");
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
  const categories = ["novice", "daily", "weekly", "achievement", "event", ""];
  let n = 0;
  const claimed = new Set();
  for (const cat of categories) {
    const url = cat ? `/api/game/tasks?category=${cat}` : "/api/game/tasks";
    const r = await apiGet(url, jwt).catch(() => ({ data: [] }));
    const tasks = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
    for (const task of tasks) {
      if (!task.task_code || claimed.has(task.task_code)) continue;
      const done = task.status === "completed" || task.progress_percent === 100;
      if (!done) continue;
      const cr = await apiPost(`/api/game/tasks/${encodeURIComponent(task.task_code)}/claim`, jwt).catch(() => ({ ok: false }));
      if (cr.ok) {
        console.log(`  [task] 已领取(${cat||"default"}): ${task.name ?? task.task_code}`);
        claimed.add(task.task_code);
        n++;
      }
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
    state.visited = [];
  }

  // 1. Get players — prefer friends, then random
  const playersRes = await apiGet("/api/game/all-players?page=1&page_size=50", jwt);
  const players = playersRes.data?.data ?? [];
  const friends = players.filter((p) => p.is_friend);
  const others = players.filter((p) => !p.is_friend);
  const candidates = [...friends, ...others];

  let weedPut = 0, pestPut = 0, stealOk = 0, paidVisits = 0;

  for (const player of candidates) {
    if (weedPut >= 5 && pestPut >= 5 && stealOk >= 10) break;

    const key = player.player_key;
    const alreadyVisited = state.visited.includes(key);

    // Visit if non-friend and not yet visited today
    if (!player.is_friend && !alreadyVisited) {
      if (paidVisits >= MAX_PAID_VISITS) continue;
      const vr = await apiPost("/api/game/visit", jwt, { target_key: key });
      if (!vr.ok) continue;
      paidVisits++;
      state.visited.push(key);
      saveDailyState(state);
      console.log(`  [visit] ?? ${player.first_name},?? ${vr.data?.charged_coins ?? 1000} ??`);
    }

    // Get their farm plots
    const farmRes = await apiGet(`/api/game/friend-farm?target_key=${encodeURIComponent(key)}`, jwt);
    const farmPlots = farmRes.data?.plots ?? [];
    const activePlots = farmPlots.filter((p) => p.stage !== "empty" && p.stage !== "cleared");

    // Put marks on growth/mature plots (mark_type: "weeds" | "worm")
    const growingPlots = activePlots.filter((p) => p.stage === "growth" || p.stage === "mature");
    for (const plot of growingPlots.slice(0, 2)) {
      if (weedPut < 5) {
        const mr = await apiPost("/api/game/friend-farm/mark", jwt, {
          target_key: key, plot_index: plot.plot_index, mark_type: "weeds",
        });
        if (mr.ok && mr.data?.ok !== false) { weedPut++; }
      }
      if (pestPut < 5) {
        const mr = await apiPost("/api/game/friend-farm/mark", jwt, {
          target_key: key, plot_index: plot.plot_index, mark_type: "worm",
        });
        if (mr.ok && mr.data?.ok !== false) { pestPut++; }
      }
    }

    // Help clear their clearable marks
    const clearable = farmRes.data?.friend_marks_clearable ?? {};
    for (const [, marks] of Object.entries(clearable)) {
      for (const markType of (Array.isArray(marks) ? marks : [marks])) {
        await apiPost("/api/game/friend-farm/clean", jwt, {
          target_key: key, clean_type: markType,
        }).catch(() => {});
      }
    }

    // Steal crops
    const sr = await apiPost("/api/game/steal-crops", jwt, { target_key: key });
    if (sr.data?.ok && sr.data?.stolen?.length > 0) {
      stealOk++;
      const crops = sr.data.stolen.map((s) => `${s.crop_name}×${s.count}`).join(", ");
      console.log(`  [steal] ??: ${crops} ? ${player.first_name}`);
    } else if (sr.data?.pet_blocked) {
      // skip silently
    }
  }

  // 2. Clean own marks
  await cleanOwnMarks(jwt);

  // 3. Claim tasks that completed from daily activities
  const tc = await claimTasks(jwt);
  if (tc > 0) console.log(`  [daily] ?? ${tc} ?????`);

  console.log(`[daily] ??: ?×${weedPut} ?×${pestPut} ?=${stealOk} ????=${paidVisits}`);
}

function plotCropId(plot) {
  return plot?.crop_id ?? plot?.cropId ?? plot?.crop?.id ?? plot?.crop?.crop_id ?? null;
}

function chooseNextLoopInterval(plantedCropIds, client) {
  const activeCropIds = new Set(plantedCropIds);
  for (const plot of client.state.plots ?? []) {
    const id = plotCropId(plot);
    if (id) activeCropIds.add(id);
  }

  // 按最短成熟时间的作物决定循环间隔
  for (const cropId of CROP_PRIORITY) {
    if (activeCropIds.has(cropId)) return CROP_INTERVAL_MS[cropId];
  }
  return DEFAULT_LOOP_INTERVAL_MS;
}

// --- One automation tick -----------------------------------------------------

async function tick(client, jwt, loopNum) {
  const t0 = Date.now();

  // 1. Harvest all (server decides maturity — client progress may be stale)
  let harvested = 0;
  try {
    const hVersion = client.plotsVersion;
    const hr = await client.harvestAll();
    harvested = hr.data?.harvested_count ?? 0;
    if (harvested > 0) {
      await client.waitForPlots({ afterVersion: hVersion, timeoutMs: 5_000 }).catch(() => {});
    }
  } catch (e) {
    if (classifyFailure(e) === "challenge") {
      throw e;
    }
    console.warn(`  [harvest] 失败: ${e.message}`);
  }

  // 1b. Sell all fruits in warehouse (no human_pass needed)
  if (harvested > 0) {
    try {
      const fi = await client.action("get_fruit_inventory");
      const fruits = (fi?.data?.data ?? fi?.data ?? []).filter(f => f.crop_id && f.count > 0);
      let totalCoins = 0;
      for (const fruit of fruits) {
        const sr = await client.action("sell_fruits", { crop_id: fruit.crop_id, count: 0 });
        const gain = sr?.data?.coins_gain ?? sr?.data?.coins ?? 0;
        if (gain > 0) {
          totalCoins += gain;
          console.log(`  [sell] ${fruit.crop_name}×${fruit.count} +${gain} coins`);
        }
      }
      if (totalCoins > 0) console.log(`  [sell] 本次卖出共 +${totalCoins} coins`);
    } catch (e) {
      console.warn(`  [sell] 卖果实失败: ${e.message}`);
    }
  }

  // 2. Clear withered plots first
  const witheredPlots = client.getWitheredPlots();
  for (const plotIndex of witheredPlots) {
    const cr = await client.action("clear_plot", { plot_index: plotIndex }).catch((e) => {
      if (classifyFailure(e) === "challenge") throw e;
      return null;
    });
    if (cr?.ok) console.log(`  [clear] ?????? plot ${plotIndex}`);
  }

  // 3. Plant on empty plots — COINS-first order
  const inv = await client.refreshInventory();
  const findSeed = (cropId) => inv.find((i) => i.crop_id === cropId);
  const seeds = Object.fromEntries(CROP_PRIORITY.map((id) => [id, findSeed(id)]));

  // Auto-buy 王英俊家的姜 seeds when running low
  const gingerCount = seeds[CROP_GINGER]?.count ?? 0;
  const userCoins = client.state.user?.coins ?? 0;
  if (gingerCount < 100 && userCoins > 50000) {
    try {
      const br = await client.action("buy_seed", { crop_id: CROP_GINGER, count: 500 });
      if (br?.ok) {
        console.log(`  [buy] 王英俊家的姜×${br.data?.bought_count} 剩余金币=${br.data?.remaining_coins}`);
        if (seeds[CROP_GINGER]) seeds[CROP_GINGER].count += br.data?.bought_count ?? 500;
      }
    } catch (e) {
      console.warn(`  [buy] 买种子失败: ${e.message}`);
    }
  }

  const emptyPlots = client.getEmptyPlots();
  let planted = 0;
  let lastCropId = null;
  const plantedCropIds = new Set();
  for (const plotIndex of emptyPlots) {
    const cropId = CROP_PRIORITY.find((id) => (seeds[id]?.count ?? 0) > 0);
    if (!cropId) { console.log(`  [plant] ?????`); break; }
    seeds[cropId].count -= 1;
    try {
      const pr = await client.plant(plotIndex, cropId);
      if (pr.ok) { planted++; lastCropId = cropId; plantedCropIds.add(cropId); }
    } catch (e) {
      if (classifyFailure(e) === "challenge") {
        throw e;
      }
      console.warn(`  [plant] plot ${plotIndex} ??`);
    }
  }

  // 3. Every 5 loops: claim tasks/mails
  if (loopNum % 5 === 0) {
    const mc = await claimMails(jwt);
    const tc = await claimTasks(jwt);
    if (mc + tc > 0) console.log(`  [claim] mail=${mc} task=${tc}`);
  }

  const elapsed = Date.now() - t0;
  const u = client.state.user ?? {};
  const seedCounts = CROP_PRIORITY
    .map((id) => `${CROP_NAMES[id]}×${seeds[id]?.count ?? 0}`)
    .filter((s) => !s.endsWith("×0"))
    .join(" ") || "???";
  if (harvested > 0 || planted > 0 || loopNum % 10 === 0) {
    console.log(`[tick ${loopNum}] lv=${u.level} exp=${u.exp} coins=${u.coins} | ??=${harvested} ??=${planted}(${lastCropId ? CROP_NAMES[lastCropId] : "-"}) | ${seedCounts} | ${elapsed}ms`);
  }

  const nextMs = chooseNextLoopInterval(plantedCropIds, client);
  pushStatus({
    lv: u.level,
    exp: u.exp,
    coins: u.coins,
    loopNum,
    crop: lastCropId ? CROP_NAMES[lastCropId] : "-",
    nextIntervalMs: nextMs,
    challenge: false,
  });
  return nextMs;
}

// --- Main --------------------------------------------------------------------

let jwt = readJwt();
const expStr = new Date(jwtExpiresAt(jwt)).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
console.log(`[start] JWT ????: ${expStr}`);
console.log(`[start] ????: ????? (60s??)`);
console.log(`[start] ????: 62s | ????? ${DAILY_EVERY_LOOPS} ?`);

let client = null;
let loopNum = 0;
let nextLoopIntervalMs = CROP_INTERVAL_MS[CROP_RADISH];
let running = true;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let challengeState = loadChallengeState();
if (challengeState.challengePauseUntil && challengeState.challengePauseUntil > Date.now()) {
  console.log(`[challenge] ??????????????`);
}

process.on("SIGINT",  () => { running = false; console.log("\n[stop] ???..."); client?.close(); });
process.on("SIGTERM", () => { running = false; client?.close(); });

async function connectClient(token) {
  const c = new FarmtgClient({
    token,
    wsUrl: "wss://farmtg.top/api/game/ws",
    humanPass: readHumanPass(),
  });
  await c.connect();
  await c.waitForPlots();
  return c;
}

async function connectClientWithRetry() {
  let attempt = 0;
  while (running) {
    try {
      jwt = await ensureJwt(jwt);
      // Proactively verify if: active challenge pause, no human_pass, or human_pass stale (>750s)
      if (challengeState.challengePauseUntil > Date.now() || !readHumanPass() || humanPassAgeMs() > 750_000) {
        await tryAutoVerify(jwt);
      }
      return await connectClient(jwt);
    } catch (err) {
      attempt++;
      const isChallenge = classifyFailure(err) === "challenge";
      const state = isChallenge ? "[challenge]" : "[ws]";
      if (isChallenge) {
        const ok = await tryAutoVerify(jwt);
        if (ok) {
          console.log("[challenge] 已自动完成启动阶段人机校验，立即重试连接");
          continue;
        }
      }
      console.error(`${state} 启动连接失败 ` + attempt + ": " + err.message + "; 60s 后重试");
      await sleep(60_000);
    }
  }
  throw new Error("Stopped before FarmTG WebSocket connected");
}

client = await connectClientWithRetry();
challengeState = clearChallengeState();
const u0 = client.state.user ?? {};
console.log(`[connected] lv=${u0.level} exp=${u0.exp} coins=${u0.coins} plots=${u0.unlocked_plots}`);

// Startup: accept friend requests, claim everything, run daily routine
await acceptFriendRequests(jwt);
await claimMails(jwt);
await claimTasks(jwt);

// 激活最强宠物（可爱柯基 70% 防偷）
try {
  const pr = await client.action("set_active_pet", { pet_id: "69eb43a634915c56bf59874d" });
  if (pr?.ok) console.log("[startup] 已激活宠物：可爱柯基（防偷 70%）");
} catch (e) {
  console.warn("[startup] 激活宠物失败:", e.message);
}

await dailyRoutine(jwt);

// Main loop
while (running) {
  const gate = await takeChallengePause(challengeState, jwt);
  if (gate.paused) {
    challengeState = gate.state;
    await sleep(Math.min(gate.waitMs, nextLoopIntervalMs));
    continue;
  }

  loopNum++;
  try {
    jwt = await ensureJwt(jwt);

    if (!client?.ws || client.ws.readyState > 1) {
      console.log("[ws] ???...");
      client?.close();
      client = await connectClient(jwt);
    }

    nextLoopIntervalMs = await tick(client, jwt, loopNum);

    // Daily routine every DAILY_EVERY_LOOPS iterations
    if (loopNum % DAILY_EVERY_LOOPS === 0) {
      await acceptFriendRequests(jwt);
      await dailyRoutine(jwt);
    }

    challengeState = clearChallengeState();
  } catch (err) {
    if (classifyFailure(err) === "challenge") {
      const ok = await tryAutoVerify(jwt);
      if (ok) {
        console.log(`[challenge] loop ${loopNum}: 自动完成验证，恢复运行`);
        challengeState = clearChallengeState();
        pushStatus({ challenge: false, verifyMsg: "✅ 验证完成，bot 已恢复运行" });
        client?.close();
        client = await connectClient(jwt);
        nextLoopIntervalMs = 60_000;
      } else {
        challengeState = applyChallengeFailure(challengeState, err, loopNum);
        console.error(`[challenge] loop ${loopNum}: ${err.message}`);
        console.error(`[challenge] 请在浏览器完成人机验证后，写入 ${HUMAN_PASS_FILE} 或设置 FARMTG_HUMAN_PASS 并重启进程`);
        pushStatus({ challenge: true, challengeMsg: `Cloudflare 验证触发（第 ${loopNum} 次循环），请在页面完成验证` });
        client?.close();
        client = null;
        nextLoopIntervalMs = 60_000;
      }
    } else {
      console.error(`[error] loop ${loopNum}: ${err.message}`);
      client?.close();
      client = null;
      // Refresh human_pass if stale (valid for 900s, refresh at 750s)
      if (humanPassAgeMs() > 750_000) await tryAutoVerify(jwt);
      try { client = await connectClient(jwt); } catch (e2) { console.error("[reconnect failed]", e2.message); }
      challengeState = clearChallengeState();
      nextLoopIntervalMs = 60_000;
    }
  }

  if (!running) break;
  await sleep(nextLoopIntervalMs);
}

client?.close();
console.log("[done]");

