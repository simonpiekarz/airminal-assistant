// ═══════════════════════════════════════════════════════════════
// Gmail Channel — via Google APIs
// Uses OAuth2 for auth, polls for new emails, sends replies
// ═══════════════════════════════════════════════════════════════

import { BaseChannel } from './base.js';
import fs from 'fs';
import path from 'path';

export class GmailChannel extends BaseChannel {
  constructor(config = {}) {
    super('gmail', config);
    this.gmail = null;
    this.auth = null;
    this.pollInterval = null;
    this.processedIds = new Set();
    this.lastCheck = null;
  }

  async start() {
    if (!this.config.credentialsPath) {
      throw new Error('Gmail requires OAuth2 credentials. Download from console.cloud.google.com');
    }

    this.status = 'connecting';
    const { google } = await import('googleapis');

    // Load OAuth credentials
    const credentials = JSON.parse(fs.readFileSync(this.config.credentialsPath, 'utf-8'));
    const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

    const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0] || 'http://localhost:3000/callback');

    // Load saved tokens
    const tokenPath = this.config.tokenPath || path.join(process.env.HOME || '.', '.empli', 'gmail-token.json');
    if (fs.existsSync(tokenPath)) {
      const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      oauth2Client.setCredentials(tokens);
    } else {
      // Generate auth URL for first-time setup
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
        ],
      });
      console.log('\n[Gmail] Authorize by visiting this URL:');
      console.log(authUrl);
      console.log('\nThen run: empli gmail-auth <code>');
      this.status = 'needs_auth';
      return;
    }

    this.auth = oauth2Client;
    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Mark existing unread as seen
    await this._markExistingAsSeen();

    // Start polling
    const interval = this.config.pollInterval || 15000;
    this.pollInterval = setInterval(() => this._poll(), interval);
    this.status = 'connected';
    console.log(`[Gmail] ✓ Connected, polling every ${interval / 1000}s`);
  }

  async _markExistingAsSeen() {
    try {
      const res = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread in:inbox',
        maxResults: 50,
      });
      for (const msg of res.data.messages || []) {
        this.processedIds.add(msg.id);
      }
      console.log(`[Gmail] Marked ${this.processedIds.size} existing unread as seen`);
    } catch (err) {
      console.error('[Gmail] Error marking existing:', err.message);
    }
  }

  async _poll() {
    try {
      const res = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread in:inbox',
        maxResults: 10,
      });

      for (const msg of res.data.messages || []) {
        if (this.processedIds.has(msg.id)) continue;
        this.processedIds.add(msg.id);

        await this._processEmail(msg.id);
      }
    } catch (err) {
      if (err.code === 401) {
        console.error('[Gmail] Token expired. Re-authorize.');
        this.status = 'needs_auth';
        clearInterval(this.pollInterval);
      } else {
        console.error('[Gmail] Poll error:', err.message);
      }
    }
  }

  async _processEmail(messageId) {
    const full = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = full.data.payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
    const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
    const to = headers.find(h => h.name === 'To')?.value || '';
    const threadId = full.data.threadId;
    const messageIdHeader = headers.find(h => h.name === 'Message-ID')?.value || '';

    // Extract sender name from "Name <email>" format
    const senderMatch = from.match(/^(.+?)\s*<(.+)>$/);
    const senderName = senderMatch ? senderMatch[1].replace(/"/g, '') : from;
    const senderEmail = senderMatch ? senderMatch[2] : from;

    // Apply allowlist/blocklist
    if (this.config.allowList?.length && !this.config.allowList.some(a => from.includes(a))) return;
    if (this.config.blockList?.length && this.config.blockList.some(b => from.includes(b))) return;

    // Extract body text
    const body = this._extractText(full.data.payload);
    const text = `[Email from: ${senderName} <${senderEmail}>]\n[Subject: ${subject}]\n\n${body}`;

    const result = await this.onMessage({
      chatId: `thread_${threadId}`,
      chatName: subject,
      sender: senderName,
      text,
      timestamp: parseInt(full.data.internalDate),
      metadata: {
        messageId,
        threadId,
        from: senderEmail,
        subject,
        messageIdHeader,
      },
    });

    if (result?.reply) {
      await this._sendReply(senderEmail, subject, result.reply, threadId, messageIdHeader);

      // Mark as read
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
    }
  }

  async _sendReply(to, subject, body, threadId, inReplyTo) {
    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

    const raw = [
      `To: ${to}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${inReplyTo}`,
      `References: ${inReplyTo}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');

    const encoded = Buffer.from(raw).toString('base64url');

    await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encoded,
        threadId,
      },
    });

    console.log(`[Gmail] ✓ Reply sent to ${to}`);
  }

  _extractText(payload) {
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        const text = this._extractText(part);
        if (text) return text;
      }
    }
    return '';
  }

  async stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    super.stop();
  }

  getStatus() {
    return this.status;
  }
}
