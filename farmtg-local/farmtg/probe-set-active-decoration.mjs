import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_PATH = "C:/Users/benny/Documents/Codex/2026-06-19/66-154-109-189-root-71ob44ls5y/farmtg-local/farmtg/.farmtg_jwt";
const HUMAN_PASS_PATH = "C:/Users/benny/Documents/Codex/2026-06-19/66-154-109-189-root-71ob44ls5y/farmtg-local/farmtg/.farmtg_human_pass";
const CLIENT_PATH = "C:/Users/benny/Documents/Codex/2026-06-19/66-154-109-189-root-71ob44ls5y/farmtg-local/farmtg/server/farmtg-client.mjs";

const token = readFileSync(JWT_PATH, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_PATH, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
  logger: console,
});

console.log("Connecting...");
await client.connect();
console.log("Connected and authenticated.");

let result1, result2, err1, err2;

// Call 1: set_active_decoration with empty data
console.log("\n--- Calling action('set_active_decoration', {}) ---");
try {
  result1 = await client.action("set_active_decoration", {});
  console.log("Result 1 (empty):", JSON.stringify(result1, null, 2));
} catch (e) {
  err1 = e;
  console.log("Error 1 (empty):", e.message);
  if (e.serverPayload) {
    console.log("Server payload 1:", JSON.stringify(e.serverPayload, null, 2));
  }
}

// Call 2: set_active_decoration with {page:1}
console.log("\n--- Calling action('set_active_decoration', {page:1}) ---");
try {
  result2 = await client.action("set_active_decoration", { page: 1 });
  console.log("Result 2 (page:1):", JSON.stringify(result2, null, 2));
} catch (e) {
  err2 = e;
  console.log("Error 2 (page:1):", e.message);
  if (e.serverPayload) {
    console.log("Server payload 2:", JSON.stringify(e.serverPayload, null, 2));
  }
}

client.close();
console.log("\nConnection closed.");

// Summary
console.log("\n=== SUMMARY ===");
console.log("Call 1 (empty):", err1 ? `ERROR: ${err1.message}` : JSON.stringify(result1));
console.log("Call 2 (page:1):", err2 ? `ERROR: ${err2.message}` : JSON.stringify(result2));
