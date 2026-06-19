import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HP_FILE  = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token     = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HP_FILE,  "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({ token, humanPass, wsUrl: "wss://farmtg.top/api/game/ws" });

console.log("Connecting...");
await client.connect();
console.log("Connected and authenticated.");

// Fruit inventory item id from get_fruit_inventory
const FRUIT_ITEM_ID = "6a0fe3d3aa3968dc386d70e6";  // 大蒜 garlic, count=924
const CROP_ID       = "6a018d007bcc1d7f9f9b3bda";

const calls = [
  { label: 'sell_fruits({id})',           data: { id: FRUIT_ITEM_ID } },
  { label: 'sell_fruits({fruit_id})',     data: { fruit_id: FRUIT_ITEM_ID } },
  { label: 'sell_fruits({crop_id})',      data: { crop_id: CROP_ID } },
  { label: 'sell_fruits({id, count:1})',  data: { id: FRUIT_ITEM_ID, count: 1 } },
  { label: 'sell_fruits({fruit_id, count:1})', data: { fruit_id: FRUIT_ITEM_ID, count: 1 } },
];

const results = {};

for (const { label, data } of calls) {
  console.log(`\n--- ${label} ---`);
  try {
    const res = await client.action("sell_fruits", data);
    console.log("OK:", JSON.stringify(res, null, 2));
    results[label] = { ok: true, response: res };
  } catch (e) {
    const errObj = { message: e.message, code: e.code, serverPayload: e.serverPayload };
    console.log("ERROR:", JSON.stringify(errObj, null, 2));
    results[label] = { ok: false, error: errObj };
  }
}

client.close();
console.log("\nDone.");
console.log("FINAL_OUTPUT:", JSON.stringify(results, null, 2));
