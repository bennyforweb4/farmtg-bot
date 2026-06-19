import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HUMAN_PASS_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_FILE, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
  logger: { warn: console.warn, info: console.error, log: console.error },
});

console.error("Connecting...");
await client.connect();
console.error("Connected and authenticated.");

const results = {};

try {
  console.error("Calling action('plots', {})...");
  const r1 = await client.action("plots", {});
  results["plots_no_args"] = r1;
  console.error("Got plots (no args):", JSON.stringify(r1, null, 2));
} catch (e) {
  results["plots_no_args_error"] = { message: e.message, serverPayload: e.serverPayload };
  console.error("Error (no args):", e.message, e.serverPayload);
}

try {
  console.error("Calling action('plots', {page:1})...");
  const r2 = await client.action("plots", { page: 1 });
  results["plots_page1"] = r2;
  console.error("Got plots (page:1):", JSON.stringify(r2, null, 2));
} catch (e) {
  results["plots_page1_error"] = { message: e.message, serverPayload: e.serverPayload };
  console.error("Error (page:1):", e.message, e.serverPayload);
}

client.close();

// Print final JSON to stdout for capture
console.log(JSON.stringify(results, null, 2));
