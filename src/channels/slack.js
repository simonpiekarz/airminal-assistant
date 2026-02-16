// ═══════════════════════════════════════════════════════════════
// Slack Channel — via @slack/bolt
// Create a Slack app at api.slack.com/apps, get bot + app tokens
// ═══════════════════════════════════════════════════════════════

import { BaseChannel } from './base.js';

export class SlackChannel extends BaseChannel {
  constructor(config = {}) {
    super('slack', config);
    this.app = null;
    this.botUserId = null;
  }

  async start() {
    if (!this.config.botToken || !this.config.appToken) {
      throw new Error('Slack requires botToken (xoxb-) and appToken (xapp-). Create at api.slack.com/apps');
    }

    this.status = 'connecting';
    const { App } = await import('@slack/bolt');

    this.app = new App({
      token: this.config.botToken,
      appToken: this.config.appToken,
      socketMode: true,
    });

    // Get bot user ID
    const auth = await this.app.client.auth.test();
    this.botUserId = auth.user_id;

    // Handle messages
    this.app.message(async ({ message, say, client }) => {
      // Skip bot messages
      if (message.bot_id || message.subtype) return;
      if (message.user === this.botUserId) return;

      const text = message.text || '';
      if (!text.trim()) return;

      // Apply allowlist
      if (this.config.allowList?.length && !this.config.allowList.includes(message.user)) return;

      // Get user info
      let senderName = message.user;
      try {
        const userInfo = await client.users.info({ user: message.user });
        senderName = userInfo.user.real_name || userInfo.user.name || message.user;
      } catch (e) {
        // Use ID as fallback
      }

      // Get channel info
      let chatName = message.channel;
      const isDM = message.channel_type === 'im';
      if (!isDM) {
        try {
          const chanInfo = await client.conversations.info({ channel: message.channel });
          chatName = `#${chanInfo.channel.name}`;
        } catch (e) {
          // Use ID as fallback
        }
      }

      const result = await this.onMessage({
        chatId: message.channel,
        chatName: isDM ? senderName : chatName,
        sender: senderName,
        text,
        timestamp: parseFloat(message.ts) * 1000,
        metadata: {
          isGroup: !isDM,
          messageId: message.ts,
          threadTs: message.thread_ts,
        },
      });

      if (result?.reply) {
        await say({
          text: result.reply,
          thread_ts: message.thread_ts || message.ts,
        });
      }
    });

    // Handle app mentions in channels
    this.app.event('app_mention', async ({ event, say, client }) => {
      let text = event.text.replace(new RegExp(`<@${this.botUserId}>`, 'g'), '').trim();
      if (!text) return;

      let senderName = event.user;
      try {
        const userInfo = await client.users.info({ user: event.user });
        senderName = userInfo.user.real_name || userInfo.user.name;
      } catch (e) {}

      const result = await this.onMessage({
        chatId: event.channel,
        chatName: `#${event.channel}`,
        sender: senderName,
        text,
        timestamp: parseFloat(event.ts) * 1000,
        metadata: { isGroup: true, messageId: event.ts },
      });

      if (result?.reply) {
        await say({
          text: result.reply,
          thread_ts: event.thread_ts || event.ts,
        });
      }
    });

    await this.app.start();
    this.status = 'connected';
  }

  async stop() {
    if (this.app) {
      await this.app.stop();
      this.app = null;
    }
    super.stop();
  }

  getStatus() {
    return this.status;
  }
}
