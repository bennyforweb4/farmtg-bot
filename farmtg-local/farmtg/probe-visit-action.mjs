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
});

console.log("Connecting...");
await client.connect();
console.log("Connected and authenticated.");

const ACTION = "/api/game/visit (REST POST)";

let result1, result2, error1, error2;

console.log(`\nCalling action("${ACTION}", {})...`);
try {
  result1 = await client.action(ACTION, {});
  console.log("Result 1:", JSON.stringify(result1, null, 2));
} catch (e) {
  error1 = { message: e.message, code: e.code, serverPayload: e.serverPayload };
  console.log("Error 1:", JSON.stringify(error1, null, 2));
}

console.log(`\nCalling action("${ACTION}", {page:1})...`);
try {
  result2 = await client.action(ACTION, { page: 1 });
  console.log("Result 2:", JSON.stringify(result2, null, 2));
} catch (e) {
  error2 = { message: e.message, code: e.code, serverPayload: e.serverPayload };
  console.log("Error 2:", JSON.stringify(error2, null, 2));
}

client.close();
console.log("\nDone.");

const output = {
  call1: { args: {}, result: result1, error: error1 },
  call2: { args: { page: 1 }, result: result2, error: error2 },
};
console.log("\n=== FINAL OUTPUT ===");
console.log(JSON.stringify(output, null, 2));
