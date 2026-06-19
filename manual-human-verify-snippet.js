(async () => {
  const SITE_KEY = "0x4AAAAAADmotcK0lqq38R89";
  const PASS_KEY = "farm_human_pass";
  const EXPIRE_KEY = "farm_human_pass_expire_at";
  const CAPTURE_URL = "http://127.0.0.1:17771/submit";

  function log(...args) {
    console.log("[farmtg-human-verify]", ...args);
  }

  function findJwt(value) {
    if (typeof value === "string") {
      return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
        ? value
        : "";
    }
    if (!value || typeof value !== "object") return "";
    for (const child of Object.values(value)) {
      const found = findJwt(child);
      if (found) return found;
    }
    return "";
  }

  function findHumanPass(value) {
    if (typeof value === "string") return "";
    if (!value || typeof value !== "object") return "";
    if (typeof value.human_pass === "string") return value.human_pass;
    if (typeof value.humanPass === "string") return value.humanPass;
    for (const child of Object.values(value)) {
      const found = findHumanPass(child);
      if (found) return found;
    }
    return "";
  }

  async function loadTurnstile() {
    if (window.turnstile) return;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-turnstile="1"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("turnstile script failed")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = "1";
      script.onload = resolve;
      script.onerror = () => reject(new Error("turnstile script failed"));
      document.head.appendChild(script);
    });
  }

  async function runTurnstile() {
    await loadTurnstile();
    return await new Promise((resolve, reject) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:2147483647",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "background:rgba(0,0,0,.48)",
        "padding:16px",
      ].join(";");

      const box = document.createElement("div");
      box.style.cssText = [
        "min-width:280px",
        "max-width:360px",
        "width:100%",
        "background:#fff",
        "border-radius:14px",
        "padding:16px",
        "box-shadow:0 10px 30px rgba(0,0,0,.2)",
        "display:flex",
        "flex-direction:column",
        "gap:10px",
        "align-items:center",
      ].join(";");

      const title = document.createElement("div");
      title.textContent = "Complete verification";
      title.style.cssText = "font:700 16px system-ui;color:#1f2937;text-align:center;";

      const widget = document.createElement("div");
      const cancel = document.createElement("button");
      cancel.textContent = "Cancel";
      cancel.style.cssText = "border:0;background:#eef2f7;color:#334155;padding:8px 16px;border-radius:10px;font:14px system-ui;cursor:pointer;";

      box.append(title, widget, cancel);
      overlay.append(box);
      document.body.append(overlay);

      let widgetId = "";
      const cleanup = () => {
        if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
        overlay.remove();
      };

      cancel.onclick = () => {
        cleanup();
        reject(new Error("verification cancelled"));
      };

      widgetId = window.turnstile.render(widget, {
        sitekey: SITE_KEY,
        theme: "light",
        callback: (captchaToken) => {
          cleanup();
          resolve(captchaToken);
        },
        "error-callback": () => {
          cleanup();
          reject(new Error("turnstile error"));
        },
        "expired-callback": () => {
          cleanup();
          reject(new Error("turnstile expired"));
        },
        "timeout-callback": () => {
          cleanup();
          reject(new Error("turnstile timeout"));
        },
      });
    });
  }

  if (!/farmtg\.top$/i.test(location.hostname)) {
    throw new Error("Run this from the farmtg.top mini app frame, not the Cloudflare challenge frame.");
  }

  const initData = window.Telegram?.WebApp?.initData || "";
  if (!initData) {
    throw new Error("Telegram WebApp initData is missing. Open FarmTG from Telegram, then run this in the farmtg.top frame.");
  }

  log("logging in with Telegram initData");
  const loginRes = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ init_data: initData }),
  });
  const loginJson = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status} ${JSON.stringify(loginJson)}`);

  const jwt = findJwt(loginJson);
  if (!jwt) throw new Error(`JWT not found in login response: ${JSON.stringify(loginJson)}`);

  log("waiting for manual Turnstile verification");
  const captchaToken = await runTurnstile();

  log("exchanging captcha token for human_pass");
  const verifyRes = await fetch("/api/game/human-verify", {
    method: "POST",
    headers: {
      authorization: `Bearer ${jwt}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ captcha_token: captchaToken }),
  });
  const verifyJson = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok) throw new Error(`human-verify failed: ${verifyRes.status} ${JSON.stringify(verifyJson)}`);

  const humanPass = findHumanPass(verifyJson);
  const expiresIn = Number(verifyJson.expires_in || verifyJson.expiresIn || 0);
  if (!humanPass) throw new Error(`human_pass not found: ${JSON.stringify(verifyJson)}`);

  sessionStorage.setItem(PASS_KEY, humanPass);
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    sessionStorage.setItem(EXPIRE_KEY, String(Date.now() + Math.max(0, expiresIn - 5) * 1000));
  }

  try {
    await navigator.clipboard.writeText(humanPass);
    log("human_pass copied to clipboard");
  } catch (error) {
    log("clipboard copy failed; copy human_pass from the next log line", error);
  }

  try {
    const payload = new URLSearchParams({ payload: JSON.stringify(verifyJson) });
    const captureRes = await fetch(CAPTURE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: payload,
    });
    log("local capture response", captureRes.status, await captureRes.text());
  } catch (error) {
    log("local capture failed; paste the human_pass into http://127.0.0.1:17771/", error);
  }

  console.log("human_pass:", humanPass);
  console.log("human-verify response:", verifyJson);
  alert("FarmTG human_pass captured. If local capture failed, paste the copied value into http://127.0.0.1:17771/");
})();
