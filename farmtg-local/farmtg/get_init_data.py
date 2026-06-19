import asyncio, os, sys
from urllib.parse import unquote
from telethon import TelegramClient
from telethon.tl.functions.messages import RequestWebViewRequest

API_ID   = 36858692
API_HASH = "6c0eb03d3eeafb0d6b5d9861a869a896"
SESSION  = os.path.join(os.path.dirname(__file__), "farmtg")
BOT_USERNAME = "Joyhpyy_bot"
WEBVIEW_URL  = "https://farmtg.top/"

async def main():
    client = TelegramClient(SESSION, API_ID, API_HASH)
    await client.connect()
    if not await client.is_user_authorized():
        sys.exit("Session not authorized")
    bot = await client.get_entity(BOT_USERNAME)
    result = await client(RequestWebViewRequest(
        peer=bot, bot=bot, platform="web", url=WEBVIEW_URL, start_param=""))
    url = result.url
    fragment = url.split("#", 1)[1] if "#" in url else ""
    for part in fragment.split("&"):
        if part.startswith("tgWebAppData="):
            print(unquote(part[len("tgWebAppData="):]))
            return
    sys.exit("tgWebAppData not found")
    await client.disconnect()

asyncio.run(main())