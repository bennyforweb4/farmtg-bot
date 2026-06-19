import { pathToFileURL } from "url";
import { readFileSync } from "fs";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HUMAN_PASS_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_MODULE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_FILE, "utf8").trim();

console.log("JWT (first 40):", token.slice(0, 40) + "...");
console.log("human_pass (first 20):", humanPass.slice(0, 20) + "...");

const { FarmtgClient } = await import(pathToFileURL(CLIENT_MODULE).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
});

console.log("\nConnecting to WebSocket...");
await client.connect();
console.log("Connected and authenticated.");

// Call pong with no extra data
console.log("\n--- action('pong', {}) ---");
let result1;
try {
  result1 = await client.action("pong", {});
  console.log("Result:", JSON.stringify(result1, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  if (err.serverPayload) console.error("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  result1 = { error: err.message, serverPayload: err.serverPayload };
}

// Call pong with page:1
console.log("\n--- action('pong', {page:1}) ---");
let result2;
try {
  result2 = await client.action("pong", { page: 1 });
  console.log("Result:", JSON.stringify(result2, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  if (err.serverPayload) console.error("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  result2 = { error: err.message, serverPayload: err.serverPayload };
}

client.close();
console.log("\nConnection closed.");

// Output results as JSON for easy parsing
console.log("\n=== FINAL RESULTS ===");
console.log(JSON.stringify({ pong_no_args: result1, pong_page1: result2 }, null, 2));
