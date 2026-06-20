import { createServer } from "node:http";
import { exec } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const JWT_FILE = join(__dir, "..", ".farmtg_jwt");

const PORT = 7788;

const STRATEGY = [
  { rank: 1,  name: "王英俊家的姜",   cycle: "8min",    hr13: 460200, lv: 16, current: true  },
  { rank: 2,  name: "大蒜",           cycle: "2min",    hr13: 156000, lv: 1,  current: false },
  { rank: 3,  name: "乐乐家的南瓜王", cycle: "820min",  hr13: 136981, lv: 58, current: false },
  { rank: 4,  name: "🐶东家的草莓",   cycle: "188min",  hr13: 78338,  lv: 5,  current: false },
  { rank: 5,  name: "西瓜大王",       cycle: "1140min", hr13: 39416,  lv: 60, current: false },
  { rank: 6,  name: "新手白菜",       cycle: "1min",    hr13: 39000,  lv: 3,  current: false },
  { rank: 7,  name: "太阳花之王",     cycle: "240min",  hr13: 31200,  lv: 57, current: false },
  { rank: 8,  name: "星河蓝莓",       cycle: "480min",  hr13: 31200,  lv: 59, current: false },
  { rank: 9,  name: "金纹西瓜",       cycle: "1440min", hr13: 28054,  lv: 56, current: false },
  { rank: 10, name: "金冠向日葵",     cycle: "240min",  hr13: 27950,  lv: 53, current: false },
];

const STRATEGY_ROWS = STRATEGY.map(r =>
  `<tr class="${r.current ? "cur" : ""}">` +
  `<td>${r.rank}</td><td>${r.name}</td><td>${r.cycle}</td>` +
  `<td>${r.hr13.toLocaleString()}</td><td>Lv${r.lv}</td>` +
  `<td>${r.current ? "✓ 当前" : ""}</td></tr>`
).join("");

export function startDashboard() {
  const clients = new Set();
  const state = { challenge: false };
  const logs = [];
  let pendingToken = null;

  function sse(client, data) {
    try { client.write(`data: ${JSON.stringify(data)}\n\n`); return true; }
    catch { return false; }
  }

  function broadcast(data) {
    for (const c of [...clients]) { if (!sse(c, data)) clients.delete(c); }
  }

  function pushStatus(update) {
    Object.assign(state, update);
    broadcast({ t: "s", ...state });
  }

  function pushLog(line) {
    logs.push(line);
    if (logs.length > 200) logs.shift();
    broadcast({ t: "l", line });
  }

  function getToken() {
    const t = pendingToken;
    pendingToken = null;
    return t || "";
  }

  const server = createServer((req, res) => {
    const path = new URL(req.url, "http://x").pathname;

    if (path === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      clients.add(res);
      sse(res, { t: "s", ...state });
      for (const line of logs.slice(-80)) sse(res, { t: "l", line });
      req.on("close", () => clients.delete(res));
      return;
    }

    if (path === "/api/token" && req.method === "POST") {
      let body = "";
      req.on("data", d => (body += d));
      req.on("end", () => {
        try {
          const { token } = JSON.parse(body);
          if (token) {
            pendingToken = token;
            pushStatus({ challenge: false, verifyMsg: "✅ Token 已接收，等待 bot 处理…" });
          }
          res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end('{"ok":true}');
        } catch {
          res.writeHead(400); res.end();
        }
      });
      return;
    }

    if (path === "/api/jwt" && req.method === "POST") {
      let body = "";
      req.on("data", d => (body += d));
      req.on("end", () => {
        try {
          const { jwt } = JSON.parse(body);
          if (!jwt || jwt.split(".").length !== 3) {
            res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end('{"ok":false,"error":"无效的 JWT 格式"}');
            return;
          }
          writeFileSync(JWT_FILE, jwt.trim());
          pushLog("[jwt] ✅ JWT 已更新，bot 将在下次循环自动使用新 token");
          res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end('{"ok":true}');
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    if (path === "/api/jwt" && req.method === "GET") {
      let preview = "";
      try {
        const raw = readFileSync(JWT_FILE, "utf8").trim();
        const payload = JSON.parse(Buffer.from(raw.split(".")[1], "base64url").toString());
        const exp = new Date(payload.exp * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
        preview = `有效期至 ${exp}`;
      } catch { preview = "读取失败"; }
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ok: true, preview }));
      return;
    }

    if (path === "/" || path === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(HTML);
      return;
    }

    res.writeHead(404); res.end("not found");
  });

  server.listen(PORT, "0.0.0.0", () => {
    if (process.platform === "win32") {
      exec(`start http://localhost:${PORT}`);
    }
  });

  return { pushStatus, pushLog, getToken };
}

const HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FarmTG Bot</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e6edf3;font-family:"Segoe UI",system-ui,sans-serif;font-size:14px;line-height:1.5}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#161b22;border-bottom:1px solid #30363d}
.topbar h1{font-size:17px;font-weight:600}
.topbar h1 span{color:#3fb950}
#badge{font-size:12px;padding:3px 12px;border-radius:12px;background:#21262d;color:#8b949e;transition:all .3s}
#badge.running{background:#1a3a24;color:#3fb950}
#badge.challenge{background:#3d1a1a;color:#f85149;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
.layout{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#30363d;border-bottom:1px solid #30363d}
@media(max-width:640px){.layout{grid-template-columns:1fr}}
.card{background:#0d1117;padding:16px}
.card+.card-full{margin-top:1px}
.card-full{background:#0d1117;padding:16px;border-bottom:1px solid #21262d}
h2{font-size:11px;color:#8b949e;text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px;font-weight:500}
.stats{display:flex;flex-wrap:wrap;gap:10px}
.stat{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px 14px;min-width:85px}
.stat .lbl{font-size:11px;color:#8b949e;margin-bottom:2px}
.stat .val{font-size:22px;font-weight:700}
.val.green{color:#3fb950}
.val.orange{color:#f0883e}
.val.blue{color:#58a6ff}
.val.sm{font-size:15px;padding-top:3px}
#verify-box{border:1px solid #30363d;border-radius:8px;padding:14px}
#vmsg{margin-bottom:10px;min-height:22px;font-size:13px}
#vmsg.ok{color:#3fb950}
#vmsg.err{color:#f85149}
.cf-area{margin:8px 0 12px;min-height:65px;display:none}
.manual{display:flex;gap:8px}
.manual input{flex:1;background:#161b22;border:1px solid #30363d;border-radius:5px;color:#e6edf3;padding:7px 10px;font-size:13px;outline:none}
.manual input:focus{border-color:#58a6ff}
.manual button{background:#238636;border:none;border-radius:5px;color:#fff;padding:7px 16px;cursor:pointer;font-size:13px;white-space:nowrap}
.manual button:hover{background:#2ea043}
table{width:100%;border-collapse:collapse;font-size:13px}
thead th{color:#8b949e;font-weight:500;text-align:left;padding:5px 8px;border-bottom:1px solid #30363d}
tbody td{padding:5px 8px;border-bottom:1px solid #161b22}
tbody tr:hover td{background:#161b22}
tbody tr.cur td{color:#3fb950;font-weight:600}
#logbox{font-family:"Consolas","Courier New",monospace;font-size:12px;height:260px;overflow-y:auto;padding:8px 10px;background:#010409;border:1px solid #30363d;border-radius:6px}
.ll{padding:1px 0;color:#484f58;white-space:pre-wrap;word-break:break-all}
.ll.tick{color:#58a6ff}
.ll.sell{color:#f0883e}
.ll.ok{color:#3fb950}
.ll.warn{color:#d29922}
.ll.err{color:#f85149}
.ll.cap{color:#a371f7}
.ll.daily{color:#8b949e}
</style>
</head>
<body>
<div class="topbar">
  <h1><span>🌾</span> FarmTG Bot</h1>
  <span id="badge">连接中…</span>
</div>

<div class="layout">
  <div class="card">
    <h2>账号状态</h2>
    <div class="stats">
      <div class="stat"><div class="lbl">等级</div><div class="val green" id="s-lv">-</div></div>
      <div class="stat"><div class="lbl">金币</div><div class="val orange" id="s-coins">-</div></div>
      <div class="stat"><div class="lbl">经验</div><div class="val blue" id="s-exp">-</div></div>
    </div>
    <div class="stats" style="margin-top:10px">
      <div class="stat"><div class="lbl">循环次数</div><div class="val sm" id="s-loop">-</div></div>
      <div class="stat"><div class="lbl">当前作物</div><div class="val sm" id="s-crop">-</div></div>
      <div class="stat"><div class="lbl">下次间隔</div><div class="val sm" id="s-interval">-</div></div>
    </div>
  </div>

  <div class="card">
    <h2>人机验证</h2>
    <div id="verify-box">
      <div id="vmsg" class="ok">✅ 自动模式：CapSolver 处理中，无需操作</div>
      <div class="cf-area" id="cf-area"><div id="cf-widget"></div></div>
      <div class="manual">
        <input id="token-inp" placeholder="手动粘贴 captcha_token（可选）">
        <button onclick="submitManual()">提交</button>
      </div>
    </div>
  </div>
</div>

<div class="card-full">
  <h2>收益排行（13 地块全种，金币/小时）</h2>
  <table>
    <thead><tr><th>#</th><th>作物</th><th>周期</th><th>金币/hr（13块）</th><th>解锁等级</th><th>状态</th></tr></thead>
    <tbody>${STRATEGY_ROWS}</tbody>
  </table>
</div>

<div class="card-full">
  <h2>JWT 令牌</h2>
  <div style="display:flex;flex-direction:column;gap:8px">
    <div style="font-size:12px;color:#8b949e" id="jwt-info">加载中…</div>
    <div style="display:flex;gap:8px">
      <input id="jwt-inp" placeholder="粘贴新的 JWT token（eyJ…）" style="flex:1;background:#161b22;border:1px solid #30363d;border-radius:5px;color:#e6edf3;padding:7px 10px;font-size:13px;outline:none;font-family:monospace">
      <button onclick="submitJwt()" style="background:#1f6feb;border:none;border-radius:5px;color:#fff;padding:7px 16px;cursor:pointer;font-size:13px;white-space:nowrap">更新</button>
    </div>
    <div id="jwt-msg" style="font-size:12px;min-height:18px"></div>
  </div>
</div>

<div class="card-full">
  <h2>实时日志</h2>
  <div id="logbox"></div>
</div>

<script>
const badge = document.getElementById("badge");
const logbox = document.getElementById("logbox");
const cfArea = document.getElementById("cf-area");
const vmsg  = document.getElementById("vmsg");
let tsId = null, challengeOn = false;
let nextTickAt = 0, countdownTimer = null;

function startCountdown(intervalMs) {
  if (countdownTimer) clearInterval(countdownTimer);
  nextTickAt = Date.now() + intervalMs;
  const el = document.getElementById("s-interval");
  countdownTimer = setInterval(() => {
    const rem = nextTickAt - Date.now();
    if (rem <= 0) { el.textContent = "0s"; clearInterval(countdownTimer); return; }
    const s = Math.round(rem / 1000);
    el.textContent = s >= 60 ? Math.floor(s / 60) + "m " + (s % 60) + "s" : s + "s";
  }, 500);
}

const es = new EventSource("/events");
es.onopen  = () => setBadge(false);
es.onerror = () => { badge.textContent = "连接断开"; badge.className = ""; };
es.onmessage = e => {
  const d = JSON.parse(e.data);
  if (d.t === "s") onStatus(d);
  else if (d.t === "l") addLog(d.line);
};

function fmt(n) { return n == null ? "-" : Number(n).toLocaleString("zh-CN"); }
function fmtMs(ms) {
  if (!ms) return "-";
  const s = Math.round(ms / 1000);
  return s >= 60 ? Math.floor(s / 60) + "m " + (s % 60) + "s" : s + "s";
}

function setBadge(isChallenge) {
  badge.textContent = isChallenge ? "⚠ 需要人机验证" : "✓ 运行中";
  badge.className   = isChallenge ? "challenge" : "running";
}

function onStatus(s) {
  if (s.lv    != null) document.getElementById("s-lv").textContent       = s.lv;
  if (s.coins != null) document.getElementById("s-coins").textContent     = fmt(s.coins);
  if (s.exp   != null) document.getElementById("s-exp").textContent       = fmt(s.exp);
  if (s.loopNum != null) document.getElementById("s-loop").textContent    = "#" + s.loopNum;
  if (s.crop)           document.getElementById("s-crop").textContent     = s.crop;
  if (s.nextIntervalMs != null) startCountdown(s.nextIntervalMs);

  const isChallenge = Boolean(s.challenge);
  setBadge(isChallenge);

  if (isChallenge !== challengeOn) {
    challengeOn = isChallenge;
    cfArea.style.display = isChallenge ? "block" : "none";
    if (isChallenge) {
      vmsg.className = "err";
      vmsg.textContent = "⚠ 触发 Cloudflare 验证，请在下方完成人机校验";
      if (window.__tsLoaded) renderWidget();
    } else {
      vmsg.className = "ok";
      vmsg.textContent = s.verifyMsg || "✅ 自动模式：CapSolver 处理中，无需操作";
    }
  }
  if (s.verifyMsg && !isChallenge) {
    vmsg.className = "ok";
    vmsg.textContent = s.verifyMsg;
  }
}

function renderWidget() {
  if (tsId != null) { try { window.turnstile.remove(tsId); } catch {} tsId = null; }
  document.getElementById("cf-widget").innerHTML = "";
  tsId = window.turnstile.render("#cf-widget", {
    sitekey: "0x4AAAAAADmotcK0lqq38R89",
    theme: "dark",
    callback: t => postToken(t),
    "expired-callback": () => { if (tsId != null) window.turnstile.reset(tsId); },
    "error-callback": () => { if (tsId != null) window.turnstile.reset(tsId); },
  });
}

function postToken(token) {
  fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).then(r => r.json()).then(() => {
    vmsg.className = "ok";
    vmsg.textContent = "✅ Token 已提交，等待 bot 处理…";
  });
}

function submitManual() {
  const t = document.getElementById("token-inp").value.trim();
  if (!t) return;
  postToken(t);
  document.getElementById("token-inp").value = "";
}

function logClass(line) {
  if (line.includes("[tick"))       return "tick";
  if (line.includes("[sell]"))      return "sell";
  if (line.includes("[capsolver]") || line.includes("[challenge]")) return "cap";
  if (line.includes("[connected]") || line.includes("✅") || line.includes("[startup]")) return "ok";
  if (line.includes("[daily]") || line.includes("[steal]") || line.includes("[visit]")) return "daily";
  if (line.startsWith("⚠") || line.includes("[warn]")) return "warn";
  if (line.startsWith("✗") || line.includes("error") || line.includes("Error")) return "err";
  return "";
}

function addLog(line) {
  const div = document.createElement("div");
  div.className = "ll " + logClass(line);
  div.textContent = line;
  logbox.appendChild(div);
  while (logbox.children.length > 200) logbox.removeChild(logbox.firstChild);
  logbox.scrollTop = logbox.scrollHeight;
}

function submitJwt() {
  const jwt = document.getElementById("jwt-inp").value.trim();
  const msg = document.getElementById("jwt-msg");
  if (!jwt || jwt.split(".").length !== 3) {
    msg.style.color = "#f85149"; msg.textContent = "❌ 格式不对，JWT 应为 eyJ… 三段式"; return;
  }
  fetch("/api/jwt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jwt }) })
    .then(r => r.json()).then(d => {
      if (d.ok) {
        msg.style.color = "#3fb950"; msg.textContent = "✅ 已保存，bot 下次循环自动生效";
        document.getElementById("jwt-inp").value = "";
        loadJwtInfo();
      } else {
        msg.style.color = "#f85149"; msg.textContent = "❌ " + (d.error || "保存失败");
      }
    }).catch(() => { msg.style.color = "#f85149"; msg.textContent = "❌ 请求失败"; });
}

function loadJwtInfo() {
  fetch("/api/jwt").then(r => r.json()).then(d => {
    document.getElementById("jwt-info").textContent = d.preview || "";
  }).catch(() => {});
}
loadJwtInfo();

window.onTurnstileLoad = () => {
  window.__tsLoaded = true;
  if (challengeOn) renderWidget();
};
const sc = document.createElement("script");
sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
sc.async = true;
document.head.appendChild(sc);
</script>
</body>
</html>`;
