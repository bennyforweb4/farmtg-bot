import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HP_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_PATH, "utf8").trim();
const humanPass = readFileSync(HP_PATH, "utf8").trim();

console.log("JWT (first 40 chars):", token.slice(0, 40) + "...");
console.log("human_pass (first 20 chars):", humanPass.slice(0, 20) + "...");

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
  logger: console,
});

console.log("\nConnecting...");
await client.connect();
console.log("Connected and authenticated.\n");

// Call force_clear with empty data
console.log("=== action('force_clear', {}) ===");
let result1;
try {
  result1 = await client.action("force_clear", {});
  console.log("Result:", JSON.stringify(result1, null, 2));
} catch (err) {
  console.log("Error:", err.message);
  if (err.serverPayload) {
    console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  }
}

// Call force_clear with page:1
console.log("\n=== action('force_clear', {page:1}) ===");
let result2;
try {
  result2 = await client.action("force_clear", { page: 1 });
  console.log("Result:", JSON.stringify(result2, null, 2));
} catch (err) {
  console.log("Error:", err.message);
  if (err.serverPayload) {
    console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  }
}

client.close();
console.log("\nDone.");
