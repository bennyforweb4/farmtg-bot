import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HUMAN_PASS_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_FILE, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
});

console.log("Connecting...");
await client.connect();
console.log("Connected and authenticated.");

let result1, result2, err1, err2;

try {
  console.log("\n--- Calling action('get_pet_inventory', {}) ---");
  result1 = await client.action("get_pet_inventory", {});
  console.log("Result 1:", JSON.stringify(result1, null, 2));
} catch (e) {
  err1 = e;
  console.error("Error 1:", e.message);
  if (e.serverPayload) {
    console.error("Server payload:", JSON.stringify(e.serverPayload, null, 2));
  }
}

try {
  console.log("\n--- Calling action('get_pet_inventory', {page:1}) ---");
  result2 = await client.action("get_pet_inventory", { page: 1 });
  console.log("Result 2:", JSON.stringify(result2, null, 2));
} catch (e) {
  err2 = e;
  console.error("Error 2:", e.message);
  if (e.serverPayload) {
    console.error("Server payload:", JSON.stringify(e.serverPayload, null, 2));
  }
}

client.close();
console.log("\nDone.");
