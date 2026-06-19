# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FarmTG automation bot that plays a Telegram Mini App farming game. Node.js/Python hybrid with WebSocket-based real-time interaction. The bot automatically harvests crops, plants new ones, completes daily tasks, and handles Cloudflare Turnstile challenges.

Remote target: `root@66.154.109.189`, managed via pm2 at `/opt/farmtg/`.

## Key Commands

```bash
# Acquire/refresh JWT from Telegram session
python3 farmtg-local/farmtg/get_farmtg_jwt.py

# Run the main automation bot (primary)
node auto-loop-remote-full.mjs

# Capture Cloudflare Turnstile token via local HTTP server
node capture-human-pass.mjs

# Probe WebSocket connectivity
node probe-local-ws.mjs
node probe-local-harvest.mjs

# Remote verification trigger (run on remote server)
bash farmtg-local/farmtg/run-farmtg-verify.sh <captcha_token>
```

SSH access uses `plink.exe` (in `.cli-tools/`) with the password stored in `FARMTG_SSH_PASSWORD_B64` (base64-encoded env var).

## Architecture

### Entry Point
`auto-loop-remote-full.mjs` — the main 734-line bot loop. Runs on a 62-second cadence (Radish harvest interval).

### Core Modules

**`farmtg-local/farmtg/server/farmtg-client.mjs`** — `FarmtgClient` class
- WebSocket client to `farmtg.top` game server
- Request/response correlation via RID (request ID) map
- Key methods: `connect()`, `harvestAll()`, `plant()`, `action()`, `refreshInventory()`
- Maintains state: `this.plots`, `this.user`, `this.inventory`

**`get_farmtg_jwt.py`** — JWT acquisition
- Uses Telethon to connect to Telegram, fetches Mini App webview URL
- Extracts `tgWebAppData` (initData) from URL fragment
- Tries multiple auth endpoints in sequence to exchange initData for JWT
- Session persists in `farmtg-local/farmtg/farmtg.session`

**`capture-human-pass.mjs`** — local HTTP server (port 3000) that receives Turnstile tokens
- Used alongside `manual-human-verify-snippet.js` (browser console script)

### Main Loop Logic (auto-loop-remote-full.mjs)

Startup (once): accept friend requests → claim mail/tasks → daily routine

Every 62 seconds:
1. Harvest mature crops
2. Clear withered plots
3. Plant on empty plots (Radish priority, fallback Cabbage)
4. Every 5 loops: claim mails + tasks
5. Every 3 loops: run daily routine (steal free crops → up to 3 paid visits at 1000 coins each → put weeds/pests → clean own marks)

### State Files

| File | Purpose |
|------|---------|
| `.farmtg_jwt` | JWT auth token (refreshed via Python script) |
| `.farmtg_human_pass` | Cloudflare Turnstile pass token |
| `.daily_state.json` | Visited farm IDs per day (prevents double-paying); resets at midnight |
| `.challenge_state.json` | Turnstile challenge failure count + pause state (exponential backoff) |

### Cloudflare Challenge Handling

When a Turnstile challenge is detected, the bot pauses with exponential backoff: 10 min → 20 min → 40 min → 60 min (capped). Resolution flow:
1. **Auto**: write token to `.farmtg_human_pass` or send via command
2. **Manual**: run `capture-human-pass.mjs`, then run `manual-human-verify-snippet.js` in browser console on the game page — it solves Turnstile and POSTs the token to localhost:3000

### Crop Economics

| Crop | Cycle | Loop interval |
|------|-------|---------------|
| Radish | 60s | 62s |
| Cabbage | 300s | 302s |

Max 3 paid friend farm visits per day (1000 coins each = 3000 coins/day max).

## Module System

`farmtg-local/farmtg/package.json` sets `"type": "module"` — all `.mjs` files use ES module syntax (`import`/`export`). Plain `.js` files (e.g., `manual-human-verify-snippet.js`) are browser console scripts, not Node modules.

## Deployment

The project deploys to the remote server via SSH:
```bash
# Package and copy
tar -czf farmtg.tar.gz farmtg-local/
plink.exe -ssh root@66.154.109.189 ...

# Remote service management (pm2)
pm2 restart farmtg
pm2 logs farmtg
```

Log files on remote: `/root/.pm2/logs/farmtg-out.log`, `/root/.pm2/logs/farmtg-error.log`
