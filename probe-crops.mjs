/**
 * 探针：连接 WebSocket，查询库存和作物数据，分析收益
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const root = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg";
const jwt = readFileSync(join(root, ".farmtg_jwt"), "utf8").trim();
const humanPass = existsSync(join(root, ".farmtg_human_pass"))
  ? readFileSync(join(root, ".farmtg_human_pass"), "utf8").trim()
  : "";

import { pathToFileURL } from "node:url";
const { FarmtgClient } = await import(pathToFileURL(join(root, "server", "farmtg-client.mjs")).href);

const client = new FarmtgClient({ token: jwt, humanPass });
await client.connect();
console.log("Connected. User:", JSON.stringify(client.state.user, null, 2));

// 查库存
const inv = await client.action("get_inventory");
console.log("\n=== Inventory ===");
console.log(JSON.stringify(inv?.data ?? inv, null, 2));

// 查图地状态
console.log("\n=== Plots ===");
console.log(JSON.stringify(client.state.plots?.slice(0, 3), null, 2));  // 只看前3个

// 尝试获取作物配置
const crops = await client.action("get_crops").catch(e => ({ error: e.message }));
console.log("\n=== Crops config ===");
console.log(JSON.stringify(crops?.data ?? crops, null, 2));

// 尝试获取商店
const shop = await client.action("get_shop").catch(e => ({ error: e.message }));
console.log("\n=== Shop ===");
console.log(JSON.stringify(shop?.data ?? shop, null, 2));

// 尝试获取市场
const market = await client.action("get_market").catch(e => ({ error: e.message }));
console.log("\n=== Market ===");
console.log(JSON.stringify(market?.data ?? market, null, 2));

client.close();
