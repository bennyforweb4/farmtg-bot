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

// First: get current inventory to see what items exist
const inv = await probe("get_inventory", "get_inventory", {});
results["get_inventory"] = inv;

// Get user state / plots
await client.waitForPlots({ timeoutMs: 5000 }).catch(() => {});
results["user_state"] = { user: client.state.user, plotCount: client.state.plots.length };

// Try buy_tool with various tool_type/tool_name combos that might exist in the game
const toolAttempts = [
  { tool_type: "weed" },
  { tool_type: "pest" },
  { tool_type: "worm" },
  { tool_type: "fertilizer" },
  { tool_type: "water" },
  { tool_type: "shovel" },
  { tool_name: "weed" },
  { tool_name: "pest" },
  { name: "weed" },
  { name: "pest" },
  // Numeric tool_id range
  { tool_id: "1" },
  { tool_id: "2" },
  { tool_id: "3" },
  { tool_id: "4" },
  { tool_id: "5" },
];

for (const data of toolAttempts) {
  const label = `buy_tool ${JSON.stringify(data)}`;
  results[label] = await probe(label, "buy_tool", data);
}

client.close();
console.log(JSON.stringify(results, null, 2));
