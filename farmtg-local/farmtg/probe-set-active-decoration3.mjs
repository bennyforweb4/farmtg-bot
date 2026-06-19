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

// Known tool IDs from get_active_decorations
const HOUSE_TOOL_ID = "6a074b70225b85c97de41ab0";
const SCARECROW_TOOL_ID = "6a02311ee7b2cbd77c51d226";

const testCases = [
  // Try type as decoration category names from get_active_decorations response keys
  { type: "house" },
  { type: "scarecrow" },
  { type: "house", tool_id: HOUSE_TOOL_ID },
  { type: "scarecrow", tool_id: SCARECROW_TOOL_ID },
  { decoration_type: "house" },
  { decoration_type: "scarecrow" },
  { decoration_type: "house", tool_id: HOUSE_TOOL_ID },
  { decoration_type: "scarecrow", tool_id: SCARECROW_TOOL_ID },
  // Try with just tool_id
  { tool_id: HOUSE_TOOL_ID },
  { tool_id: SCARECROW_TOOL_ID },
  // Try integer types
  { type: "house", id: HOUSE_TOOL_ID },
  { type: "scarecrow", id: SCARECROW_TOOL_ID },
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
