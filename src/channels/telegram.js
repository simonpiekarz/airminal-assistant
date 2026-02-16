// ═══════════════════════════════════════════════════════════════
// Telegram Channel — via Telegraf (Bot API)
// Create a bot via @BotFather, get the token
// ═══════════════════════════════════════════════════════════════

import { BaseChannel } from './base.js';

export class TelegramChannel extends BaseChannel {
  constructor(config = {}) {
    super('telegram', config);
    this.bot = null;
  }

  async start() {
    if (!this.config.token) {
      throw new Error('Telegram bot token required. Get one from @BotFather');
    }

    this.status = 'connecting';
    const { Telegraf } = await import('telegraf');

    this.bot = new Telegraf(this.config.token);

    // Handle text messages
    this.bot.on('text', async (ctx) => {
      const msg = ctx.message;
      const chat = msg.chat;
      const sender = msg.from;

      // Apply allowlist
      const senderId = String(sender.id);
      if (this.config.allowList?.length && !this.config.allowList.includes(senderId)) return;
      if (this.config.blockList?.length && this.config.blockList.includes(senderId)) return;

      // Skip groups unless configured
      const isGroup = chat.type === 'group' || chat.type === 'supergroup';
      if (isGroup && !this.config.allowGroups) {
        // In groups, only respond if bot is mentioned or replied to
        const botInfo = await this.bot.telegram.getMe();
        const isMentioned = msg.text?.includes(`@${botInfo.username}`);
        const isReply = msg.reply_to_message?.from?.id === botInfo.id;
        if (!isMentioned && !isReply) return;
      }

      const senderName = [sender.first_name, sender.last_name].filter(Boolean).join(' ') || sender.username || senderId;

      // Send typing indicator
      await ctx.sendChatAction('typing');

      const result = await this.onMessage({
        chatId: String(chat.id),
        chatName: chat.title || senderName,
        sender: senderName,
        text: msg.text,
        timestamp: msg.date * 1000,
        metadata: {
          isGroup,
          messageId: String(msg.message_id),
          username: sender.username,
        },
      });

      if (result?.reply) {
        // Keep typing indicator going for long responses
        await ctx.sendChatAction('typing');

        // Split long messages (Telegram limit: 4096 chars)
        const chunks = splitMessage(result.reply, 4096);
        for (const chunk of chunks) {
          await ctx.reply(chunk, {
            reply_to_message_id: isGroup ? msg.message_id : undefined,
          });
        }
      }
    });

    // Handle /start command
    this.bot.start((ctx) => {
      ctx.reply('Hey! I\'m your Empli agent. Send me a message to get started.');
    });

    // Launch bot
    await this.bot.launch();
    this.status = 'connected';
    console.log('[Telegram] ✓ Bot started');

    // Graceful stop
    process.once('SIGINT', () => this.bot?.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot?.stop('SIGTERM'));
  }

  async stop() {
    if (this.bot) {
      this.bot.stop();
      this.bot = null;
    }
    super.stop();
  }

  getStatus() {
    return this.status;
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
    // Try to split at newline
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.5) splitAt = maxLen;
    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).trimStart();
  }
  return chunks;
}
