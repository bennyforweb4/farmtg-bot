import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve("farmtg-local", "farmtg");
const jwt = readFileSync(join(root, ".farmtg_jwt"), "utf8").trim();

// Cloudflare test sitekey 对应的 dummy token（测试密钥接受任意值）
const DUMMY_TOKENS = [
  "XXXX.DUMMY.TOKEN.XXXX",           // 常见测试占位符
  "1x00000000000000000000BB",         // Cloudflare 文档示例格式
  "test-token-dummy-12345",           // 纯随机字符串
];

for (const token of DUMMY_TOKENS) {
  console.log(`\n--- Testing token: ${token.slice(0, 30)}... ---`);
  try {
    const res = await fetch("https://farmtg.top/api/game/human-verify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ captcha_token: token }),
    });
    const body = await res.json().catch(() => ({}));
    console.log(`HTTP ${res.status}:`, JSON.stringify(body));
  } catch (e) {
    console.error("Request failed:", e.message);
  }
}
