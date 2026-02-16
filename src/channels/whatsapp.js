// ═══════════════════════════════════════════════════════════════
// WhatsApp Channel — via whatsapp-web.js
// Uses the real WhatsApp Web protocol, auth via QR code
// ═══════════════════════════════════════════════════════════════

import { BaseChannel } from './base.js';

export class WhatsAppChannel extends BaseChannel {
  constructor(config = {}) {
    super('whatsapp', config);
    this.client = null;
    this.ready = false;
  }

  async start() {
    this.status = 'connecting';

    // Dynamic import (heavy dependency)
    const { Client, LocalAuth } = await import('whatsapp-web.js');
    const qrcode = await import('qrcode-terminal');

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: this.config.sessionDir || undefined,
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      },
    });

    // QR code for first-time auth
    this.client.on('qr', (qr) => {
      console.log('\n[WhatsApp] Scan this QR code with WhatsApp:');
      qrcode.default.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      this.ready = true;
      this.status = 'connected';
      console.log('[WhatsApp] ✓ Connected and ready');
    });

    this.client.on('authenticated', () => {
      console.log('[WhatsApp] Authenticated (session saved)');
    });

    this.client.on('auth_failure', (msg) => {
      this.status = 'auth_failed';
      console.error('[WhatsApp] Auth failed:', msg);
    });

    this.client.on('disconnected', (reason) => {
      this.ready = false;
      this.status = 'disconnected';
      console.log('[WhatsApp] Disconnected:', reason);
    });

    // Handle incoming messages
    this.client.on('message', async (msg) => {
      // Skip own messages, status updates, group messages (configurable)
      if (msg.fromMe) return;
      if (msg.isStatus) return;

      // Skip groups unless configured to respond
      const chat = await msg.getChat();
      if (chat.isGroup && !this.config.allowGroups) return;

      // Apply allowlist/blocklist
      const contact = await msg.getContact();
      const senderId = msg.from;
      const senderName = contact.pushname || contact.name || senderId;

      if (this.config.allowList?.length && !this.config.allowList.includes(senderId)) return;
      if (this.config.blockList?.length && this.config.blockList.includes(senderId)) return;

      // Only handle text messages for now
      if (msg.type !== 'chat') return;

      const result = await this.onMessage({
        chatId: msg.from,
        chatName: chat.isGroup ? chat.name : senderName,
        sender: senderName,
        text: msg.body,
        timestamp: msg.timestamp * 1000,
        metadata: {
          isGroup: chat.isGroup,
          messageId: msg.id._serialized,
        },
      });

      if (result?.reply) {
        // Typing indicator
        await chat.sendStateTyping();
        // Simulate typing delay (more natural)
        const delay = Math.min(result.reply.length * 30, 5000);
        await new Promise(r => setTimeout(r, delay));
        await chat.clearState();

        await msg.reply(result.reply);
      }
    });

    await this.client.initialize();
  }

  async stop() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
    this.ready = false;
    super.stop();
  }

  getStatus() {
    return this.ready ? 'connected' : this.status;
  }
}
