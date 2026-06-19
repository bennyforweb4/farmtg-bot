#!/usr/bin/env python3
"""
Use an existing Telethon session to obtain a FarmTG game JWT.

Steps:
1. Connect to Telegram and request the FarmTG mini-app webview URL.
2. Extract initData from the URL fragment.
3. POST initData to each known auth endpoint until one returns a JWT.
4. Print the JWT so it can be used with run-once.mjs.

Usage:
    python3 get_farmtg_jwt.py
"""
import asyncio
import json
import os
import sys
import urllib.request
import urllib.error
from urllib.parse import unquote, urlparse

from telethon import TelegramClient
from telethon.tl.functions.messages import RequestWebViewRequest

API_ID   = 36858692
API_HASH = "6c0eb03d3eeafb0d6b5d9861a869a896"
# Dedicated session for this tool (run login.py first if it doesn't exist)
SESSION  = os.path.join(os.path.dirname(__file__), "farmtg")

BOT_USERNAME  = "Joyhpyy_bot"
GAME_ORIGIN   = "https://farmtg.top"
WEBVIEW_URL   = "https://farmtg.top/"

# Auth endpoints to try in order (confirmed from JS bundle: /api/auth/login with init_data)
AUTH_ENDPOINTS = [
    "/api/auth/login",
    "/api/user/auth",
    "/api/auth/miniapp",
    "/api/game/auth",
    "/api/auth/init",
    "/api/auth/tg",
    "/api/telegram",
    "/api/init",
]

BROWSER_HEADERS = {
    'Origin': GAME_ORIGIN,
    'Referer': GAME_ORIGIN + '/',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
}


def post_json(url, payload, timeout=10):
    data = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    headers.update(BROWSER_HEADERS)
    req = urllib.request.Request(
        url, data=data,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode()
            try:
                return resp.status, json.loads(body)
            except Exception:
                return resp.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, body


def extract_init_data(webview_url: str) -> str:
    """Pull tgWebAppData out of the URL fragment."""
    if "#" not in webview_url:
        raise ValueError(f"No fragment in webview URL: {webview_url[:120]}")
    fragment = webview_url.split("#", 1)[1]
    for part in fragment.split("&"):
        if part.startswith("tgWebAppData="):
            raw = part[len("tgWebAppData="):]
            return unquote(raw)
    raise ValueError("tgWebAppData not found in URL fragment")


def find_jwt_in(obj, depth=0):
    if depth > 5:
        return None
    if isinstance(obj, str):
        parts = obj.split(".")
        if len(parts) == 3 and all(len(p) > 10 for p in parts):
            return obj
    if isinstance(obj, dict):
        for v in obj.values():
            found = find_jwt_in(v, depth + 1)
            if found:
                return found
    if isinstance(obj, list):
        for item in obj:
            found = find_jwt_in(item, depth + 1)
            if found:
                return found
    return None


async def get_init_data():
    print(f"[+] 连接 Telegram (session: {SESSION}.session)...")
    client = TelegramClient(SESSION, API_ID, API_HASH)
    await client.connect()

    if not await client.is_user_authorized():
        print("[!] Session 未授权，需要重新登录红包监控")
        await client.disconnect()
        sys.exit(1)

    me = await client.get_me()
    print(f"[+] 已登录: {me.first_name} (@{me.username}) id={me.id}")

    try:
        print(f"[+] 获取 {BOT_USERNAME} 实体...")
        bot = await client.get_entity(BOT_USERNAME)

        # Unblock the bot if we previously blocked it
        from telethon.tl.functions.contacts import UnblockRequest
        try:
            await client(UnblockRequest(id=bot))
            print(f"[+] 已解除对 {BOT_USERNAME} 的屏蔽")
        except Exception:
            pass

        print("[+] 请求 Mini App webview URL...")
        result = await client(RequestWebViewRequest(
            peer=bot,
            bot=bot,
            platform="web",
            url=WEBVIEW_URL,
            start_param="",
        ))

        webview_url = result.url
        print(f"[+] 原始 URL (前 100 chars): {webview_url[:100]}")

        init_data = extract_init_data(webview_url)
        print(f"[+] initData 长度={len(init_data)}, 前 80 chars: {init_data[:80]}")
        return init_data
    finally:
        await client.disconnect()


def probe_auth_endpoints(init_data):
    print("\n[+] 尝试 auth 端点（init_data key，JS bundle 已确认）...")
    # JS confirmed: nf(e) => POST /api/auth/login {init_data: e}
    for path in AUTH_ENDPOINTS:
        url = GAME_ORIGIN + path
        status, body = post_json(url, {"init_data": init_data})
        jwt = find_jwt_in(body)
        marker = "✓" if jwt else " "
        err = body.get("error", "") if isinstance(body, dict) else str(body)[:60]
        print(f"  [{marker}] {status} POST {path}  {err}")
        if jwt:
            print(f"\n[+] 找到 JWT: {jwt[:60]}...")
            print(f"[+] 完整响应: {json.dumps(body, ensure_ascii=False)[:400]}")
            return jwt
    return None


async def main():
    init_data = await get_init_data()
    jwt = probe_auth_endpoints(init_data)

    if not jwt:
        print("\n[!] 未找到 JWT。可能:")
        print("    1. auth 端点路径不在上面列表里（需要再抓包）")
        print("    2. 游戏需要 Telegram Login Widget 而不是 initData")
        print(f"\n[提示] 把 initData 保存到文件供手动分析:")
        with open("/tmp/farmtg_initdata.txt", "w") as f:
            f.write(init_data)
        print("    已写入 /tmp/farmtg_initdata.txt")
        sys.exit(1)

    print(f"\n{'='*60}")
    print("JWT 获取成功！运行方式：")
    print(f"\n  FARMTG_JWT=\"{jwt}\" \\")
    print(f"  FARMTG_CROP_ID=\"69f85a3a2c24a6892a6110bf\" \\")
    print(f"  node server/run-once.mjs")
    print(f"\n或写入文件:")
    jwt_file = os.path.join(os.path.dirname(__file__), ".farmtg_jwt")
    with open(jwt_file, "w") as f:
        f.write(jwt)
    print(f"  已写入 {jwt_file}")


asyncio.run(main())
