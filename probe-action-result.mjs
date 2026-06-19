import { pathToFileURL } from "url";
import { readFileSync } from "fs";

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
});

console.log("Connecting...");
try {
  await client.connect();
  console.log("Connected and authenticated.");
} catch (err) {
  console.error("Connection failed:", err.message);
  process.exit(1);
}

// Call action("result", {})
console.log("\n--- action('result', {}) ---");
try {
  const res1 = await client.action("result", {});
  console.log(JSON.stringify(res1, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  if (err.serverPayload) console.error("Server payload:", JSON.stringify(err.serverPayload, null, 2));
}

// Call action("result", {page: 1})
console.log("\n--- action('result', {page: 1}) ---");
try {
  const res2 = await client.action("result", { page: 1 });
  console.log(JSON.stringify(res2, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  if (err.serverPayload) console.error("Server payload:", JSON.stringify(err.serverPayload, null, 2));
}

client.close();
console.log("\nDone.");
