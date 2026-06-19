/**
 * CapSolver-based Turnstile solver for FarmTG.
 *
 * Flow:
 *  1. Submit AntiTurnstileTaskProxyLess task to CapSolver API
 *  2. Poll until solution is ready (~5-15s)
 *  3. Exchange captcha_token for human_pass via /api/game/human-verify
 *  4. Write human_pass to .farmtg_human_pass
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const HUMAN_PASS_FILE = join(ROOT, ".farmtg_human_pass");
const JWT_FILE = join(ROOT, ".farmtg_jwt");
const CAPSOLVER_KEY_FILE = join(ROOT, ".capsolver_key");

const SITE_URL = "https://farmtg.top";
const SITEKEY = "0x4AAAAAADmotcK0lqq38R89";
const CAPSOLVER_API = "https://api.capsolver.com";

function readFile(path, name) {
  if (!existsSync(path)) throw new Error(`${name} not found: ${path}`);
  return readFileSync(path, "utf8").trim();
}

async function createTask(apiKey) {
  const res = await fetch(`${CAPSOLVER_API}/createTask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientKey: apiKey,
      task: {
        type: "AntiTurnstileTaskProxyLess",
        websiteURL: SITE_URL,
        websiteKey: SITEKEY,
      },
    }),
  });
  const data = await res.json();
  if (data.errorId) throw new Error(`CapSolver createTask error: ${data.errorCode} — ${data.errorDescription}`);
  return data.taskId;
}

async function pollResult(apiKey, taskId, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(`${CAPSOLVER_API}/getTaskResult`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: apiKey, taskId }),
    });
    const data = await res.json();
    if (data.errorId) throw new Error(`CapSolver getTaskResult error: ${data.errorCode} — ${data.errorDescription}`);
    if (data.status === "ready") return data.solution.token;
    console.log(`[capsolver] status=${data.status}, waiting…`);
  }
  throw new Error("CapSolver timed out");
}

async function exchangeHumanPass(captchaToken, jwt) {
  const res = await fetch(`${SITE_URL}/api/game/human-verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ captcha_token: captchaToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`human-verify HTTP ${res.status}: ${data.error || JSON.stringify(data)}`);
  if (!data.human_pass) throw new Error("No human_pass in response: " + JSON.stringify(data));
  return { humanPass: data.human_pass, expiresIn: data.expires_in };
}

async function run() {
  const apiKey = readFile(CAPSOLVER_KEY_FILE, "CapSolver key");
  const jwt = readFile(JWT_FILE, "JWT");

  console.log(`[main] JWT: ${jwt.slice(0, 20)}…`);
  console.log(`[main] CapSolver key: ${apiKey.slice(0, 16)}…`);

  console.log("[capsolver] Submitting Turnstile task…");
  const taskId = await createTask(apiKey);
  console.log(`[capsolver] Task created: ${taskId}`);

  const captchaToken = await pollResult(apiKey, taskId);
  console.log(`[capsolver] ✅ Got captcha_token: ${captchaToken.slice(0, 30)}…`);

  console.log("[api] Exchanging for human_pass…");
  const { humanPass, expiresIn } = await exchangeHumanPass(captchaToken, jwt);
  console.log(`[api] ✅ human_pass: ${humanPass.slice(0, 30)}… (expires ${expiresIn}s)`);

  writeFileSync(HUMAN_PASS_FILE, humanPass);
  console.log(`[main] Written to ${HUMAN_PASS_FILE}`);
  return humanPass;
}

try {
  await run();
  console.log("\n✅ Done!");
} catch (e) {
  console.error(`\n❌ ${e.message}`);
  process.exit(1);
}
