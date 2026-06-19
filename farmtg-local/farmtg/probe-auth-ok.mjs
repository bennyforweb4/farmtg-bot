import { pathToFileURL } from "url";
import { readFileSync } from "fs";

const clientPath = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";
const jwtPath = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const humanPassPath = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";

const { FarmtgClient } = await import(pathToFileURL(clientPath).href);

const token = readFileSync(jwtPath, "utf8").trim();
const humanPass = readFileSync(humanPassPath, "utf8").trim();

console.log("JWT (first 40 chars):", token.slice(0, 40) + "...");
console.log("human_pass:", humanPass.slice(0, 20) + "...");

// Patch handleMessage to log all raw messages too
const results = { raw: [] };

const client = new FarmtgClient({ token, humanPass, logger: console });

// Patch to capture raw messages
const origHandle = client.handleMessage.bind(client);
client.handleMessage = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    results.raw.push(parsed);
    console.log("[RAW MSG]", JSON.stringify(parsed));
  } catch {}
  return origHandle(raw);
};

console.log("\nConnecting to wss://farmtg.top/api/game/ws ...");

try {
  await client.connect();
  console.log("Connected and authenticated!\n");
} catch (err) {
  console.error("Connection/auth failed:", err.message);
  process.exit(1);
}

// Call action("auth_ok", {})
console.log('--- Calling action("auth_ok", {}) ---');
let res1 = null, err1 = null;
try {
  res1 = await client.action("auth_ok", {});
  console.log("Response:", JSON.stringify(res1, null, 2));
} catch (e) {
  err1 = { error: e.message, code: e.code, serverPayload: e.serverPayload };
  console.error("Error:", JSON.stringify(err1, null, 2));
}

// Call action("auth_ok", {page: 1})
console.log('\n--- Calling action("auth_ok", {page: 1}) ---');
let res2 = null, err2 = null;
try {
  res2 = await client.action("auth_ok", { page: 1 });
  console.log("Response:", JSON.stringify(res2, null, 2));
} catch (e) {
  err2 = { error: e.message, code: e.code, serverPayload: e.serverPayload };
  console.error("Error:", JSON.stringify(err2, null, 2));
}

client.close();

console.log("\n=== SUMMARY ===");
console.log("action('auth_ok', {}):", res1 ? JSON.stringify(res1) : JSON.stringify(err1));
console.log("action('auth_ok', {page:1}):", res2 ? JSON.stringify(res2) : JSON.stringify(err2));
console.log("All raw messages received:", JSON.stringify(results.raw, null, 2));
