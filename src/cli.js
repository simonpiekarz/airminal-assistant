#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Empli CLI — Onboarding Wizard
// Interactive setup: configure endpoint + channels
// ═══════════════════════════════════════════════════════════════

import { loadConfig, saveConfig, CONFIG_PATH, DATA_DIR } from './core/config.js';
import fs from 'fs';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'onboard':
      await onboard();
      break;
    case 'status':
      await showStatus();
      break;
    case 'config':
      showConfig();
      break;
    case 'gmail-auth':
      await gmailAuth(args[1]);
      break;
    default:
      printHelp();
  }
}

async function onboard() {
  const { default: inquirer } = await import('inquirer');
  const chalk = (await import('chalk')).default;

  console.log('');
  console.log(chalk.bold('  Empli Gateway — Setup Wizard'));
  console.log(chalk.dim('  Connect your AI agent to messaging platforms'));
  console.log('');

  const config = loadConfig();

  // Step 1: Agent endpoint
  const { endpoint } = await inquirer.prompt([{
    type: 'input',
    name: 'endpoint',
    message: 'Empli agent API endpoint:',
    default: config.endpoint || 'https://simon.empli.com/api/',
    validate: (v) => v.startsWith('http') ? true : 'Must be a URL',
  }]);
  config.endpoint = endpoint;

  // Test connection
  console.log(chalk.dim('  Testing connection...'));
  try {
    const testUrl = endpoint.endsWith('/') ? `${endpoint}?route=health` : `${endpoint}/?route=health`;
    const res = await fetch(testUrl, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      console.log(chalk.green('  ✓ Connected to agent'));
    } else {
      console.log(chalk.yellow(`  ⚠ Agent responded with ${res.status}`));
    }
  } catch (err) {
    console.log(chalk.yellow(`  ⚠ Could not reach agent: ${err.message}`));
    console.log(chalk.dim('    (You can fix this later in the config file)'));
  }

  // Step 2: Choose channels
  const { channels } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'channels',
    message: 'Which channels do you want to enable?',
    choices: [
      { name: 'WebChat (local HTTP API — always recommended)', value: 'webchat', checked: true },
      { name: 'WhatsApp (via WhatsApp Web, QR code auth)', value: 'whatsapp' },
      { name: 'Telegram (Bot API, needs @BotFather token)', value: 'telegram' },
      { name: 'Discord (Bot API, needs developer app token)', value: 'discord' },
      { name: 'Slack (Bolt, needs bot + app tokens)', value: 'slack' },
      { name: 'Gmail (Google API, needs OAuth credentials)', value: 'gmail' },
    ],
  }]);

  // Configure each selected channel
  for (const ch of channels) {
    config.channels[ch] = config.channels[ch] || {};
    config.channels[ch].enabled = true;

    switch (ch) {
      case 'telegram': {
        const { token } = await inquirer.prompt([{
          type: 'input',
          name: 'token',
          message: 'Telegram bot token (from @BotFather):',
          default: config.channels.telegram.token || '',
        }]);
        config.channels.telegram.token = token;
        break;
      }
      case 'discord': {
        const { token } = await inquirer.prompt([{
          type: 'input',
          name: 'token',
          message: 'Discord bot token:',
          default: config.channels.discord.token || '',
        }]);
        config.channels.discord.token = token;
        break;
      }
      case 'slack': {
        const { botToken, appToken } = await inquirer.prompt([
          { type: 'input', name: 'botToken', message: 'Slack bot token (xoxb-...):', default: config.channels.slack.botToken },
          { type: 'input', name: 'appToken', message: 'Slack app token (xapp-...):', default: config.channels.slack.appToken },
        ]);
        config.channels.slack.botToken = botToken;
        config.channels.slack.appToken = appToken;
        break;
      }
      case 'gmail': {
        const { credPath } = await inquirer.prompt([{
          type: 'input',
          name: 'credPath',
          message: 'Path to Google OAuth credentials JSON:',
          default: config.channels.gmail.credentialsPath || '',
        }]);
        config.channels.gmail.credentialsPath = credPath;
        break;
      }
      case 'whatsapp': {
        console.log(chalk.dim('  WhatsApp will ask you to scan a QR code on first start.'));
        break;
      }
    }

    // Ask for per-channel endpoint override (skip webchat)
    if (ch !== 'webchat') {
      const { customEndpoint } = await inquirer.prompt([{
        type: 'input',
        name: 'customEndpoint',
        message: `Custom agent endpoint for ${ch} (blank = use default):`,
        default: config.channels[ch].endpoint || '',
      }]);
      config.channels[ch].endpoint = customEndpoint;
    }
  }

  // Disable unselected channels
  for (const ch of Object.keys(config.channels)) {
    if (!channels.includes(ch) && ch !== 'webchat') {
      config.channels[ch].enabled = false;
    }
  }

  // Save
  saveConfig(config);

  console.log('');
  console.log(chalk.green.bold('  ✓ Setup complete!'));
  console.log('');
  console.log(`  Config saved to: ${chalk.dim(CONFIG_PATH)}`);
  console.log(`  Data directory:  ${chalk.dim(DATA_DIR)}`);
  console.log('');
  console.log('  Start the gateway:');
  console.log(chalk.cyan('    npm start'));
  console.log('');
  console.log('  Or with env vars:');
  console.log(chalk.cyan(`    EMPLI_ENDPOINT=${endpoint} npm start`));
  console.log('');
}

async function gmailAuth(code) {
  if (!code) {
    console.error('Usage: empli gmail-auth <authorization-code>');
    process.exit(1);
  }

  const config = loadConfig();
  const credPath = config.channels.gmail?.credentialsPath;
  if (!credPath) {
    console.error('Gmail credentials not configured. Run: empli onboard');
    process.exit(1);
  }

  const { google } = await import('googleapis');
  const credentials = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0]);

  const { tokens } = await oauth2Client.getToken(code);
  const tokenPath = config.channels.gmail.tokenPath ||
    `${process.env.HOME || '.'}/.empli/gmail-token.json`;

  fs.mkdirSync(fs.dirname ? require('path').dirname(tokenPath) : '.', { recursive: true });
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  console.log(`✓ Gmail token saved to ${tokenPath}`);
}

async function showStatus() {
  const config = loadConfig();
  console.log('');
  console.log('  Empli Gateway Status');
  console.log(`  Default endpoint: ${config.endpoint || '(not set)'}`);
  console.log('  Channels:');
  for (const [name, ch] of Object.entries(config.channels)) {
    const icon = ch.enabled ? '✓' : '✗';
    const ep = ch.endpoint ? ` → ${ch.endpoint}` : '';
    console.log(`    ${icon} ${name}: ${ch.enabled ? 'enabled' : 'disabled'}${ep}`);
  }
  console.log('');
}

function showConfig() {
  console.log(JSON.stringify(loadConfig(), null, 2));
}

function printHelp() {
  console.log(`
  Empli Gateway CLI

  Commands:
    onboard      Interactive setup wizard
    status       Show current configuration
    config       Print full config as JSON
    gmail-auth   Complete Gmail OAuth (after visiting auth URL)

  Quick Start:
    empli onboard
    npm start

  Environment Variables:
    EMPLI_ENDPOINT     Agent API URL
    TELEGRAM_BOT_TOKEN    Telegram bot token
    DISCORD_BOT_TOKEN     Discord bot token
    SLACK_BOT_TOKEN       Slack bot token (xoxb-)
    SLACK_APP_TOKEN       Slack app token (xapp-)
    GMAIL_CREDENTIALS     Path to Google OAuth JSON
    WHATSAPP_ENABLED      Set to "true" to enable WhatsApp
  `);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
