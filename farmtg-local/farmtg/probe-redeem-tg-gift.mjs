import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HUMAN_PASS_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_FILE, "utf8").trim();

console.log("JWT:", token.slice(0, 40) + "...");
console.log("HumanPass:", humanPass.slice(0, 20) + "...");

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({ token, humanPass });

console.log("\nConnecting to WebSocket...");
await client.connect();
console.log("Connected and authenticated.\n");

// Call 1: redeem_tg_gift with empty data
console.log("--- Calling action('redeem_tg_gift', {}) ---");
try {
  const result1 = await client.action("redeem_tg_gift", {});
  console.log("Result 1:", JSON.stringify(result1, null, 2));
} catch (err) {
  console.log("Error 1:", err.message);
  if (err.serverPayload) {
    console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  }
}

// Call 2: redeem_tg_gift with page:1
console.log("\n--- Calling action('redeem_tg_gift', {page:1}) ---");
try {
  const result2 = await client.action("redeem_tg_gift", { page: 1 });
  console.log("Result 2:", JSON.stringify(result2, null, 2));
} catch (err) {
  console.log("Error 2:", err.message);
  if (err.serverPayload) {
    console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  }
}

client.close();
console.log("\nDone. Connection closed.");
