import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const JWT_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_jwt";
const HUMAN_PASS_FILE = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\.farmtg_human_pass";
const CLIENT_PATH = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg\\server\\farmtg-client.mjs";

const token = readFileSync(JWT_FILE, "utf8").trim();
const humanPass = readFileSync(HUMAN_PASS_FILE, "utf8").trim();

console.log("JWT (first 40 chars):", token.slice(0, 40) + "...");
console.log("human_pass:", humanPass.slice(0, 20) + "...");

const { FarmtgClient } = await import(pathToFileURL(CLIENT_PATH).href);

const client = new FarmtgClient({
  token,
  humanPass,
  wsUrl: "wss://farmtg.top/api/game/ws",
  logger: {
    warn: (...a) => console.warn("[WARN]", ...a),
    info: (...a) => console.info("[INFO]", ...a),
    error: (...a) => console.error("[ERROR]", ...a),
    log: (...a) => console.log("[LOG]", ...a),
  },
});

try {
  console.log("\nConnecting to WebSocket...");
  await client.connect();
  console.log("Connected and authenticated successfully.");

  // Dump state after auth
  console.log("\n=== State after connect ===");
  console.log("user:", JSON.stringify(client.state.user, null, 2));
  console.log("plots count:", client.state.plots.length);

  console.log("\n=== Calling action('auth', {}) ===");
  let result1;
  try {
    result1 = await client.action("auth", {});
    console.log("Result:", JSON.stringify(result1, null, 2));
  } catch (err) {
    console.log("Error:", err.message);
    if (err.serverPayload) {
      console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
    }
    result1 = { error: err.message, serverPayload: err.serverPayload };
  }

  console.log("\n=== Calling action('auth', {page:1}) ===");
  let result2;
  try {
    result2 = await client.action("auth", { page: 1 });
    console.log("Result:", JSON.stringify(result2, null, 2));
  } catch (err) {
    console.log("Error:", err.message);
    if (err.serverPayload) {
      console.log("Server payload:", JSON.stringify(err.serverPayload, null, 2));
    }
    result2 = { error: err.message, serverPayload: err.serverPayload };
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify({ auth_empty: result1, auth_page1: result2 }, null, 2));

} catch (err) {
  console.error("Fatal error:", err.message);
  if (err.serverPayload) {
    console.error("Server payload:", JSON.stringify(err.serverPayload, null, 2));
  }
} finally {
  client.close();
  console.log("\nConnection closed.");
}
