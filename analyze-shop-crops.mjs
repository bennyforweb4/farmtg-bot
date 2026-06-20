import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = "C:\\Users\\benny\\Documents\\Codex\\2026-06-19\\66-154-109-189-root-71ob44ls5y\\farmtg-local\\farmtg";
const jwt = readFileSync(join(root, ".farmtg_jwt"), "utf8").trim();

const r = await fetch("https://farmtg.top/api/crops", {
  headers: { Authorization: `Bearer ${jwt}` }
});
const json = await r.json();
const crops = Array.isArray(json.data) ? json.data : (json.data?.data ?? []);

// coins_hr = fruit_coins × yield_per_season / mature_seconds × 3600
const rows = crops.map(c => {
  const coinsPerSeason = c.fruit_coins * c.yield_per_season;
  const coinsHr = Math.round(coinsPerSeason / c.mature_seconds * 3600);
  const cycleMin = Math.round(c.mature_seconds / 60);
  return {
    id: c.id,
    name: c.name,
    price: c.price,
    cycleMin,
    matureSeconds: c.mature_seconds,
    fruitCoins: c.fruit_coins,
    yieldPerSeason: c.yield_per_season,
    coinsPerSeason,
    coinsHr,
    unlockLv: c.unlock_level,
    status: c.status,
  };
});

rows.sort((a, b) => b.coinsHr - a.coinsHr);

console.log("\n===== 商店种子收益排名（金币/小时，13地块全种）=====");
console.log(
  "排名".padEnd(4) +
  "名称".padEnd(22) +
  "周期".padEnd(8) +
  "单季金币".padEnd(10) +
  "金币/hr".padEnd(10) +
  "13地块/hr".padEnd(12) +
  "购买价".padEnd(8) +
  "解锁LV"
);
console.log("-".repeat(82));

rows.forEach((c, i) => {
  console.log(
    String(i + 1).padEnd(4) +
    c.name.padEnd(20) +
    `${c.cycleMin}min`.padEnd(8) +
    String(c.coinsPerSeason).padEnd(10) +
    String(c.coinsHr).padEnd(10) +
    String(c.coinsHr * 13).padEnd(12) +
    String(c.price).padEnd(8) +
    `Lv${c.unlockLv}`
  );
});

console.log(`\n共 ${rows.length} 种作物`);

// Show top 3 details
console.log("\n===== TOP 3 详情 =====");
rows.slice(0, 3).forEach(c => {
  console.log(`\n${c.name} (${c.id})`);
  console.log(`  成熟: ${c.matureSeconds}s (${c.cycleMin}min) | 解锁: Lv${c.unlockLv} | 价格: ${c.price}`);
  console.log(`  每果金币: ${c.fruitCoins} | 每季产量: ${c.yieldPerSeason} | 每季收益: ${c.coinsPerSeason}`);
  console.log(`  金币/hr (1地块): ${c.coinsHr} | 金币/hr (13地块): ${c.coinsHr * 13}`);
});
