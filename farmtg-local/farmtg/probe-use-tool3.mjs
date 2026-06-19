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
await client.waitForPlots({ timeoutMs: 10000 });

// Get inventory first
console.log("\nFetching inventory...");
const inventory = await client.refreshInventory();
console.log("Full inventory:", JSON.stringify(inventory, null, 2));

// Get all items (may have tools)
try {
  console.log('\nCalling action("get_inventory", { type: "tool" })...');
  const r = await client.action("get_inventory", { type: "tool" });
  console.log("Result:", JSON.stringify(r, null, 2));
} catch (err) {
  console.log("Error:", err.message);
  if (err.serverPayload) console.log("Payload:", JSON.stringify(err.serverPayload, null, 2));
}

// Try get_inventory with page
try {
  console.log('\nCalling action("get_inventory", { page: 1 })...');
  const r = await client.action("get_inventory", { page: 1 });
  console.log("Result:", JSON.stringify(r, null, 2));
} catch (err) {
  console.log("Error:", err.message);
  if (err.serverPayload) console.log("Payload:", JSON.stringify(err.serverPayload, null, 2));
}

// If we have inventory items, try using them as tool_id
if (inventory && inventory.length > 0) {
  console.log("\nInventory items available:");
  for (const item of inventory) {
    console.log(" -", JSON.stringify(item));
  }

  // Try use_tool with actual item IDs from inventory
  for (const item of inventory.slice(0, 3)) {
    const itemId = item.id || item._id || item.item_id || item.tool_id;
    if (!itemId) continue;

    try {
      console.log(`\nCalling action("use_tool", { plot_index: 0, tool_id: "${itemId}" })...`);
      const r = await client.action("use_tool", { plot_index: 0, tool_id: itemId });
      console.log("Result:", JSON.stringify(r, null, 2));
    } catch (err) {
      console.log("Error:", err.message);
      if (err.serverPayload) console.log("Payload:", JSON.stringify(err.serverPayload, null, 2));
    }

    // Also try with item_id field name
    try {
      console.log(`\nCalling action("use_tool", { plot_index: 0, item_id: "${itemId}" })...`);
      const r = await client.action("use_tool", { plot_index: 0, item_id: itemId });
      console.log("Result:", JSON.stringify(r, null, 2));
    } catch (err) {
      console.log("Error:", err.message);
      if (err.serverPayload) console.log("Payload:", JSON.stringify(err.serverPayload, null, 2));
    }
  }
}

client.close();
console.log("\nDone.");
