# Airminal Assistant — Your AI Employee, Everywhere You Chat

One lightweight process connects your <a href="https://airminal.com">airminal AI agent</a> to every platform you use. WhatsApp, Telegram, Discord, Slack, Gmail — your assistant listens, responds, and gets work done across all of them simultaneously. It can manage your files, search the web, control your computer, query your databases, manage GitHub repos, schedule calendar events, and handle 100+ tasks autonomously. Deploy it on any machine and let it run 24/7.

## How It Works

```
                    ┌─────────────────────┐
  WhatsApp ────────▶│                     │
  Telegram ────────▶│   airminal Gateway  │──────▶ airminal Agent API
  Discord  ────────▶│   (Node.js, local)  │◀──────  (your backend)
  Slack    ────────▶│                     │
  Gmail    ────────▶│  Sessions, routing, │
  WebChat  ────────▶│  history, locking   │
                    └─────────────────────┘
```

Unlike the Chrome extension (which scrapes web page DOMs), the Gateway uses **real platform APIs**:

- **WhatsApp** → whatsapp-web.js (real WA protocol, QR code auth)
- **Telegram** → Bot API via Telegraf
- **Discord** → discord.js
- **Slack** → Bolt (Socket Mode)
- **Gmail** → Google APIs (OAuth2, read + send)
- **WebChat** → Built-in HTTP API + web UI

## Quick Start

```bash
# Install
npm install

# Interactive setup
node src/cli.js onboard

# Start the gateway
npm start
```

Or with environment variables:

```bash
AIRMINAL_ENDPOINT=https://simon.airminal.com/api/ \
TELEGRAM_BOT_TOKEN=your-token \
npm start
```

## Setup Each Channel

### WebChat (always on)
Runs automatically on `http://localhost:3456`. Use the web UI or POST to `/chat`:

```bash
curl -X POST http://localhost:3456/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "user_id": "test"}'
```

### WhatsApp
1. Set `WHATSAPP_ENABLED=true` or enable in config
2. Start the gateway
3. Scan the QR code with your phone
4. Session persists (no re-scan needed)

### Telegram
1. Message [@BotFather](https://t.me/botfather) → `/newbot` → get token
2. Set `TELEGRAM_BOT_TOKEN=your-token`
3. Start the gateway
4. Message your bot on Telegram

### Discord
1. Go to [discord.com/developers](https://discord.com/developers/applications)
2. Create app → Bot → copy token
3. Enable "Message Content Intent"
4. Invite bot to your server with message permissions
5. Set `DISCORD_BOT_TOKEN=your-token`

### Slack
1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create app → Socket Mode → enable
3. Add bot token scopes: `chat:write`, `app_mentions:read`, `im:history`, `im:read`
4. Install to workspace
5. Set `SLACK_BOT_TOKEN=xoxb-...` and `SLACK_APP_TOKEN=xapp-...`

### Gmail
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable Gmail API
3. Create OAuth credentials (Desktop app)
4. Download JSON
5. Set `GMAIL_CREDENTIALS=/path/to/credentials.json`
6. Start gateway → visit auth URL → run `node src/cli.js gmail-auth <code>`

## Configuration

Config file: `~/.airminal/config.json`

```json
{
  "endpoint": "https://simon.airminal.com/api/",
  "maxHistory": 20,
  "channels": {
    "webchat": { "enabled": true, "port": 3456 },
    "whatsapp": { "enabled": true, "allowGroups": false },
    "telegram": { "enabled": true, "token": "..." },
    "discord": { "enabled": true, "token": "..." },
    "slack": { "enabled": true, "botToken": "xoxb-...", "appToken": "xapp-..." },
    "gmail": { "enabled": true, "credentialsPath": "...", "pollInterval": 15000 }
  }
}
```

### Per-Channel Options
- `allowList` — only respond to these user IDs/emails
- `blockList` — ignore these user IDs/emails
- `allowGroups` — respond in group chats (default: false)

## Architecture

```
src/
├── index.js              # Entry point — loads config, starts gateway
├── cli.js                # Onboarding wizard + CLI commands
├── core/
│   ├── gateway.js        # Session management, message routing, agent API
│   └── config.js         # Config loader (file + env vars)
└── channels/
    ├── base.js           # Base channel class
    ├── whatsapp.js       # WhatsApp via whatsapp-web.js
    ├── telegram.js       # Telegram via Telegraf
    ├── discord.js        # Discord via discord.js
    ├── slack.js          # Slack via Bolt
    ├── gmail.js          # Gmail via Google APIs
    └── webchat.js        # HTTP API + web UI
```

### Key Design Decisions

**Gateway pattern** — One process, multiple channels. All channels share the same sessions and history. Message your agent on Telegram, continue on Discord.

**Per-session locking** — Messages for the same chat queue up. Different chats process in parallel. No race conditions.

**JSONL sessions** — Each session is one file, each line is one message. Crash-safe, easy to inspect.

**Channel adapters** — Each platform is a separate adapter that normalizes messages into a common format. Adding a new channel = one file.

## vs Chrome Extension

| | Chrome Extension | Gateway |
|---|---|---|
| **How** | DOM scraping | Platform APIs |
| **Runs** | In browser tabs | Standalone Node.js |
| **Auth** | Your logged-in browser | Bot tokens / OAuth |
| **Uptime** | Only when browser is open | 24/7 on any machine |
| **Breakage risk** | High (DOM changes) | Low (stable APIs) |
| **Store approval** | Needed | Not needed |
| **Platforms** | 12 web apps | 5+ APIs (expandable) |
