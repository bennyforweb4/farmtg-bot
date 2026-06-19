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

async function probe(label, action, data) {
  console.log(`\n--- ${label} ---`);
  try {
    const result = await client.action(action, data);
    console.log("OK:", JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.log("Error:", err.message);
    if (err.serverPayload) console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
    return { error: err.message, serverPayload: err.serverPayload };
  }
}

// Try various tool_id values
await probe('buy_tool {tool_id:1}', 'buy_tool', { tool_id: 1 });
await probe('buy_tool {tool_id:2}', 'buy_tool', { tool_id: 2 });
await probe('buy_tool {tool_id:3}', 'buy_tool', { tool_id: 3 });
await probe('buy_tool {id:1}', 'buy_tool', { id: 1 });
await probe('buy_tool {type:"weed"}', 'buy_tool', { type: "weed" });
await probe('buy_tool {type:"pest"}', 'buy_tool', { type: "pest" });
await probe('get_tools {}', 'get_tools', {});
await probe('get_shop {}', 'get_shop', {});
await probe('get_store {}', 'get_store', {});
await probe('shop_list {}', 'shop_list', {});
await probe('tool_list {}', 'tool_list', {});

client.close();
console.log("\nDone.");
