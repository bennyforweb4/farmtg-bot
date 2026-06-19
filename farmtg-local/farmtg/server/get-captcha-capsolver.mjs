/**
 * CapSolver captcha-token fetcher — prints raw Turnstile token to stdout.
 * Used as FARMTG_CAPTCHA_TOKEN_CMD so auto-loop.mjs can exchange it for human_pass.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const CAPSOLVER_KEY_FILE = join(ROOT, ".capsolver_key");

const SITE_URL = "https://farmtg.top";
const SITEKEY = "0x4AAAAAADmotcK0lqq38R89";
const CAPSOLVER_API = "https://api.capsolver.com";

if (!existsSync(CAPSOLVER_KEY_FILE)) {
  process.stderr.write("CapSolver key not found: " + CAPSOLVER_KEY_FILE + "\n");
  process.exit(1);
}
const apiKey = readFileSync(CAPSOLVER_KEY_FILE, "utf8").trim();

async function solve() {
  // Create task
  const createRes = await fetch(`${CAPSOLVER_API}/createTask`, {
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
  const createData = await createRes.json();
  if (createData.errorId) throw new Error(`createTask: ${createData.errorCode} ${createData.errorDescription}`);
  const taskId = createData.taskId;

  // Poll
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(`${CAPSOLVER_API}/getTaskResult`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: apiKey, taskId }),
    });
    const pollData = await pollRes.json();
    if (pollData.errorId) throw new Error(`getTaskResult: ${pollData.errorCode} ${pollData.errorDescription}`);
    if (pollData.status === "ready") {
      process.stdout.write(pollData.solution.token);
      return;
    }
  }
  throw new Error("CapSolver timed out");
}

try {
  await solve();
} catch (e) {
  process.stderr.write("❌ " + e.message + "\n");
  process.exit(1);
}
