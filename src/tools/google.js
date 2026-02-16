// ═══════════════════════════════════════════════════════════════
// Empli Gateway — Google Tools
// Calendar, Drive, Sheets — full CRUD via Google APIs
// Requires OAuth2 credentials (same as Gmail channel)
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import os from 'os';

// ─────────────────────────────────────────────
// TOOL DEFINITIONS
// ─────────────────────────────────────────────

export const GOOGLE_TOOL_DEFINITIONS = [

  // ═══════════════════════════════════════
  // GOOGLE CALENDAR
  // ═══════════════════════════════════════

  {
    name: 'calendar_list_events',
    description: 'List upcoming events from Google Calendar. Returns event titles, times, locations, attendees, and descriptions. Use for: checking schedule, finding free time, reviewing upcoming meetings.',
    input_schema: {
      type: 'object',
      properties: {
        days_ahead: { type: 'number', description: 'How many days ahead to look (default: 7)' },
        max_results: { type: 'number', description: 'Maximum events to return (default: 20)' },
        calendar_id: { type: 'string', description: 'Calendar ID (default: "primary")' },
        query: { type: 'string', description: 'Search text to filter events (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'calendar_get_event',
    description: 'Get full details of a specific calendar event by its ID.',
    input_schema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: 'The event ID' },
        calendar_id: { type: 'string', description: 'Calendar ID (default: "primary")' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Create a new event on Google Calendar. Use for: scheduling meetings, setting reminders, blocking time, creating appointments.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title/summary' },
        start: { type: 'string', description: 'Start time in ISO 8601 format (e.g. "2026-03-15T09:00:00") or date for all-day ("2026-03-15")' },
        end: { type: 'string', description: 'End time in ISO 8601 (e.g. "2026-03-15T10:00:00") or date for all-day' },
        description: { type: 'string', description: 'Event description/notes (optional)' },
        location: { type: 'string', description: 'Event location (optional)' },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of attendee email addresses (optional)',
        },
        timezone: { type: 'string', description: 'Timezone (default: system timezone, e.g. "America/New_York")' },
        reminders: {
          type: 'array',
          items: { type: 'number' },
          description: 'Reminder minutes before event (e.g. [10, 60] for 10min and 1hr before)',
        },
        recurrence: { type: 'string', description: 'RRULE for recurring events (e.g. "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR")' },
        calendar_id: { type: 'string', description: 'Calendar ID (default: "primary")' },
        color: { type: 'string', description: 'Color ID 1-11 (optional)' },
      },
      required: ['title', 'start', 'end'],
    },
  },
  {
    name: 'calendar_update_event',
    description: 'Update an existing calendar event. Only provide fields you want to change.',
    input_schema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: 'The event ID to update' },
        title: { type: 'string', description: 'New title' },
        start: { type: 'string', description: 'New start time (ISO 8601)' },
        end: { type: 'string', description: 'New end time (ISO 8601)' },
        description: { type: 'string', description: 'New description' },
        location: { type: 'string', description: 'New location' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Updated attendee emails' },
        calendar_id: { type: 'string', description: 'Calendar ID (default: "primary")' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'calendar_delete_event',
    description: 'Delete a calendar event. CAUTION: confirm with user before deleting.',
    input_schema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: 'The event ID to delete' },
        calendar_id: { type: 'string', description: 'Calendar ID (default: "primary")' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'calendar_find_free_time',
    description: 'Find free slots in the calendar. Returns available time windows between existing events. Use for: scheduling new meetings, finding when user is available.',
    input_schema: {
      type: 'object',
      properties: {
        days_ahead: { type: 'number', description: 'How many days ahead to check (default: 7)' },
        min_duration_minutes: { type: 'number', description: 'Minimum free slot duration in minutes (default: 30)' },
        work_hours_start: { type: 'number', description: 'Start of work hours 0-23 (default: 9)' },
        work_hours_end: { type: 'number', description: 'End of work hours 0-23 (default: 17)' },
        calendar_id: { type: 'string', description: 'Calendar ID (default: "primary")' },
      },
      required: [],
    },
  },
  {
    name: 'calendar_list_calendars',
    description: 'List all available calendars (primary, shared, subscribed). Returns calendar names, IDs, and colors.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // ═══════════════════════════════════════
  // GOOGLE DRIVE
  // ═══════════════════════════════════════

  {
    name: 'drive_list_files',
    description: 'List files and folders in Google Drive. Returns names, types, sizes, last modified dates, and sharing status. Use for: finding documents, exploring folders, checking what\'s stored.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (optional). Searches file names and contents.' },
        folder_id: { type: 'string', description: 'Folder ID to list (default: root). Use "root" for top-level.' },
        max_results: { type: 'number', description: 'Maximum files to return (default: 20)' },
        type: { type: 'string', enum: ['all', 'documents', 'spreadsheets', 'presentations', 'pdfs', 'images', 'folders'], description: 'Filter by file type (default: "all")' },
        order_by: { type: 'string', enum: ['modified', 'name', 'created', 'size'], description: 'Sort order (default: "modified")' },
      },
      required: [],
    },
  },
  {
    name: 'drive_get_file',
    description: 'Get metadata and details about a specific file in Google Drive.',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'The file ID' },
      },
      required: ['file_id'],
    },
  },
  {
    name: 'drive_read_file',
    description: 'Read/download the content of a file from Google Drive. For Google Docs/Sheets/Slides, exports as text. For other files, downloads the raw content. Use for: reading documents, extracting data from spreadsheets, reviewing presentations.',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'The file ID to read' },
        export_format: { type: 'string', enum: ['text', 'pdf', 'csv', 'html', 'docx', 'xlsx'], description: 'Export format for Google files (default: "text")' },
        save_to: { type: 'string', description: 'Local path to save the file (optional — if omitted, returns content as text)' },
      },
      required: ['file_id'],
    },
  },
  {
    name: 'drive_upload_file',
    description: 'Upload a file from the local machine to Google Drive. Use for: backing up files, sharing documents, storing project files in the cloud.',
    input_schema: {
      type: 'object',
      properties: {
        local_path: { type: 'string', description: 'Path to the local file to upload' },
        name: { type: 'string', description: 'Name for the file in Drive (optional, defaults to local filename)' },
        folder_id: { type: 'string', description: 'Destination folder ID (optional, defaults to root)' },
        convert: { type: 'boolean', description: 'Convert to Google format (e.g. .docx → Google Doc). Default: false' },
      },
      required: ['local_path'],
    },
  },
  {
    name: 'drive_create_file',
    description: 'Create a new file directly in Google Drive from text content. Use for: creating new documents, saving notes, generating reports.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'File name (include extension, e.g. "report.txt", "notes.md")' },
        content: { type: 'string', description: 'Text content of the file' },
        folder_id: { type: 'string', description: 'Destination folder ID (optional)' },
        mime_type: { type: 'string', description: 'MIME type (optional, auto-detected from extension). Use "application/vnd.google-apps.document" for Google Doc.' },
      },
      required: ['name', 'content'],
    },
  },
  {
    name: 'drive_create_folder',
    description: 'Create a new folder in Google Drive.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Folder name' },
        parent_id: { type: 'string', description: 'Parent folder ID (optional, defaults to root)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'drive_delete_file',
    description: 'Move a file or folder to trash in Google Drive. CAUTION: confirm with user.',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'File or folder ID to trash' },
      },
      required: ['file_id'],
    },
  },
  {
    name: 'drive_share_file',
    description: 'Share a file or folder with someone. Can set viewer, commenter, or editor access.',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'File ID to share' },
        email: { type: 'string', description: 'Email address to share with' },
        role: { type: 'string', enum: ['reader', 'commenter', 'writer'], description: 'Access level (default: "reader")' },
        notify: { type: 'boolean', description: 'Send notification email (default: true)' },
        message: { type: 'string', description: 'Message to include in the notification (optional)' },
      },
      required: ['file_id', 'email'],
    },
  },
  {
    name: 'drive_move_file',
    description: 'Move a file to a different folder in Google Drive.',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'File ID to move' },
        to_folder_id: { type: 'string', description: 'Destination folder ID' },
      },
      required: ['file_id', 'to_folder_id'],
    },
  },

  // ═══════════════════════════════════════
  // GOOGLE SHEETS
  // ═══════════════════════════════════════

  {
    name: 'sheets_read',
    description: 'Read data from a Google Sheets spreadsheet. Returns cell values as a 2D array. Use for: reading tables, extracting data, checking values, analyzing spreadsheet data.',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheet_id: { type: 'string', description: 'The spreadsheet ID (from the URL)' },
        range: { type: 'string', description: 'Cell range in A1 notation (e.g. "Sheet1!A1:D10", "A:A", "Sheet1"). Default: entire first sheet.' },
      },
      required: ['spreadsheet_id'],
    },
  },
  {
    name: 'sheets_write',
    description: 'Write data to a Google Sheets spreadsheet. Overwrites the specified range. Use for: updating values, entering data, populating tables.',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheet_id: { type: 'string', description: 'The spreadsheet ID' },
        range: { type: 'string', description: 'Cell range in A1 notation (e.g. "Sheet1!A1:D10")' },
        values: {
          type: 'array',
          items: { type: 'array', items: {} },
          description: 'Row-major 2D array of values (e.g. [["Name","Age"],["Alice",30],["Bob",25]])',
        },
      },
      required: ['spreadsheet_id', 'range', 'values'],
    },
  },
  {
    name: 'sheets_append',
    description: 'Append rows to the end of a table in Google Sheets. Automatically finds the next empty row. Use for: adding new records, logging data, growing tables.',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheet_id: { type: 'string', description: 'The spreadsheet ID' },
        range: { type: 'string', description: 'The range that defines the table (e.g. "Sheet1!A:D")' },
        values: {
          type: 'array',
          items: { type: 'array', items: {} },
          description: 'Rows to append (e.g. [["Alice",30],["Bob",25]])',
        },
      },
      required: ['spreadsheet_id', 'range', 'values'],
    },
  },
  {
    name: 'sheets_create',
    description: 'Create a new Google Sheets spreadsheet. Use for: starting new trackers, creating reports, building data tables from scratch.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Spreadsheet title' },
        sheets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of sheets/tabs to create (optional, default: ["Sheet1"])',
        },
        initial_data: {
          type: 'array',
          items: { type: 'array', items: {} },
          description: 'Initial data for the first sheet (optional)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'sheets_add_sheet',
    description: 'Add a new sheet/tab to an existing spreadsheet.',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheet_id: { type: 'string', description: 'The spreadsheet ID' },
        title: { type: 'string', description: 'Name for the new sheet' },
      },
      required: ['spreadsheet_id', 'title'],
    },
  },
  {
    name: 'sheets_clear',
    description: 'Clear values from a range in a spreadsheet (keeps formatting).',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheet_id: { type: 'string', description: 'The spreadsheet ID' },
        range: { type: 'string', description: 'Range to clear (e.g. "Sheet1!A1:D10")' },
      },
      required: ['spreadsheet_id', 'range'],
    },
  },
  {
    name: 'sheets_get_info',
    description: 'Get metadata about a spreadsheet: title, sheet names, row/column counts. Use for: understanding spreadsheet structure before reading/writing.',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheet_id: { type: 'string', description: 'The spreadsheet ID' },
      },
      required: ['spreadsheet_id'],
    },
  },
];


// ─────────────────────────────────────────────
// GOOGLE TOOL EXECUTOR
// ─────────────────────────────────────────────

export class GoogleToolExecutor {
  constructor(config = {}) {
    this.config = config;
    this.google = null;
    this.auth = null;
    this.calendar = null;
    this.drive = null;
    this.sheets = null;
    this._initialized = false;
  }

  async _init() {
    if (this._initialized) return;

    const { google } = await import('googleapis');
    this.google = google;

    // Load OAuth credentials
    const credPath = this.config.credentialsPath;
    const tokenPath = this.config.tokenPath || path.join(os.homedir(), '.empli', 'google-token.json');

    if (!credPath || !fs.existsSync(credPath)) {
      throw new Error('Google OAuth credentials not configured. Run: empli onboard and enable Google services.');
    }

    const credentials = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
    const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0] || 'http://localhost:3000/callback');

    if (!fs.existsSync(tokenPath)) {
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/spreadsheets',
        ],
      });
      throw new Error(`Google not authorized. Visit this URL:\n${authUrl}\nThen run: empli google-auth <code>`);
    }

    const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    oauth2Client.setCredentials(tokens);

    // Auto-refresh tokens
    oauth2Client.on('tokens', (newTokens) => {
      const current = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      const updated = { ...current, ...newTokens };
      fs.writeFileSync(tokenPath, JSON.stringify(updated, null, 2));
    });

    this.auth = oauth2Client;
    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    this.drive = google.drive({ version: 'v3', auth: oauth2Client });
    this.sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    this._initialized = true;
  }

  async execute(toolName, input) {
    try {
      await this._init();

      switch (toolName) {
        // Calendar
        case 'calendar_list_events': return await this.calendarListEvents(input);
        case 'calendar_get_event': return await this.calendarGetEvent(input);
        case 'calendar_create_event': return await this.calendarCreateEvent(input);
        case 'calendar_update_event': return await this.calendarUpdateEvent(input);
        case 'calendar_delete_event': return await this.calendarDeleteEvent(input);
        case 'calendar_find_free_time': return await this.calendarFindFreeTime(input);
        case 'calendar_list_calendars': return await this.calendarListCalendars(input);

        // Drive
        case 'drive_list_files': return await this.driveListFiles(input);
        case 'drive_get_file': return await this.driveGetFile(input);
        case 'drive_read_file': return await this.driveReadFile(input);
        case 'drive_upload_file': return await this.driveUploadFile(input);
        case 'drive_create_file': return await this.driveCreateFile(input);
        case 'drive_create_folder': return await this.driveCreateFolder(input);
        case 'drive_delete_file': return await this.driveDeleteFile(input);
        case 'drive_share_file': return await this.driveShareFile(input);
        case 'drive_move_file': return await this.driveMoveFile(input);

        // Sheets
        case 'sheets_read': return await this.sheetsRead(input);
        case 'sheets_write': return await this.sheetsWrite(input);
        case 'sheets_append': return await this.sheetsAppend(input);
        case 'sheets_create': return await this.sheetsCreate(input);
        case 'sheets_add_sheet': return await this.sheetsAddSheet(input);
        case 'sheets_clear': return await this.sheetsClear(input);
        case 'sheets_get_info': return await this.sheetsGetInfo(input);

        default: return { error: `Unknown Google tool: ${toolName}` };
      }
    } catch (err) {
      return { error: `${toolName} failed: ${err.message}` };
    }
  }

  // ═══════════════════════════════════════
  // CALENDAR EXECUTORS
  // ═══════════════════════════════════════

  async calendarListEvents(input) {
    const { days_ahead = 7, max_results = 20, calendar_id = 'primary', query } = input;
    const now = new Date();
    const future = new Date(now.getTime() + days_ahead * 24 * 60 * 60 * 1000);

    const params = {
      calendarId: calendar_id,
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      maxResults: max_results,
      singleEvents: true,
      orderBy: 'startTime',
    };
    if (query) params.q = query;

    const res = await this.calendar.events.list(params);
    const events = (res.data.items || []).map(e => ({
      id: e.id,
      title: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location,
      description: e.description?.substring(0, 200),
      attendees: e.attendees?.map(a => ({ email: a.email, status: a.responseStatus })),
      link: e.htmlLink,
      allDay: !!e.start?.date,
      recurring: !!e.recurringEventId,
    }));

    return { events, count: events.length, range: `${now.toDateString()} → ${future.toDateString()}` };
  }

  async calendarGetEvent(input) {
    const { event_id, calendar_id = 'primary' } = input;
    const res = await this.calendar.events.get({ calendarId: calendar_id, eventId: event_id });
    const e = res.data;
    return {
      id: e.id,
      title: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location,
      description: e.description,
      attendees: e.attendees?.map(a => ({ email: a.email, name: a.displayName, status: a.responseStatus })),
      organizer: e.organizer,
      link: e.htmlLink,
      created: e.created,
      updated: e.updated,
      recurrence: e.recurrence,
    };
  }

  async calendarCreateEvent(input) {
    const { title, start, end, description, location, attendees, timezone, reminders, recurrence, calendar_id = 'primary', color } = input;

    const isAllDay = !start.includes('T');
    const event = {
      summary: title,
      description,
      location,
      start: isAllDay ? { date: start } : { dateTime: start, timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: isAllDay ? { date: end } : { dateTime: end, timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone },
    };

    if (attendees?.length) {
      event.attendees = attendees.map(email => ({ email }));
    }
    if (reminders?.length) {
      event.reminders = { useDefault: false, overrides: reminders.map(m => ({ method: 'popup', minutes: m })) };
    }
    if (recurrence) {
      event.recurrence = [recurrence];
    }
    if (color) {
      event.colorId = color;
    }

    const res = await this.calendar.events.insert({ calendarId: calendar_id, requestBody: event, sendUpdates: attendees?.length ? 'all' : 'none' });
    return { success: true, id: res.data.id, link: res.data.htmlLink, title, start, end };
  }

  async calendarUpdateEvent(input) {
    const { event_id, calendar_id = 'primary', ...updates } = input;

    // Get existing event first
    const existing = await this.calendar.events.get({ calendarId: calendar_id, eventId: event_id });
    const event = existing.data;

    if (updates.title) event.summary = updates.title;
    if (updates.description) event.description = updates.description;
    if (updates.location) event.location = updates.location;
    if (updates.start) {
      const isAllDay = !updates.start.includes('T');
      event.start = isAllDay ? { date: updates.start } : { dateTime: updates.start, timeZone: event.start?.timeZone };
    }
    if (updates.end) {
      const isAllDay = !updates.end.includes('T');
      event.end = isAllDay ? { date: updates.end } : { dateTime: updates.end, timeZone: event.end?.timeZone };
    }
    if (updates.attendees) {
      event.attendees = updates.attendees.map(email => ({ email }));
    }

    const res = await this.calendar.events.update({ calendarId: calendar_id, eventId: event_id, requestBody: event });
    return { success: true, id: res.data.id, link: res.data.htmlLink };
  }

  async calendarDeleteEvent(input) {
    const { event_id, calendar_id = 'primary' } = input;
    await this.calendar.events.delete({ calendarId: calendar_id, eventId: event_id });
    return { success: true, deleted: event_id };
  }

  async calendarFindFreeTime(input) {
    const { days_ahead = 7, min_duration_minutes = 30, work_hours_start = 9, work_hours_end = 17, calendar_id = 'primary' } = input;

    // Get all events
    const now = new Date();
    const future = new Date(now.getTime() + days_ahead * 24 * 60 * 60 * 1000);
    const res = await this.calendar.events.list({
      calendarId: calendar_id,
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const events = (res.data.items || [])
      .filter(e => e.start?.dateTime) // Skip all-day events
      .map(e => ({
        start: new Date(e.start.dateTime),
        end: new Date(e.end.dateTime),
        title: e.summary,
      }));

    // Find free slots for each day
    const freeSlots = [];
    for (let d = 0; d < days_ahead; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() + d);
      day.setHours(work_hours_start, 0, 0, 0);

      const dayEnd = new Date(day);
      dayEnd.setHours(work_hours_end, 0, 0, 0);

      // Skip weekends
      if (day.getDay() === 0 || day.getDay() === 6) continue;

      // If today, start from now
      const slotStart = d === 0 && now > day ? new Date(now) : new Date(day);
      if (slotStart >= dayEnd) continue;

      // Get events for this day
      const dayEvents = events.filter(e => e.start < dayEnd && e.end > slotStart).sort((a, b) => a.start - b.start);

      let cursor = new Date(slotStart);
      for (const evt of dayEvents) {
        if (evt.start > cursor) {
          const durationMin = (evt.start - cursor) / 60000;
          if (durationMin >= min_duration_minutes) {
            freeSlots.push({
              date: day.toDateString(),
              start: cursor.toTimeString().slice(0, 5),
              end: evt.start.toTimeString().slice(0, 5),
              duration_minutes: Math.round(durationMin),
            });
          }
        }
        if (evt.end > cursor) cursor = new Date(evt.end);
      }
      // After last event
      if (cursor < dayEnd) {
        const durationMin = (dayEnd - cursor) / 60000;
        if (durationMin >= min_duration_minutes) {
          freeSlots.push({
            date: day.toDateString(),
            start: cursor.toTimeString().slice(0, 5),
            end: dayEnd.toTimeString().slice(0, 5),
            duration_minutes: Math.round(durationMin),
          });
        }
      }
    }

    return { free_slots: freeSlots, count: freeSlots.length, work_hours: `${work_hours_start}:00-${work_hours_end}:00` };
  }

  async calendarListCalendars() {
    const res = await this.calendar.calendarList.list();
    const calendars = (res.data.items || []).map(c => ({
      id: c.id,
      name: c.summary,
      description: c.description,
      color: c.backgroundColor,
      primary: c.primary || false,
      accessRole: c.accessRole,
    }));
    return { calendars };
  }

  // ═══════════════════════════════════════
  // DRIVE EXECUTORS
  // ═══════════════════════════════════════

  async driveListFiles(input) {
    const { query, folder_id, max_results = 20, type = 'all', order_by = 'modified' } = input;

    const mimeTypes = {
      documents: 'application/vnd.google-apps.document',
      spreadsheets: 'application/vnd.google-apps.spreadsheet',
      presentations: 'application/vnd.google-apps.presentation',
      pdfs: 'application/pdf',
      images: 'image/',
      folders: 'application/vnd.google-apps.folder',
    };

    let q = 'trashed = false';
    if (folder_id) q += ` and '${folder_id}' in parents`;
    if (query) q += ` and (name contains '${query}' or fullText contains '${query}')`;
    if (type !== 'all' && mimeTypes[type]) {
      if (type === 'images') q += ` and mimeType contains '${mimeTypes[type]}'`;
      else q += ` and mimeType = '${mimeTypes[type]}'`;
    }

    const orderMap = { modified: 'modifiedTime desc', name: 'name', created: 'createdTime desc', size: 'quotaBytesUsed desc' };

    const res = await this.drive.files.list({
      q,
      pageSize: max_results,
      orderBy: orderMap[order_by] || 'modifiedTime desc',
      fields: 'files(id, name, mimeType, size, modifiedTime, createdTime, parents, shared, webViewLink)',
    });

    const files = (res.data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      type: this._friendlyType(f.mimeType),
      size: f.size ? `${Math.round(f.size / 1024)}KB` : null,
      modified: f.modifiedTime,
      shared: f.shared,
      link: f.webViewLink,
    }));

    return { files, count: files.length };
  }

  async driveGetFile(input) {
    const res = await this.drive.files.get({
      fileId: input.file_id,
      fields: 'id, name, mimeType, size, modifiedTime, createdTime, parents, shared, webViewLink, description, owners, permissions',
    });
    const f = res.data;
    return {
      id: f.id, name: f.name, type: this._friendlyType(f.mimeType), mimeType: f.mimeType,
      size: f.size, modified: f.modifiedTime, created: f.createdTime,
      shared: f.shared, link: f.webViewLink, description: f.description,
      owners: f.owners?.map(o => o.emailAddress),
    };
  }

  async driveReadFile(input) {
    const { file_id, export_format = 'text', save_to } = input;

    // Get file metadata to determine type
    const meta = await this.drive.files.get({ fileId: file_id, fields: 'mimeType, name' });
    const mimeType = meta.data.mimeType;
    const isGoogleFile = mimeType.startsWith('application/vnd.google-apps.');

    let content;
    if (isGoogleFile) {
      const exportMimes = {
        text: 'text/plain',
        pdf: 'application/pdf',
        csv: 'text/csv',
        html: 'text/html',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
      const res = await this.drive.files.export({ fileId: file_id, mimeType: exportMimes[export_format] || 'text/plain' }, { responseType: save_to ? 'stream' : 'text' });
      content = res.data;
    } else {
      const res = await this.drive.files.get({ fileId: file_id, alt: 'media' }, { responseType: save_to ? 'stream' : 'text' });
      content = res.data;
    }

    if (save_to) {
      const resolved = save_to.startsWith('~/') ? path.join(os.homedir(), save_to.slice(2)) : save_to;
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      const writer = fs.createWriteStream(resolved);
      await new Promise((resolve, reject) => { content.pipe(writer); writer.on('finish', resolve); writer.on('error', reject); });
      return { success: true, saved_to: resolved, name: meta.data.name };
    }

    const text = typeof content === 'string' ? content : JSON.stringify(content);
    return { content: text.substring(0, 50000), name: meta.data.name, truncated: text.length > 50000 };
  }

  async driveUploadFile(input) {
    const { local_path, name, folder_id, convert } = input;
    const resolved = local_path.startsWith('~/') ? path.join(os.homedir(), local_path.slice(2)) : local_path;
    const fileName = name || path.basename(resolved);

    const metadata = { name: fileName };
    if (folder_id) metadata.parents = [folder_id];

    const media = { body: fs.createReadStream(resolved) };

    // Auto-detect mime type
    const ext = path.extname(resolved).toLowerCase();
    const mimes = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain', '.csv': 'text/csv', '.json': 'application/json', '.html': 'text/html', '.md': 'text/markdown', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    if (mimes[ext]) media.mimeType = mimes[ext];

    const res = await this.drive.files.create({ requestBody: metadata, media, fields: 'id, name, webViewLink' });
    return { success: true, id: res.data.id, name: res.data.name, link: res.data.webViewLink };
  }

  async driveCreateFile(input) {
    const { name, content, folder_id, mime_type } = input;
    const metadata = { name };
    if (folder_id) metadata.parents = [folder_id];
    if (mime_type) metadata.mimeType = mime_type;

    const { Readable } = await import('stream');
    const media = { mimeType: 'text/plain', body: Readable.from([content]) };

    const res = await this.drive.files.create({ requestBody: metadata, media, fields: 'id, name, webViewLink' });
    return { success: true, id: res.data.id, name: res.data.name, link: res.data.webViewLink };
  }

  async driveCreateFolder(input) {
    const metadata = { name: input.name, mimeType: 'application/vnd.google-apps.folder' };
    if (input.parent_id) metadata.parents = [input.parent_id];

    const res = await this.drive.files.create({ requestBody: metadata, fields: 'id, name, webViewLink' });
    return { success: true, id: res.data.id, name: res.data.name, link: res.data.webViewLink };
  }

  async driveDeleteFile(input) {
    await this.drive.files.update({ fileId: input.file_id, requestBody: { trashed: true } });
    return { success: true, trashed: input.file_id };
  }

  async driveShareFile(input) {
    const { file_id, email, role = 'reader', notify = true, message } = input;
    const res = await this.drive.permissions.create({
      fileId: file_id,
      requestBody: { type: 'user', role, emailAddress: email },
      sendNotificationEmail: notify,
      emailMessage: message,
    });
    return { success: true, permission_id: res.data.id, email, role };
  }

  async driveMoveFile(input) {
    const file = await this.drive.files.get({ fileId: input.file_id, fields: 'parents' });
    const previousParents = file.data.parents?.join(',') || '';
    const res = await this.drive.files.update({
      fileId: input.file_id,
      addParents: input.to_folder_id,
      removeParents: previousParents,
      fields: 'id, name, parents',
    });
    return { success: true, id: res.data.id, name: res.data.name };
  }

  // ═══════════════════════════════════════
  // SHEETS EXECUTORS
  // ═══════════════════════════════════════

  async sheetsRead(input) {
    const { spreadsheet_id, range } = input;
    const params = { spreadsheetId: spreadsheet_id };
    if (range) params.range = range;
    else {
      // Get first sheet name
      const info = await this.sheets.spreadsheets.get({ spreadsheetId: spreadsheet_id });
      params.range = info.data.sheets?.[0]?.properties?.title || 'Sheet1';
    }

    const res = await this.sheets.spreadsheets.values.get(params);
    return {
      values: res.data.values || [],
      range: res.data.range,
      rows: (res.data.values || []).length,
      cols: Math.max(...(res.data.values || [[]]).map(r => r.length)),
    };
  }

  async sheetsWrite(input) {
    const { spreadsheet_id, range, values } = input;
    const res = await this.sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheet_id,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
    return { success: true, updated_cells: res.data.updatedCells, updated_range: res.data.updatedRange };
  }

  async sheetsAppend(input) {
    const { spreadsheet_id, range, values } = input;
    const res = await this.sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheet_id,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    return { success: true, updated_range: res.data.updates?.updatedRange, rows_added: values.length };
  }

  async sheetsCreate(input) {
    const { title, sheets = ['Sheet1'], initial_data } = input;
    const requestBody = {
      properties: { title },
      sheets: sheets.map(name => ({ properties: { title: name } })),
    };

    const res = await this.sheets.spreadsheets.create({ requestBody });
    const spreadsheetId = res.data.spreadsheetId;

    // Write initial data if provided
    if (initial_data?.length) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheets[0]}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: initial_data },
      });
    }

    return { success: true, id: spreadsheetId, link: res.data.spreadsheetUrl, title };
  }

  async sheetsAddSheet(input) {
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheet_id,
      requestBody: { requests: [{ addSheet: { properties: { title: input.title } } }] },
    });
    return { success: true, sheet_id: res.data.replies?.[0]?.addSheet?.properties?.sheetId, title: input.title };
  }

  async sheetsClear(input) {
    await this.sheets.spreadsheets.values.clear({ spreadsheetId: input.spreadsheet_id, range: input.range });
    return { success: true, cleared: input.range };
  }

  async sheetsGetInfo(input) {
    const res = await this.sheets.spreadsheets.get({ spreadsheetId: input.spreadsheet_id });
    return {
      title: res.data.properties?.title,
      locale: res.data.properties?.locale,
      link: res.data.spreadsheetUrl,
      sheets: res.data.sheets?.map(s => ({
        name: s.properties?.title,
        id: s.properties?.sheetId,
        rows: s.properties?.gridProperties?.rowCount,
        cols: s.properties?.gridProperties?.columnCount,
      })),
    };
  }

  // ═══ HELPERS ═══

  _friendlyType(mimeType) {
    const map = {
      'application/vnd.google-apps.document': 'Google Doc',
      'application/vnd.google-apps.spreadsheet': 'Google Sheet',
      'application/vnd.google-apps.presentation': 'Google Slides',
      'application/vnd.google-apps.folder': 'Folder',
      'application/pdf': 'PDF',
      'text/plain': 'Text',
      'text/csv': 'CSV',
      'image/jpeg': 'Image (JPEG)',
      'image/png': 'Image (PNG)',
    };
    return map[mimeType] || mimeType;
  }
}
