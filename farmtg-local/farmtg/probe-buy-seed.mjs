import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const BASE = "C:/Users/benny/Documents/Codex/2026-06-19/66-154-109-189-root-71ob44ls5y/farmtg-local/farmtg";

const jwt = readFileSync(`${BASE}/.farmtg_jwt`, "utf8").trim();
const humanPass = readFileSync(`${BASE}/.farmtg_human_pass`, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(`${BASE}/server/farmtg-client.mjs`).href);

const client = new FarmtgClient({
  token: jwt,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
});

console.log("Connecting...");
await client.connect();
console.log("Connected and authenticated.");

// Call 1: buy_seed with empty data
let result1, error1;
try {
  result1 = await client.action("buy_seed", {});
  console.log("buy_seed({}) result:", JSON.stringify(result1, null, 2));
} catch (e) {
  error1 = { message: e.message, code: e.code, serverPayload: e.serverPayload };
  console.log("buy_seed({}) error:", JSON.stringify(error1, null, 2));
}

// Call 2: buy_seed with {page:1}
let result2, error2;
try {
  result2 = await client.action("buy_seed", { page: 1 });
  console.log("buy_seed({page:1}) result:", JSON.stringify(result2, null, 2));
} catch (e) {
  error2 = { message: e.message, code: e.code, serverPayload: e.serverPayload };
  console.log("buy_seed({page:1}) error:", JSON.stringify(error2, null, 2));
}

client.close();
console.log("Done.");

console.log("FINAL_RESULTS:", JSON.stringify({
  "buy_seed({})": result1 ?? { error: error1 },
  "buy_seed({page:1})": result2 ?? { error: error2 },
}, null, 2));
