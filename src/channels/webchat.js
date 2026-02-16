// ═══════════════════════════════════════════════════════════════
// WebChat Channel — HTTP API + simple web UI
// Always-on local endpoint for testing and custom integrations
// ═══════════════════════════════════════════════════════════════

import { BaseChannel } from './base.js';
import express from 'express';

export class WebChatChannel extends BaseChannel {
  constructor(config = {}) {
    super('webchat', config);
    this.app = null;
    this.server = null;
  }

  async start() {
    const port = this.config.port || 3456;

    this.app = express();
    this.app.use(express.json());

    // ── API: POST /chat ──
    this.app.post('/chat', async (req, res) => {
      const { message, user_id, chat_name } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'message required' });
      }

      const userId = user_id || 'web_user';
      const result = await this.onMessage({
        chatId: `web_${userId}`,
        chatName: chat_name || 'WebChat',
        sender: userId,
        text: message,
        timestamp: Date.now(),
      });

      res.json({
        reply: result?.reply || null,
        sessionKey: result?.sessionKey || null,
      });
    });

    // ── API: GET /status ──
    this.app.get('/status', (req, res) => {
      res.json(this.gateway?.getStatus() || { error: 'no gateway' });
    });

    // ── API: GET /health ──
    this.app.get('/health', (req, res) => {
      res.json({ ok: true, uptime: process.uptime() });
    });

    // ── Simple Web UI ──
    this.app.get('/', (req, res) => {
      res.send(WEB_UI_HTML);
    });

    this.server = this.app.listen(port, () => {
      this.status = 'connected';
      console.log(`[WebChat] ✓ Listening on http://localhost:${port}`);
    });
  }

  async stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    super.stop();
  }

  getStatus() {
    return this.status;
  }
}

const WEB_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Empli Gateway</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #0a0a0a; color: #e0e0e0; height: 100vh; display: flex; flex-direction: column; }
  .header { padding: 16px 24px; border-bottom: 1px solid #222; display: flex; align-items: center; gap: 12px; }
  .header h1 { font-size: 18px; font-weight: 600; }
  .header .dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; }
  .messages { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 12px; }
  .msg { max-width: 70%; padding: 12px 16px; border-radius: 12px; line-height: 1.5; font-size: 14px; white-space: pre-wrap; }
  .msg.user { background: #1d4ed8; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
  .msg.bot { background: #1a1a1a; border: 1px solid #333; align-self: flex-start; border-bottom-left-radius: 4px; }
  .msg.typing { opacity: 0.5; }
  .input-bar { padding: 16px 24px; border-top: 1px solid #222; display: flex; gap: 12px; }
  .input-bar input { flex: 1; background: #1a1a1a; border: 1px solid #333; border-radius: 8px;
                      padding: 12px 16px; color: white; font-size: 14px; outline: none; }
  .input-bar input:focus { border-color: #1d4ed8; }
  .input-bar button { background: #1d4ed8; color: white; border: none; border-radius: 8px;
                       padding: 12px 20px; cursor: pointer; font-size: 14px; font-weight: 500; }
  .input-bar button:hover { background: #2563eb; }
  .input-bar button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
</head>
<body>
  <div class="header"><div class="dot"></div><h1>Empli Gateway</h1></div>
  <div class="messages" id="messages"></div>
  <div class="input-bar">
    <input type="text" id="input" placeholder="Send a message..." autocomplete="off" />
    <button id="send" onclick="send()">Send</button>
  </div>
<script>
const msgs = document.getElementById('messages');
const inp = document.getElementById('input');
const btn = document.getElementById('send');

inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) send(); });

async function send() {
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  addMsg(text, 'user');
  btn.disabled = true;

  const typing = addMsg('Thinking...', 'bot typing');
  try {
    const res = await fetch('/chat', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    typing.remove();
    addMsg(data.reply || 'No response', 'bot');
  } catch(e) {
    typing.remove();
    addMsg('Error: ' + e.message, 'bot');
  }
  btn.disabled = false;
  inp.focus();
}

function addMsg(text, cls) {
  const div = document.createElement('div');
  div.className = 'msg ' + cls;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}
</script>
</body>
</html>`;
