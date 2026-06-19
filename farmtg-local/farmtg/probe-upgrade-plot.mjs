import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HUMAN_PASS_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_FILE, "utf8").trim();

console.log("JWT (first 40 chars):", token.slice(0, 40) + "...");
console.log("human_pass:", humanPass.slice(0, 20) + "...");

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
  logger: {
    log: (...a) => console.log("[log]", ...a),
    warn: (...a) => console.warn("[warn]", ...a),
    error: (...a) => console.error("[error]", ...a),
  },
});

console.log("\nConnecting...");
await client.connect();
console.log("Connected and authenticated.");

// --- call 1: upgrade_plot with empty data ---
console.log("\n--- action('upgrade_plot', {}) ---");
let result1;
try {
  result1 = await client.action("upgrade_plot", {});
  console.log("Response:", JSON.stringify(result1, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  if (err.serverPayload) {
    console.error("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  }
  result1 = { error: err.message, serverPayload: err.serverPayload };
}

// --- call 2: upgrade_plot with page:1 ---
console.log("\n--- action('upgrade_plot', {page:1}) ---");
let result2;
try {
  result2 = await client.action("upgrade_plot", { page: 1 });
  console.log("Response:", JSON.stringify(result2, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  if (err.serverPayload) {
    console.error("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  }
  result2 = { error: err.message, serverPayload: err.serverPayload };
}

client.close();
console.log("\nDone.");
console.log("\n=== SUMMARY ===");
console.log("upgrade_plot {}:", JSON.stringify(result1, null, 2));
console.log("upgrade_plot {page:1}:", JSON.stringify(result2, null, 2));
