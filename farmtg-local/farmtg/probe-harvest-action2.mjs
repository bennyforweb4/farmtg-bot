import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HUMAN_PASS_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_PATH, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_PATH, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
  logger: {
    log: (...args) => console.log("[client]", ...args),
    warn: (...args) => console.warn("[client warn]", ...args),
    error: (...args) => console.error("[client error]", ...args),
  },
});

console.log("Connecting...");
await client.connect();
console.log("Connected.");

// Try action("harvest", { human_pass }) like harvestAll does
console.log("\n--- action('harvest', { human_pass }) ---");
try {
  const result = await client.action("harvest", { human_pass: humanPass });
  console.log("Result:", JSON.stringify(result, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  if (err.serverPayload) {
    console.error("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  }
}

// Try harvest_all which is what the bot actually uses
console.log("\n--- action('harvest_all', { human_pass }) ---");
try {
  const result = await client.action("harvest_all", { human_pass: humanPass });
  console.log("Result:", JSON.stringify(result, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  if (err.serverPayload) {
    console.error("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  }
}

client.close();
console.log("\nDone.");
