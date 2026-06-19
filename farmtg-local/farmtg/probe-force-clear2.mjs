import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HP_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_PATH, "utf8").trim();
const humanPass = readFileSync(HP_PATH, "utf8").trim();

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
  logger: console,
});

console.log("Connecting...");
await client.connect();
console.log("Connected. Waiting for plots state...\n");

await client.waitForPlots({ timeoutMs: 10000 });
const plots = client.state.plots;
const user = client.state.user;
console.log("User:", JSON.stringify(user, null, 2));
console.log("Plots count:", plots.length);
console.log("Plots:", JSON.stringify(plots, null, 2));

// Find withered/dead plots to try force_clear on
const witheredPlots = plots.filter(p => p.stage === "withered" || p.stage === "dead" || p.stage === "weed" || p.stage === "pest");
console.log("\nWithered/dead/weed/pest plots:", witheredPlots.map(p => p.plot_index));

// Try force_clear on plot_index 0 first (may fail if not withered)
for (let idx = 0; idx <= 5; idx++) {
  console.log(`\n=== action('force_clear', {plot_index: ${idx}}) ===`);
  try {
    const result = await client.action("force_clear", { plot_index: idx });
    console.log("Result:", JSON.stringify(result, null, 2));
    break; // stop on first success
  } catch (err) {
    console.log("Error:", err.message);
    if (err.serverPayload) {
      console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
    }
  }
}

// Also try on any withered plot found
if (witheredPlots.length > 0) {
  const idx = witheredPlots[0].plot_index;
  console.log(`\n=== action('force_clear', {plot_index: ${idx}}) [withered plot] ===`);
  try {
    const result = await client.action("force_clear", { plot_index: idx });
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.log("Error:", err.message);
    if (err.serverPayload) {
      console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
    }
  }
}

client.close();
console.log("\nDone.");
