import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const jwt = readFileSync(
  "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt",
  "utf8"
).trim();

const humanPass = readFileSync(
  "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass",
  "utf8"
).trim();

const clientUrl = pathToFileURL(
  "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs"
);

const { FarmtgClient } = await import(clientUrl.href);

const client = new FarmtgClient({
  token: jwt,
  wsUrl: "wss://farmtg.top/api/game/ws",
  humanPass,
});

console.log("Connecting...");
await client.connect();
console.log("Connected and authenticated.");

let result1, result2;

try {
  console.log('Calling action("get_decor_inventory", {})...');
  result1 = await client.action("get_decor_inventory", {});
  console.log("Result 1 (no args):", JSON.stringify(result1, null, 2));
} catch (err) {
  console.error("Error result1:", err.message, err.serverPayload ? JSON.stringify(err.serverPayload, null, 2) : "");
  result1 = { error: err.message, serverPayload: err.serverPayload };
}

try {
  console.log('Calling action("get_decor_inventory", {page:1})...');
  result2 = await client.action("get_decor_inventory", { page: 1 });
  console.log("Result 2 (page:1):", JSON.stringify(result2, null, 2));
} catch (err) {
  console.error("Error result2:", err.message, err.serverPayload ? JSON.stringify(err.serverPayload, null, 2) : "");
  result2 = { error: err.message, serverPayload: err.serverPayload };
}

client.close();

console.log("\n=== FINAL RESULTS ===");
console.log("result1:", JSON.stringify(result1, null, 2));
console.log("result2:", JSON.stringify(result2, null, 2));
