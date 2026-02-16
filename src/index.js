#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// airminal Gateway — Main Entry
// ═══════════════════════════════════════════════════════════════

import { Gateway } from './core/gateway.js';
import { loadConfig } from './core/config.js';
import { WhatsAppChannel } from './channels/whatsapp.js';
import { TelegramChannel } from './channels/telegram.js';
import { DiscordChannel } from './channels/discord.js';
import { SlackChannel } from './channels/slack.js';
import { GmailChannel } from './channels/gmail.js';
import { WebChatChannel } from './channels/webchat.js';

async function main() {
  console.log('');
  console.log('  ╔═══════════════════════════════════╗');
  console.log('  ║        Airminal Gateway v1.0       ║');
  console.log('  ║  Your agent, everywhere you chat   ║');
  console.log('  ╚═══════════════════════════════════╝');
  console.log('');

  // Load config
  const config = loadConfig();

  if (!config.endpoint) {
    console.error('[Gateway] No agent endpoint configured!');
    console.error('  Set airminal_ENDPOINT env var or run: airminal onboard');
    console.error('  Example: airminal_ENDPOINT=https://simon.airminal.com/api/ node src/index.js');
    process.exit(1);
  }

  // Create gateway
  const gateway = new Gateway(config);

  // Register enabled channels
  const ch = config.channels;

  // WebChat always runs (local HTTP API)
  if (ch.webchat?.enabled !== false) {
    gateway.registerChannel('webchat', new WebChatChannel(ch.webchat));
  }

  if (ch.whatsapp?.enabled) {
    gateway.registerChannel('whatsapp', new WhatsAppChannel(ch.whatsapp));
  }

  if (ch.telegram?.enabled) {
    gateway.registerChannel('telegram', new TelegramChannel(ch.telegram));
  }

  if (ch.discord?.enabled) {
    gateway.registerChannel('discord', new DiscordChannel(ch.discord));
  }

  if (ch.slack?.enabled) {
    gateway.registerChannel('slack', new SlackChannel(ch.slack));
  }

  if (ch.gmail?.enabled) {
    gateway.registerChannel('gmail', new GmailChannel(ch.gmail));
  }

  // Start all channels
  await gateway.startAll();

  // Session cleanup every 30 min
  setInterval(() => gateway.cleanExpiredSessions(), 30 * 60 * 1000);

  // Print status
  const status = gateway.getStatus();
  console.log('');
  console.log('[Gateway] Status:');
  console.log(`  Default endpoint: ${status.defaultEndpoint}`);
  for (const [name, info] of Object.entries(status.channels)) {
    const icon = info.status === 'connected' ? '✓' : info.status === 'needs_auth' ? '⚠' : '✗';
    const epNote = info.endpoint !== status.defaultEndpoint ? ` → ${info.endpoint}` : '';
    console.log(`  ${icon} ${name}: ${info.status}${epNote}`);
  }
  console.log(`  Sessions: ${status.activeSessions}`);
  console.log('');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Gateway] Shutting down...');
    await gateway.stopAll();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
