// ═══════════════════════════════════════════════════════════════
// Config — loads from ~/.empli/config.json or env vars
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.env.HOME || '.', '.empli');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

const DEFAULT_CONFIG = {
  endpoint: '',              // Default agent endpoint for all channels
  maxHistory: 20,
  dataDir: DATA_DIR,

  channels: {
    webchat: {
      enabled: true,
      port: 3456,
      endpoint: '',          // Override: use different agent for this channel
    },
    whatsapp: {
      enabled: false,
      endpoint: '',
      allowGroups: false,
      allowList: [],
      blockList: [],
    },
    telegram: {
      enabled: false,
      endpoint: '',
      token: '',
      allowGroups: false,
      allowList: [],
    },
    discord: {
      enabled: false,
      endpoint: '',
      token: '',
      allowGroups: false,
      channelList: [],
      allowList: [],
    },
    slack: {
      enabled: false,
      endpoint: '',
      botToken: '',
      appToken: '',
      allowList: [],
    },
    gmail: {
      enabled: false,
      endpoint: '',
      credentialsPath: '',
      tokenPath: '',
      pollInterval: 15000,
      allowList: [],
      blockList: [],
    },
  },

  cron: [],
};

export function loadConfig() {
  let config = { ...DEFAULT_CONFIG };

  // Load from file
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      config = deepMerge(config, fileConfig);
      console.log(`[Config] Loaded from ${CONFIG_PATH}`);
    } catch (err) {
      console.error(`[Config] Error reading ${CONFIG_PATH}:`, err.message);
    }
  }

  // Override with env vars
  if (process.env.EMPLI_ENDPOINT) config.endpoint = process.env.EMPLI_ENDPOINT;
  if (process.env.TELEGRAM_BOT_TOKEN) {
    config.channels.telegram.enabled = true;
    config.channels.telegram.token = process.env.TELEGRAM_BOT_TOKEN;
  }
  if (process.env.DISCORD_BOT_TOKEN) {
    config.channels.discord.enabled = true;
    config.channels.discord.token = process.env.DISCORD_BOT_TOKEN;
  }
  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN) {
    config.channels.slack.enabled = true;
    config.channels.slack.botToken = process.env.SLACK_BOT_TOKEN;
    config.channels.slack.appToken = process.env.SLACK_APP_TOKEN;
  }
  if (process.env.GMAIL_CREDENTIALS) {
    config.channels.gmail.enabled = true;
    config.channels.gmail.credentialsPath = process.env.GMAIL_CREDENTIALS;
  }
  if (process.env.WHATSAPP_ENABLED === 'true') {
    config.channels.whatsapp.enabled = true;
  }

  return config;
}

export function saveConfig(config) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`[Config] Saved to ${CONFIG_PATH}`);
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export { DATA_DIR, CONFIG_PATH };
