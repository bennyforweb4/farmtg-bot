import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const jwtPath = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const humanPassPath = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const clientPath = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(jwtPath, "utf8").trim();
const humanPass = readFileSync(humanPassPath, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(clientPath).href);

const client = new FarmtgClient({ token, humanPass });

console.log("Connecting...");
await client.connect();
console.log("Connected and authenticated.");

// Call action("error", {})
let result1, error1;
try {
  result1 = await client.action("error", {});
  console.log("action('error', {}) result:", JSON.stringify(result1, null, 2));
} catch (e) {
  error1 = { message: e.message, code: e.code, serverPayload: e.serverPayload };
  console.log("action('error', {}) threw:", JSON.stringify(error1, null, 2));
}

// Call action("error", {page:1})
let result2, error2;
try {
  result2 = await client.action("error", { page: 1 });
  console.log("action('error', {page:1}) result:", JSON.stringify(result2, null, 2));
} catch (e) {
  error2 = { message: e.message, code: e.code, serverPayload: e.serverPayload };
  console.log("action('error', {page:1}) threw:", JSON.stringify(error2, null, 2));
}

client.close();
console.log("Connection closed.");

console.log("\n--- SUMMARY ---");
console.log(JSON.stringify({
  "action('error', {})": result1 ?? { error: error1 },
  "action('error', {page:1})": result2 ?? { error: error2 },
}, null, 2));
