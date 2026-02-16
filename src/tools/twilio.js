// ═══════════════════════════════════════════════════════════════
// Empli Gateway — Twilio Tools
// SMS, Phone Calls, Voice — via Twilio REST API
// Requires Account SID, Auth Token, and a Twilio phone number
// ═══════════════════════════════════════════════════════════════

export const TWILIO_TOOL_DEFINITIONS = [
  {
    name: 'sms_send',
    description: 'Send an SMS text message to a phone number. Use for: sending notifications, reminders, alerts, quick messages to contacts.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient phone number in E.164 format (e.g. "+1234567890")' },
        body: { type: 'string', description: 'Message text (max 1600 chars)' },
        media_url: { type: 'string', description: 'URL of an image/media to attach (MMS, optional)' },
      },
      required: ['to', 'body'],
    },
  },
  {
    name: 'sms_list',
    description: 'List recent SMS messages sent or received. Use for: checking message history, verifying delivery.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Filter by recipient number (optional)' },
        from: { type: 'string', description: 'Filter by sender number (optional)' },
        max_results: { type: 'number', description: 'Max messages (default: 20)' },
        date_sent: { type: 'string', description: 'Filter by date (YYYY-MM-DD)' },
      },
      required: [],
    },
  },
  {
    name: 'call_make',
    description: 'Make a phone call. Can speak text (TTS) or play an audio URL. Use for: automated calls, reminders, alerts, voice notifications.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Phone number to call in E.164 format' },
        message: { type: 'string', description: 'Text to speak via TTS when call is answered' },
        voice: { type: 'string', enum: ['alice', 'man', 'woman', 'Polly.Joanna', 'Polly.Matthew', 'Polly.Amy', 'Google.en-US-Wavenet-D'], description: 'TTS voice (default: "alice")' },
        audio_url: { type: 'string', description: 'URL of audio file to play instead of TTS (optional)' },
        record: { type: 'boolean', description: 'Record the call (default: false)' },
      },
      required: ['to', 'message'],
    },
  },
  {
    name: 'call_list',
    description: 'List recent phone calls made or received.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Filter by recipient' },
        from: { type: 'string', description: 'Filter by caller' },
        status: { type: 'string', enum: ['queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer'], description: 'Filter by status' },
        max_results: { type: 'number', description: 'Max results (default: 20)' },
      },
      required: [],
    },
  },
  {
    name: 'phone_lookup',
    description: 'Look up information about a phone number. Returns carrier, type (mobile/landline), and country.',
    input_schema: {
      type: 'object',
      properties: {
        number: { type: 'string', description: 'Phone number in E.164 format' },
      },
      required: ['number'],
    },
  },
];


export class TwilioToolExecutor {
  constructor(config = {}) {
    this.accountSid = config.accountSid || process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = config.authToken || process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = config.fromNumber || process.env.TWILIO_PHONE_NUMBER || '';
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`;
  }

  async execute(toolName, input) {
    if (!this.accountSid || !this.authToken) {
      return { error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.' };
    }
    try {
      switch (toolName) {
        case 'sms_send': return await this.smsSend(input);
        case 'sms_list': return await this.smsList(input);
        case 'call_make': return await this.callMake(input);
        case 'call_list': return await this.callList(input);
        case 'phone_lookup': return await this.phoneLookup(input);
        default: return { error: `Unknown Twilio tool: ${toolName}` };
      }
    } catch (err) {
      return { error: `${toolName} failed: ${err.message}` };
    }
  }

  async _api(method, endpoint, body) {
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const opts = {
      method,
      headers: { 'Authorization': `Basic ${auth}` },
      signal: AbortSignal.timeout(30000),
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      opts.body = new URLSearchParams(body).toString();
    }
    const res = await fetch(`${this.baseUrl}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  }

  async smsSend(input) {
    const body = { To: input.to, From: this.fromNumber, Body: input.body };
    if (input.media_url) body.MediaUrl = input.media_url;
    const data = await this._api('POST', '/Messages.json', body);
    return { success: true, sid: data.sid, to: data.to, status: data.status };
  }

  async smsList(input) {
    const { to, from, max_results = 20, date_sent } = input;
    let q = `?PageSize=${max_results}`;
    if (to) q += `&To=${encodeURIComponent(to)}`;
    if (from) q += `&From=${encodeURIComponent(from)}`;
    if (date_sent) q += `&DateSent=${date_sent}`;
    const data = await this._api('GET', `/Messages.json${q}`);
    return { messages: (data.messages || []).map(m => ({ sid: m.sid, from: m.from, to: m.to, body: m.body, status: m.status, date: m.date_sent, direction: m.direction })), count: (data.messages || []).length };
  }

  async callMake(input) {
    const { to, message, voice = 'alice', audio_url, record } = input;
    let twiml;
    if (audio_url) {
      twiml = `<Response><Play>${audio_url}</Play></Response>`;
    } else {
      twiml = `<Response><Say voice="${voice}">${message.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Say></Response>`;
    }
    const body = { To: to, From: this.fromNumber, Twiml: twiml };
    if (record) body.Record = 'true';
    const data = await this._api('POST', '/Calls.json', body);
    return { success: true, sid: data.sid, to: data.to, status: data.status };
  }

  async callList(input) {
    const { to, from, status, max_results = 20 } = input;
    let q = `?PageSize=${max_results}`;
    if (to) q += `&To=${encodeURIComponent(to)}`;
    if (from) q += `&From=${encodeURIComponent(from)}`;
    if (status) q += `&Status=${status}`;
    const data = await this._api('GET', `/Calls.json${q}`);
    return { calls: (data.calls || []).map(c => ({ sid: c.sid, from: c.from, to: c.to, status: c.status, duration: c.duration, date: c.start_time, direction: c.direction })), count: (data.calls || []).length };
  }

  async phoneLookup(input) {
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const res = await fetch(`https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(input.number)}?Fields=line_type_intelligence`, {
      headers: { 'Authorization': `Basic ${auth}` },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    return { number: data.phone_number, country: data.country_code, valid: data.valid, type: data.line_type_intelligence?.type, carrier: data.line_type_intelligence?.carrier_name };
  }
}
