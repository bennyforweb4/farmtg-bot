import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = String.raw`C:\Users\benny\Documents\Codex\2026-06-19\66-154-109-189-root-71ob44ls5y\farmtg-local\farmtg\.farmtg_jwt`;
const HUMAN_PASS_FILE = String.raw`C:\Users\benny\Documents\Codex\2026-06-19\66-154-109-189-root-71ob44ls5y\farmtg-local\farmtg\.farmtg_human_pass`;
const CLIENT_PATH = String.raw`C:\Users\benny\Documents\Codex\2026-06-19\66-154-109-189-root-71ob44ls5y\farmtg-local\farmtg\server\farmtg-client.mjs`;

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_FILE, "utf8").trim();

console.log("JWT (first 30 chars):", token.slice(0, 30) + "...");
console.log("human_pass:", humanPass.slice(0, 20) + "...");

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
  logger: {
    warn: (msg) => console.warn("[WARN]", msg),
    info: (msg) => console.info("[INFO]", msg),
    log: (msg) => console.log("[LOG]", msg),
    error: (msg) => console.error("[ERR]", msg),
  },
});

console.log("Connecting...");
try {
  await client.connect();
  console.log("Connected and authenticated.");
} catch (err) {
  console.error("Connection failed:", err.message);
  process.exit(1);
}

// Call 1: get_fruit_inventory with no extra args
let result1, result2;

try {
  console.log("\n--- Calling action('get_fruit_inventory', {}) ---");
  result1 = await client.action("get_fruit_inventory", {});
  console.log("Result 1:", JSON.stringify(result1, null, 2));
} catch (err) {
  console.error("Result 1 error:", err.message);
  if (err.serverPayload) {
    console.error("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  }
  result1 = { error: err.message, serverPayload: err.serverPayload };
}

// Call 2: get_fruit_inventory with page:1
try {
  console.log("\n--- Calling action('get_fruit_inventory', {page:1}) ---");
  result2 = await client.action("get_fruit_inventory", { page: 1 });
  console.log("Result 2:", JSON.stringify(result2, null, 2));
} catch (err) {
  console.error("Result 2 error:", err.message);
  if (err.serverPayload) {
    console.error("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  }
  result2 = { error: err.message, serverPayload: err.serverPayload };
}

client.close();
console.log("\nConnection closed.");

console.log("\n=== FINAL RESULTS ===");
console.log("result1:", JSON.stringify(result1, null, 2));
console.log("result2:", JSON.stringify(result2, null, 2));
