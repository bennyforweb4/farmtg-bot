import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HUMAN_PASS_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_FILE, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({ token, humanPass });

console.log("Connecting...");
await client.connect();
console.log("Connected. Waiting for plots...");
const state = await client.waitForPlots({ timeoutMs: 10000 });
console.log("User unlocked_plots:", state.user?.unlocked_plots);
console.log("Plots count:", state.plots.length);
console.log("Plots sample:", JSON.stringify(state.plots.slice(0, 3), null, 2));

const results = {};

// Try plot_index 0
for (const plotIdx of [0, 1, 2]) {
  try {
    console.log(`\nCalling action("use_tool", { plot_index: ${plotIdx} })...`);
    const r = await client.action("use_tool", { plot_index: plotIdx });
    console.log(`Result [plot_index=${plotIdx}]:`, JSON.stringify(r, null, 2));
    results[`plot_index_${plotIdx}`] = r;
    break; // if success, that's enough info
  } catch (err) {
    console.log(`Error [plot_index=${plotIdx}]:`, err.message);
    if (err.serverPayload) console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
    results[`plot_index_${plotIdx}`] = { error: err.message, serverPayload: err.serverPayload };
  }
}

// Also try with tool_id
try {
  console.log('\nCalling action("use_tool", { plot_index: 0, tool_id: 1 })...');
  const r = await client.action("use_tool", { plot_index: 0, tool_id: 1 });
  console.log("Result:", JSON.stringify(r, null, 2));
  results["with_tool_id_1"] = r;
} catch (err) {
  console.log("Error:", err.message);
  if (err.serverPayload) console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  results["with_tool_id_1"] = { error: err.message, serverPayload: err.serverPayload };
}

// Try get_tools to see available tools
try {
  console.log('\nCalling action("get_tools", {})...');
  const r = await client.action("get_tools", {});
  console.log("Result:", JSON.stringify(r, null, 2));
  results["get_tools"] = r;
} catch (err) {
  console.log("Error:", err.message);
  if (err.serverPayload) console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  results["get_tools"] = { error: err.message, serverPayload: err.serverPayload };
}

// Try get_tool_list
try {
  console.log('\nCalling action("get_tool_list", {})...');
  const r = await client.action("get_tool_list", {});
  console.log("Result:", JSON.stringify(r, null, 2));
  results["get_tool_list"] = r;
} catch (err) {
  console.log("Error:", err.message);
  if (err.serverPayload) console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  results["get_tool_list"] = { error: err.message, serverPayload: err.serverPayload };
}

client.close();
console.log("\n=== ALL RESULTS ===");
console.log(JSON.stringify(results, null, 2));
