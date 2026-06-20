import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg";
const jwt = readFileSync(join(root, ".farmtg_jwt"), "utf8").trim();

// Probe raw API response
const r = await fetch("https://farmtg.top/api/crops", {
  headers: { Authorization: `Bearer ${jwt}` }
});
console.log("Status:", r.status);
const text = await r.text();
console.log("Raw (first 2000):", text.slice(0, 2000));
