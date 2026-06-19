import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HUMAN_PASS_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_FILE, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
  logger: {
    log: (...a) => console.error("[log]", ...a),
    warn: (...a) => console.error("[warn]", ...a),
    error: (...a) => console.error("[error]", ...a),
  },
});

console.error("Connecting...");
await client.connect();
console.error("Connected and authenticated.");

const results = {};

try {
  console.error("Calling action get_tg_gifts {}...");
  const r1 = await client.action("get_tg_gifts", {});
  results.get_tg_gifts_empty = r1;
  console.error("Got response for get_tg_gifts {}");
} catch (e) {
  results.get_tg_gifts_empty_error = { message: e.message, code: e.code, serverPayload: e.serverPayload };
  console.error("Error for get_tg_gifts {}:", e.message);
}

try {
  console.error("Calling action get_tg_gifts {page:1}...");
  const r2 = await client.action("get_tg_gifts", { page: 1 });
  results.get_tg_gifts_page1 = r2;
  console.error("Got response for get_tg_gifts {page:1}");
} catch (e) {
  results.get_tg_gifts_page1_error = { message: e.message, code: e.code, serverPayload: e.serverPayload };
  console.error("Error for get_tg_gifts {page:1}:", e.message);
}

client.close();

console.log(JSON.stringify(results, null, 2));
