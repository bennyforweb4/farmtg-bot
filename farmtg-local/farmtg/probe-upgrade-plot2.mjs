import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HUMAN_PASS_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_FILE, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({ token, humanPass, wsUrl: "wss://farmtg.top/api/game/ws" });

await client.connect();
console.log("Connected.");

// Try plot_index 0 through 5
for (let idx = 0; idx <= 5; idx++) {
  const data = { plot_index: idx };
  console.log(`\n--- upgrade_plot {plot_index: ${idx}} ---`);
  try {
    const res = await client.action("upgrade_plot", data);
    console.log("OK:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
    if (err.serverPayload) console.error("Payload:", JSON.stringify(err.serverPayload, null, 2));
  }
}

client.close();
console.log("\nDone.");
