// ═══════════════════════════════════════════════════════════════
// Base Channel — all platform adapters extend this
// ═══════════════════════════════════════════════════════════════

export class BaseChannel {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.gateway = null;  // Set by gateway.registerChannel()
    this.status = 'stopped';
  }

  // Override in subclass
  async start() { throw new Error('start() not implemented'); }
  async stop() { this.status = 'stopped'; }

  // Send a message to the gateway for processing, get reply
  async onMessage({ chatId, chatName, sender, text, timestamp, metadata }) {
    if (!this.gateway) {
      console.error(`[${this.name}] No gateway attached`);
      return null;
    }

    console.log(`[${this.name}] ← ${sender}: ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`);

    const result = await this.gateway.handleMessage({
      channel: this.name,
      chatId,
      chatName,
      sender,
      text,
      timestamp,
      metadata,
    });

    if (result?.reply) {
      console.log(`[${this.name}] → ${result.reply.substring(0, 80)}${result.reply.length > 80 ? '...' : ''}`);
    }

    return result;
  }

  getStatus() {
    return this.status;
  }
}
