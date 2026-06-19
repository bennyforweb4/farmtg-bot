import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { FarmtgClient } from "./farmtg-local/farmtg/server/farmtg-client.mjs";

const root = resolve("farmtg-local", "farmtg");
const jwt = readFileSync(join(root, ".farmtg_jwt"), "utf8").trim();
const humanPassPath = join(root, ".farmtg_human_pass");
const humanPass = existsSync(humanPassPath) ? readFileSync(humanPassPath, "utf8").trim() : "";

const client = new FarmtgClient({
  token: jwt,
  humanPass,
  logger: console,
});

try {
  await client.connect();
  await client.waitForPlots({ timeoutMs: 12_000 });
  const user = client.state.user || {};
  console.log(`[probe] connected lv=${user.level} coins=${user.coins} plots=${user.unlocked_plots}`);
  console.log(`[probe] human_pass=${humanPass ? "present" : "absent"}`);

  const result = await client.harvestAll();
  console.log(`[probe] harvest_all ok=${result.ok} data=${JSON.stringify(result.data)}`);
} catch (error) {
  console.error(`[probe] failed ${error.message}`);
  if (error.code) console.error(`[probe] code=${error.code}`);
  process.exitCode = 1;
} finally {
  client.close();
}
