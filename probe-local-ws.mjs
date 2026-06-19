import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve("farmtg-local", "farmtg");
const jwt = readFileSync(join(root, ".farmtg_jwt"), "utf8").trim();
const humanPassPath = join(root, ".farmtg_human_pass");
const humanPass = existsSync(humanPassPath) ? readFileSync(humanPassPath, "utf8").trim() : "";

const headers = { Origin: "https://farmtg.top" };
if (humanPass) headers["X-Human-Pass"] = humanPass;

const ws = new WebSocket("wss://farmtg.top/api/game/ws", { headers });
const deadline = setTimeout(() => {
  console.log("[ws-probe] timeout");
  ws.close();
  process.exit(2);
}, 25_000);

ws.addEventListener("open", () => {
  console.log(`[ws-probe] open human_pass=${humanPass ? "present" : "absent"}`);
  ws.send(JSON.stringify({ type: "auth", token: jwt }));
});

ws.addEventListener("message", (event) => {
  console.log(`[ws-probe] message ${String(event.data).slice(0, 2000)}`);
});

ws.addEventListener("close", (event) => {
  clearTimeout(deadline);
  console.log(`[ws-probe] close code=${event.code} reason=${event.reason}`);
  process.exit(0);
});

ws.addEventListener("error", () => {
  clearTimeout(deadline);
  console.error("[ws-probe] error");
  process.exit(1);
});
