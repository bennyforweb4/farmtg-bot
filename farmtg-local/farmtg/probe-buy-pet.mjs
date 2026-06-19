import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const PASS_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(PASS_FILE, "utf8").trim();

console.log("JWT:", token.slice(0, 30) + "...");
console.log("human_pass:", humanPass.slice(0, 20) + "...");

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
});

console.log("\nConnecting...");
await client.connect();
console.log("Connected and authenticated.\n");

// Call 1: buy_pet with empty data
let result1, error1;
try {
  result1 = await client.action("buy_pet", {});
  console.log("buy_pet {} result:", JSON.stringify(result1, null, 2));
} catch (e) {
  error1 = { message: e.message, code: e.code, serverPayload: e.serverPayload };
  console.log("buy_pet {} error:", JSON.stringify(error1, null, 2));
}

// Call 2: buy_pet with {page:1}
let result2, error2;
try {
  result2 = await client.action("buy_pet", { page: 1 });
  console.log("buy_pet {page:1} result:", JSON.stringify(result2, null, 2));
} catch (e) {
  error2 = { message: e.message, code: e.code, serverPayload: e.serverPayload };
  console.log("buy_pet {page:1} error:", JSON.stringify(error2, null, 2));
}

client.close();
console.log("\nConnection closed.");

console.log("\n=== SUMMARY ===");
console.log(JSON.stringify({
  call1_buy_pet_empty: result1 ?? error1,
  call2_buy_pet_page1: result2 ?? error2,
}, null, 2));
