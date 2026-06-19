import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_PATH = "C:/Users/benny/Documents/Codex/2026-06-19/66-154-109-189-root-71ob44ls5y/farmtg-local/farmtg/.farmtg_jwt";
const HUMAN_PASS_PATH = "C:/Users/benny/Documents/Codex/2026-06-19/66-154-109-189-root-71ob44ls5y/farmtg-local/farmtg/.farmtg_human_pass";
const CLIENT_PATH = "C:/Users/benny/Documents/Codex/2026-06-19/66-154-109-189-root-71ob44ls5y/farmtg-local/farmtg/server/farmtg-client.mjs";

const token = readFileSync(JWT_PATH, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_PATH, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
  logger: { warn: () => {}, log: () => {}, error: () => {}, info: () => {} },
});

await client.connect();
console.log("Connected.");

// Try various decoration type parameters
const testCases = [
  { type: 1 },
  { type: "avatar" },
  { type: "frame" },
  { type: "background" },
  { type: "badge" },
  { decoration_type: 1 },
  { decoration_type: "avatar" },
  { decoration_id: 1 },
  { id: 1 },
  { slot: 1 },
  { decoration_type: "frame", decoration_id: 1 },
  { type: "title" },
  { type: "skin" },
  { type: "border" },
  { type: "hat" },
  { type: "pet" },
  { type: "decoration" },
  { type: 0 },
  { type: 2 },
  { type: 3 },
];

for (const data of testCases) {
  try {
    const result = await client.action("set_active_decoration", data);
    console.log(`SUCCESS with ${JSON.stringify(data)}:`, JSON.stringify(result, null, 2));
  } catch (e) {
    const errMsg = e.serverPayload?.error ?? e.message;
    console.log(`FAIL   with ${JSON.stringify(data)}: ${errMsg}`);
  }
}

client.close();
console.log("Done.");
