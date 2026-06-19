import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HP_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HP_FILE, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
  logger: { warn: console.warn, log: console.log },
});

console.log("Connecting...");
await client.connect();
console.log("Connected and authenticated.");

const results = {};

try {
  console.log("Calling action ping {}...");
  const r1 = await client.action("ping", {});
  results.ping_empty = r1;
  console.log("ping {} response:", JSON.stringify(r1, null, 2));
} catch (e) {
  results.ping_empty = { error: e.message, serverPayload: e.serverPayload };
  console.log("ping {} error:", e.message, e.serverPayload ? JSON.stringify(e.serverPayload) : "");
}

try {
  console.log("Calling action ping {page:1}...");
  const r2 = await client.action("ping", { page: 1 });
  results.ping_page1 = r2;
  console.log("ping {page:1} response:", JSON.stringify(r2, null, 2));
} catch (e) {
  results.ping_page1 = { error: e.message, serverPayload: e.serverPayload };
  console.log("ping {page:1} error:", e.message, e.serverPayload ? JSON.stringify(e.serverPayload) : "");
}

client.close();
console.log("FINAL RESULTS:", JSON.stringify(results, null, 2));
