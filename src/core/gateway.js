// ═══════════════════════════════════════════════════════════════
// Empli Gateway — Core
// The brain: manages sessions, routes messages, calls your agent
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class Gateway {
  constructor(config) {
    this.config = config;
    this.channels = new Map();       // channelName → channel instance
    this.sessions = new Map();       // sessionKey → { history, lastActivity }
    this.locks = new Map();          // sessionKey → Promise chain
    this.dataDir = config.dataDir || path.join(process.env.HOME || '.', '.empli');
    this.sessionsDir = path.join(this.dataDir, 'sessions');
    this.memoryDir = path.join(this.dataDir, 'memory');

    // Ensure dirs exist
    fs.mkdirSync(this.sessionsDir, { recursive: true });
    fs.mkdirSync(this.memoryDir, { recursive: true });

    console.log(`[Gateway] Data dir: ${this.dataDir}`);
    console.log(`[Gateway] Agent endpoint: ${config.endpoint}`);
  }

  // ─── Channel Management ───

  registerChannel(name, channel) {
    this.channels.set(name, channel);
    channel.gateway = this;
    console.log(`[Gateway] Registered channel: ${name}`);
  }

  async startAll() {
    for (const [name, channel] of this.channels) {
      try {
        await channel.start();
        console.log(`[Gateway] ✓ ${name} started`);
      } catch (err) {
        console.error(`[Gateway] ✗ ${name} failed:`, err.message);
      }
    }
    console.log(`[Gateway] All channels initialized`);
  }

  async stopAll() {
    for (const [name, channel] of this.channels) {
      try {
        await channel.stop();
        console.log(`[Gateway] ${name} stopped`);
      } catch (err) {
        // Ignore stop errors
      }
    }
  }

  // ─── Message Processing (with per-session locking) ───

  async handleMessage({ channel, chatId, chatName, sender, text, timestamp, metadata }) {
    const sessionKey = `${channel}:${chatId}`;

    // Per-session lock: queue messages so they process one at a time
    const prevLock = this.locks.get(sessionKey) || Promise.resolve();
    const currentLock = prevLock.then(() =>
      this._processMessage({ channel, chatId, chatName, sender, text, timestamp, sessionKey, metadata })
    ).catch(err => {
      console.error(`[Gateway] Error processing ${sessionKey}:`, err.message);
      return null;
    });
    this.locks.set(sessionKey, currentLock);

    return currentLock;
  }

  async _processMessage({ channel, chatId, chatName, sender, text, timestamp, sessionKey, metadata }) {
    // Load or create session
    const session = this._loadSession(sessionKey);

    // Add user message to history
    session.history.push({
      role: 'user',
      content: text,
      sender,
      timestamp: timestamp || Date.now(),
      channel,
    });

    // Keep history manageable (last N messages for API context)
    const maxHistory = this.config.maxHistory || 20;
    if (session.history.length > maxHistory) {
      session.history = session.history.slice(-maxHistory);
    }

    // Resolve endpoint: per-channel override → default
    const channelConfig = this.config.channels?.[channel] || {};
    const endpoint = channelConfig.endpoint || this.config.endpoint;

    if (!endpoint) {
      console.error(`[Gateway] No endpoint for channel ${channel} and no default set`);
      return null;
    }

    // Build context for the agent
    const context = {
      platform: channel,
      chatId,
      chatName: chatName || sender,
      sender,
      history: session.history,
      conversationId: session.conversationId,
      metadata,
    };

    // Call Empli agent
    const agentResponse = await this._callAgent(endpoint, context);

    if (!agentResponse || !agentResponse.reply) {
      console.log(`[Gateway] No reply from agent for ${sessionKey}`);
      return null;
    }

    // Store conversation ID from agent (for session continuity)
    if (agentResponse.conversationId) {
      session.conversationId = agentResponse.conversationId;
    }

    // Add assistant response to history
    session.history.push({
      role: 'assistant',
      content: agentResponse.reply,
      timestamp: Date.now(),
    });

    session.lastActivity = Date.now();
    this._saveSession(sessionKey, session);

    return {
      reply: agentResponse.reply,
      sessionKey,
    };
  }

  // ─── Agent API ───

  async _callAgent(endpoint, context) {
    try {
      // Build the message to send to Empli
      const body = {
        message: context.history[context.history.length - 1].content,
        platform: context.platform,
        chatId: context.chatId,
        chatName: context.chatName,
        sender: context.sender,
        conversationId: context.conversationId || null,
        history: context.history.slice(-10).map(h => ({
          role: h.role,
          content: h.content,
        })),
      };

      const url = endpoint.endsWith('/')
        ? `${endpoint}?route=chat`
        : `${endpoint}/?route=chat`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000), // 60s timeout
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`[Gateway] Agent API error ${response.status}: ${errText.substring(0, 200)}`);
        return null;
      }

      const data = await response.json();

      return {
        reply: data.reply || data.response || data.text || null,
        conversationId: data.conversationId || data.conversation_id || null,
      };
    } catch (err) {
      console.error(`[Gateway] Agent API call failed:`, err.message);
      return null;
    }
  }

  // ─── Session Persistence ───

  _loadSession(sessionKey) {
    // Check memory first
    if (this.sessions.has(sessionKey)) {
      return this.sessions.get(sessionKey);
    }

    // Try loading from disk
    const filePath = this._sessionPath(sessionKey);
    let session = { history: [], conversationId: null, lastActivity: Date.now() };

    if (fs.existsSync(filePath)) {
      try {
        const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
        session.history = lines.map(l => JSON.parse(l));
        // Extract conversationId from last assistant message if present
        const lastAssistant = [...session.history].reverse().find(h => h.role === 'assistant');
        if (lastAssistant?.conversationId) {
          session.conversationId = lastAssistant.conversationId;
        }
      } catch (err) {
        console.warn(`[Gateway] Failed to load session ${sessionKey}:`, err.message);
        session = { history: [], conversationId: null, lastActivity: Date.now() };
      }
    }

    this.sessions.set(sessionKey, session);
    return session;
  }

  _saveSession(sessionKey, session) {
    this.sessions.set(sessionKey, session);

    const filePath = this._sessionPath(sessionKey);
    const data = session.history.map(h => JSON.stringify(h)).join('\n') + '\n';
    fs.writeFileSync(filePath, data, 'utf-8');
  }

  _sessionPath(sessionKey) {
    const safe = sessionKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.sessionsDir, `${safe}.jsonl`);
  }

  // ─── Session Cleanup ───

  cleanExpiredSessions(maxAge = 2 * 60 * 60 * 1000) {
    const now = Date.now();
    for (const [key, session] of this.sessions) {
      if (now - session.lastActivity > maxAge) {
        this.sessions.delete(key);
      }
    }
  }

  // ─── Memory (save/search for future use) ───

  saveMemory(key, content) {
    const filePath = path.join(this.memoryDir, `${key}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  searchMemory(query) {
    const results = [];
    const words = query.toLowerCase().split(/\s+/);

    if (!fs.existsSync(this.memoryDir)) return results;

    for (const file of fs.readdirSync(this.memoryDir)) {
      if (!file.endsWith('.md')) continue;
      const content = fs.readFileSync(path.join(this.memoryDir, file), 'utf-8');
      if (words.some(w => content.toLowerCase().includes(w))) {
        results.push({ key: file.replace('.md', ''), content });
      }
    }
    return results;
  }

  // ─── Status ───

  getStatus() {
    const channels = {};
    for (const [name, ch] of this.channels) {
      const channelConfig = this.config.channels?.[name] || {};
      const resolvedEndpoint = channelConfig.endpoint || this.config.endpoint;
      channels[name] = {
        status: ch.getStatus ? ch.getStatus() : 'registered',
        endpoint: resolvedEndpoint,
      };
    }
    return {
      defaultEndpoint: this.config.endpoint,
      channels,
      activeSessions: this.sessions.size,
      dataDir: this.dataDir,
    };
  }
}
