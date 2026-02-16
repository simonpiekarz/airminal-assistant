// ═══════════════════════════════════════════════════════════════
// Discord Channel — via discord.js
// Create a bot at discord.com/developers, get the token
// ═══════════════════════════════════════════════════════════════

import { BaseChannel } from './base.js';

export class DiscordChannel extends BaseChannel {
  constructor(config = {}) {
    super('discord', config);
    this.client = null;
    this.botId = null;
  }

  async start() {
    if (!this.config.token) {
      throw new Error('Discord bot token required. Create one at discord.com/developers/applications');
    }

    this.status = 'connecting';
    const { Client, GatewayIntentBits, Partials } = await import('discord.js');

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    this.client.on('ready', () => {
      this.botId = this.client.user.id;
      this.status = 'connected';
      console.log(`[Discord] ✓ Logged in as ${this.client.user.tag}`);
    });

    this.client.on('messageCreate', async (msg) => {
      // Skip bot messages
      if (msg.author.bot) return;
      if (msg.author.id === this.botId) return;

      const isDM = !msg.guild;
      const isGuild = !!msg.guild;

      // In servers: only respond when mentioned or in allowed channels
      if (isGuild && !this.config.allowGroups) {
        const isMentioned = msg.mentions.has(this.botId);
        const isAllowedChannel = this.config.channelList?.includes(msg.channel.id);
        if (!isMentioned && !isAllowedChannel) return;
      }

      // Apply user allowlist
      const userId = msg.author.id;
      if (this.config.allowList?.length && !this.config.allowList.includes(userId)) return;
      if (this.config.blockList?.length && this.config.blockList.includes(userId)) return;

      // Clean up mention from text
      let text = msg.content;
      if (isGuild && this.botId) {
        text = text.replace(new RegExp(`<@!?${this.botId}>`, 'g'), '').trim();
      }
      if (!text) return;

      // Typing indicator
      await msg.channel.sendTyping();

      const result = await this.onMessage({
        chatId: isDM ? `dm_${userId}` : msg.channel.id,
        chatName: isDM ? msg.author.displayName : `#${msg.channel.name}`,
        sender: msg.author.displayName || msg.author.username,
        text,
        timestamp: msg.createdTimestamp,
        metadata: {
          isGroup: isGuild,
          messageId: msg.id,
          channelId: msg.channel.id,
          guildId: msg.guild?.id,
        },
      });

      if (result?.reply) {
        // Split long messages (Discord limit: 2000 chars)
        const chunks = splitMessage(result.reply, 2000);
        for (const chunk of chunks) {
          await msg.reply(chunk);
        }
      }
    });

    await this.client.login(this.config.token);
  }

  async stop() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
    super.stop();
  }

  getStatus() {
    return this.client?.isReady() ? 'connected' : this.status;
  }
}

function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.5) splitAt = maxLen;
    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).trimStart();
  }
  return chunks;
}
