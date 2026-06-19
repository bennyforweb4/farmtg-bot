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
    info: (...a) => console.error("[info]", ...a),
  },
});

console.error("Connecting...");
await client.connect();
console.error("Connected. Calling get_tool_inventory with {}...");

const results = {};

try {
  const r1 = await client.action("get_tool_inventory", {});
  results["get_tool_inventory({})"] = r1;
  console.error("Done call 1");
} catch (e) {
  results["get_tool_inventory({})"] = { error: e.message, code: e.code, serverPayload: e.serverPayload };
}

try {
  const r2 = await client.action("get_tool_inventory", { page: 1 });
  results["get_tool_inventory({page:1})"] = r2;
  console.error("Done call 2");
} catch (e) {
  results["get_tool_inventory({page:1})"] = { error: e.message, code: e.code, serverPayload: e.serverPayload };
}

client.close();

console.log(JSON.stringify(results, null, 2));
