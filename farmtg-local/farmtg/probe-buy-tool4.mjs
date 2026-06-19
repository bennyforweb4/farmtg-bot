import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HP_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HP_FILE, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);
const client = new FarmtgClient({ token, humanPass });

console.error("Connecting...");
await client.connect();
console.error("Connected.");

async function probe(label, action, data) {
  try {
    const result = await client.action(action, data);
    console.error(`[OK] ${label}`);
    return { ok: true, result };
  } catch (err) {
    console.error(`[ERR] ${label}: ${err.message}`);
    return { ok: false, error: err.message, serverPayload: err.serverPayload };
  }
}

const results = {};

// Try to discover the tool catalog through various action names
const discoverActions = [
  ["get_tool_shop", {}],
  ["tool_shop", {}],
  ["get_shop_items", {}],
  ["shop", {}],
  ["shop_items", {}],
  ["get_tool_catalog", {}],
  ["tool_catalog", {}],
  ["tools", {}],
  ["get_user_tools", {}],
  ["user_tools", {}],
  ["get_tool_info", {}],
  ["list_tools", {}],
];

for (const [action, data] of discoverActions) {
  results[action] = await probe(action, action, data);
}

// Also try buy_tool with MongoDB-style hex IDs extracted from the game's crop IDs pattern
// (crop IDs look like "69f85a3a2c24a6892a6110bf" - MongoDB ObjectID format)
// The tool IDs might follow the same scheme — let's try some common ones
const mongoIdAttempts = [
  "000000000000000000000001",
  "000000000000000000000002",
  "000000000000000000000003",
];
for (const id of mongoIdAttempts) {
  results[`buy_tool tool_id=${id}`] = await probe(`buy_tool tool_id=${id}`, "buy_tool", { tool_id: id });
}

// Try buy_tool with quantity field (maybe it needs qty)
results["buy_tool qty"] = await probe("buy_tool qty=1", "buy_tool", { qty: 1 });
results["buy_tool count"] = await probe("buy_tool count=1", "buy_tool", { count: 1 });
results["buy_tool amount"] = await probe("buy_tool amount=1", "buy_tool", { amount: 1 });

client.close();
console.log(JSON.stringify(results, null, 2));
