import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HP_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HP_FILE, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({ token, humanPass });

console.log("Connecting...");
await client.connect();
console.log("Connected and authenticated.");

// Call 1: buy_tool with no args
console.log("\n--- buy_tool {} ---");
let result1;
try {
  result1 = await client.action("buy_tool", {});
  console.log("Result:", JSON.stringify(result1, null, 2));
} catch (err) {
  result1 = { error: err.message, serverPayload: err.serverPayload };
  console.log("Error:", err.message);
  if (err.serverPayload) console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
}

// Call 2: buy_tool with {page:1}
console.log("\n--- buy_tool {page:1} ---");
let result2;
try {
  result2 = await client.action("buy_tool", { page: 1 });
  console.log("Result:", JSON.stringify(result2, null, 2));
} catch (err) {
  result2 = { error: err.message, serverPayload: err.serverPayload };
  console.log("Error:", err.message);
  if (err.serverPayload) console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
}

client.close();
console.log("\nDone.");
