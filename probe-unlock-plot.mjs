import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HUMAN_PASS_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_PATH, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_PATH, "utf8").trim();

console.log("JWT (first 40 chars):", token.slice(0, 40) + "...");
console.log("human_pass:", humanPass.slice(0, 20) + "...");

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
  logger: {
    warn: (...args) => console.warn("[warn]", ...args),
    log: (...args) => console.log("[log]", ...args),
    error: (...args) => console.error("[error]", ...args),
  },
});

console.log("\nConnecting to WebSocket...");
try {
  await client.connect();
  console.log("Connected and authenticated!\n");
} catch (err) {
  console.error("Connection/auth failed:", err.message);
  process.exit(1);
}

// Call 1: unlock_plot with empty data
console.log("=== Calling action('unlock_plot', {}) ===");
try {
  const result1 = await client.action("unlock_plot", {});
  console.log("Result:", JSON.stringify(result1, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  if (err.serverPayload) {
    console.error("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  }
}

// Small delay
await new Promise(r => setTimeout(r, 1000));

// Call 2: unlock_plot with {page: 1}
console.log("\n=== Calling action('unlock_plot', {page: 1}) ===");
try {
  const result2 = await client.action("unlock_plot", { page: 1 });
  console.log("Result:", JSON.stringify(result2, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  if (err.serverPayload) {
    console.error("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  }
}

client.close();
console.log("\nDone. Connection closed.");
