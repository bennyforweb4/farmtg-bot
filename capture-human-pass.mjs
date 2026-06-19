import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const PORT = 17771;
const ROOT = resolve("farmtg-local", "farmtg");
const LOCAL_PASS_FILE = join(ROOT, ".farmtg_human_pass");
const PLINK = resolve(".cli-tools", "plink.exe");
const SSH_PASSWORD_B64 = process.env.FARMTG_SSH_PASSWORD_B64 || "";
const SSH_HOSTKEY = "ssh-rsa 3072 SHA256:kp+ec5gfEve+Vv1VfBddjQ2qpuMopI2mNhbdA/bnSiE";
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function extractHumanPass(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed);
    const found = findHumanPass(parsed);
    if (found) return found;
  } catch {}

  const match = trimmed.match(/["']human[_-]?pass["']\s*:\s*["']([^"']+)["']/i);
  if (match) return match[1].trim();

  if (/^[A-Za-z0-9._~-]{20,}$/.test(trimmed) && trimmed.length < 1000) {
    return trimmed;
  }

  return "";
}

function findHumanPass(value) {
  if (!value || typeof value !== "object") return "";
  if (typeof value.human_pass === "string") return value.human_pass.trim();
  if (typeof value.humanPass === "string") return value.humanPass.trim();
  for (const child of Object.values(value)) {
    const found = findHumanPass(child);
    if (found) return found;
  }
  return "";
}

function shSingle(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function writeRemoteHumanPass(humanPass) {
  if (!existsSync(PLINK)) throw new Error(`plink not found: ${PLINK}`);
  if (!SSH_PASSWORD_B64) throw new Error("FARMTG_SSH_PASSWORD_B64 is not set");

  const password = Buffer.from(SSH_PASSWORD_B64, "base64").toString("utf8");
  const passB64 = Buffer.from(humanPass, "utf8").toString("base64");
  const remote = [
    `printf ${shSingle(passB64)} | base64 -d > /opt/farmtg/.farmtg_human_pass`,
    "chmod 600 /opt/farmtg/.farmtg_human_pass",
    "rm -f /opt/farmtg/.challenge_state.json /opt/farmtg/.farmtg_captcha_token",
    "pm2 restart farmtg --update-env",
    "sleep 5",
    "pm2 list | grep farmtg || true",
  ].join("; ");

  const result = spawnSync(PLINK, [
    "-ssh",
    "root@66.154.109.189",
    "-pw",
    password,
    "-batch",
    "-hostkey",
    SSH_HOSTKEY,
    remote,
  ], { encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `plink exited ${result.status}`).trim());
  }
  return result.stdout.trim();
}

function page(message = "") {
  return `<!doctype html>
<meta charset="utf-8">
<title>FarmTG Human Pass Capture</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 32px; max-width: 860px; line-height: 1.45; }
  textarea { width: 100%; height: 260px; font: 13px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; }
  button { margin-top: 12px; padding: 10px 14px; font: inherit; cursor: pointer; }
  pre { padding: 12px; background: #f4f4f5; white-space: pre-wrap; }
</style>
<h1>FarmTG Human Pass Capture</h1>
<p>Paste the <code>/api/game/human-verify</code> response here, or paste only the <code>human_pass</code> value.</p>
${message ? `<pre>${escapeHtml(message)}</pre>` : ""}
<form method="post" action="/submit">
  <textarea name="payload" autofocus></textarea>
  <br>
  <button type="submit">Submit</button>
</form>`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method === "GET") {
    res.writeHead(200, { ...CORS_HEADERS, "content-type": "text/html; charset=utf-8" });
    res.end(page());
    return;
  }

  if (req.method !== "POST" || req.url !== "/submit") {
    res.writeHead(404, CORS_HEADERS);
    res.end("not found");
    return;
  }

  let body = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    try {
      const payload = new URLSearchParams(body).get("payload") || "";
      const humanPass = extractHumanPass(payload);
      if (!humanPass) throw new Error("No human_pass found in submitted text");

      writeFileSync(LOCAL_PASS_FILE, humanPass);
      const remoteOutput = writeRemoteHumanPass(humanPass);
      const message = [
        `Captured human_pass length=${humanPass.length}`,
        `Wrote local: ${LOCAL_PASS_FILE}`,
        "Wrote remote: /opt/farmtg/.farmtg_human_pass",
        "",
        remoteOutput,
      ].join("\n");
      console.log(message);
      res.writeHead(200, { ...CORS_HEADERS, "content-type": "text/html; charset=utf-8" });
      res.end(page(message));
      setTimeout(() => server.close(() => process.exit(0)), 750);
    } catch (error) {
      const message = `Error: ${error.message}`;
      console.error(message);
      res.writeHead(400, { ...CORS_HEADERS, "content-type": "text/html; charset=utf-8" });
      res.end(page(message));
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Open http://127.0.0.1:${PORT}/`);
});

setTimeout(() => {
  console.log("Timed out waiting for human_pass submission");
  server.close(() => process.exit(2));
}, 10 * 60 * 1000);
