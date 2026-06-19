import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HP_FILE  = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token     = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HP_FILE,  "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({ token, humanPass, wsUrl: "wss://farmtg.top/api/game/ws" });

console.log("Connecting...");
await client.connect();
console.log("Connected and authenticated.");

// Call 1: sell_fruits with empty data
let result1, error1;
try {
  result1 = await client.action("sell_fruits", {});
  console.log("sell_fruits({}) result:", JSON.stringify(result1, null, 2));
} catch (e) {
  error1 = { message: e.message, code: e.code, serverPayload: e.serverPayload };
  console.log("sell_fruits({}) error:", JSON.stringify(error1, null, 2));
}

// Call 2: sell_fruits with {page:1}
let result2, error2;
try {
  result2 = await client.action("sell_fruits", { page: 1 });
  console.log("sell_fruits({page:1}) result:", JSON.stringify(result2, null, 2));
} catch (e) {
  error2 = { message: e.message, code: e.code, serverPayload: e.serverPayload };
  console.log("sell_fruits({page:1}) error:", JSON.stringify(error2, null, 2));
}

client.close();
console.log("Done.");

const output = {
  "sell_fruits({})":     result1 ?? { error: error1 },
  "sell_fruits({page:1})": result2 ?? { error: error2 },
};
console.log("FINAL_OUTPUT:", JSON.stringify(output));
