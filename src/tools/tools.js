// ═══════════════════════════════════════════════════════════════
// Empli Gateway — Tool System
// Everything an agent can do on the computer
// ═══════════════════════════════════════════════════════════════

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ─────────────────────────────────────────────
// TOOL DEFINITIONS
// These get sent to the LLM so it knows what's available
// ─────────────────────────────────────────────

export const TOOL_DEFINITIONS = [

  // ═══ SHELL ═══
  {
    name: 'bash',
    description: 'Run a shell command on the computer. Returns stdout + stderr. Use for: installing packages, running scripts, git operations, system administration, file operations, and anything you can do in a terminal. Commands run in the user\'s home directory by default.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        workdir: { type: 'string', description: 'Working directory (optional, defaults to home)' },
        timeout: { type: 'number', description: 'Timeout in seconds (optional, default 30)' },
      },
      required: ['command'],
    },
  },

  // ═══ FILE SYSTEM ═══
  {
    name: 'read_file',
    description: 'Read the contents of a file. Returns the text content. Use for: reading config files, source code, documents, logs, data files. Supports text files only.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative path to the file' },
        max_lines: { type: 'number', description: 'Max lines to return (optional, default all). Use for large files.' },
        offset: { type: 'number', description: 'Start reading from this line number (optional, default 0)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Creates the file and any parent directories if they don\'t exist. Overwrites existing content. Use for: creating scripts, config files, documents, code files, notes.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to write' },
        content: { type: 'string', description: 'The content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'append_file',
    description: 'Append content to the end of a file. Creates the file if it doesn\'t exist. Use for: adding to logs, appending notes, growing documents incrementally.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file' },
        content: { type: 'string', description: 'Content to append' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Find and replace text in a file. The search string must appear exactly once in the file. Use for: modifying config values, fixing code, updating specific sections without rewriting the whole file.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file' },
        find: { type: 'string', description: 'The exact text to find (must be unique in the file)' },
        replace: { type: 'string', description: 'The text to replace it with' },
      },
      required: ['path', 'find', 'replace'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and directories at a given path. Returns names, types (file/dir), and sizes. Use for: exploring file structure, finding files, checking what exists.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list (default: current directory)' },
        recursive: { type: 'boolean', description: 'List recursively up to 3 levels deep (default: false)' },
        show_hidden: { type: 'boolean', description: 'Include hidden files starting with . (default: false)' },
      },
      required: [],
    },
  },
  {
    name: 'search_files',
    description: 'Search for text within files in a directory. Like grep. Returns matching lines with file paths and line numbers. Use for: finding where something is defined, searching code, finding config values.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text or regex pattern to search for' },
        path: { type: 'string', description: 'Directory to search in (default: current directory)' },
        file_pattern: { type: 'string', description: 'File glob pattern like "*.js" or "*.py" (optional)' },
        max_results: { type: 'number', description: 'Maximum number of results (default: 50)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'move_file',
    description: 'Move or rename a file or directory.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Current path' },
        to: { type: 'string', description: 'New path' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'copy_file',
    description: 'Copy a file or directory.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Source path' },
        to: { type: 'string', description: 'Destination path' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file or empty directory. CAUTION: This is irreversible. Always confirm with the user before deleting.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to delete' },
        recursive: { type: 'boolean', description: 'Delete directory and all contents (default: false)' },
      },
      required: ['path'],
    },
  },

  // ═══ WEB ═══
  {
    name: 'web_search',
    description: 'Search the web using a search engine. Returns titles, URLs, and snippets for the top results. Use for: finding current information, researching topics, looking up documentation, fact-checking.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        num_results: { type: 'number', description: 'Number of results to return (default: 5, max: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch the text content of a web page. Returns the page content as cleaned text (HTML tags removed). Use for: reading articles, documentation, API responses, downloading text data.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch' },
        max_length: { type: 'number', description: 'Max characters to return (default: 10000)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'web_download',
    description: 'Download a file from a URL to disk. Use for: downloading images, PDFs, packages, datasets, any binary or text file.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to download from' },
        path: { type: 'string', description: 'Local path to save the file' },
      },
      required: ['url', 'path'],
    },
  },

  // ═══ SYSTEM INFO ═══
  {
    name: 'system_info',
    description: 'Get information about the computer: OS, CPU, memory, disk, network, uptime, current user, environment variables. Use for: understanding the machine, debugging issues, checking resources.',
    input_schema: {
      type: 'object',
      properties: {
        sections: {
          type: 'array',
          items: { type: 'string', enum: ['os', 'cpu', 'memory', 'disk', 'network', 'env', 'all'] },
          description: 'Which sections to include (default: ["all"])',
        },
      },
      required: [],
    },
  },

  // ═══ PROCESS MANAGEMENT ═══
  {
    name: 'list_processes',
    description: 'List running processes. Returns PID, name, CPU%, memory usage. Use for: finding what\'s running, debugging resource usage, finding process IDs to kill.',
    input_schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Filter by process name (optional)' },
        sort_by: { type: 'string', enum: ['cpu', 'memory', 'name'], description: 'Sort by (default: cpu)' },
        limit: { type: 'number', description: 'Max processes to return (default: 20)' },
      },
      required: [],
    },
  },
  {
    name: 'kill_process',
    description: 'Kill a running process by PID. CAUTION: confirm with user before killing processes.',
    input_schema: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Process ID to kill' },
        force: { type: 'boolean', description: 'Force kill with SIGKILL (default: false, uses SIGTERM)' },
      },
      required: ['pid'],
    },
  },

  // ═══ CLIPBOARD ═══
  {
    name: 'clipboard_read',
    description: 'Read the current clipboard contents. Use for: getting text the user copied, processing clipboard data.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'clipboard_write',
    description: 'Write text to the clipboard. Use for: copying results for the user, preparing text to paste.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to copy to clipboard' },
      },
      required: ['text'],
    },
  },

  // ═══ NOTIFICATIONS ═══
  {
    name: 'notify',
    description: 'Show a desktop notification to the user. Use for: alerting about completed tasks, reminders, important information.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Notification title' },
        message: { type: 'string', description: 'Notification body text' },
      },
      required: ['title', 'message'],
    },
  },

  // ═══ SCREENSHOT ═══
  {
    name: 'screenshot',
    description: 'Take a screenshot of the screen and save it to a file. Use for: seeing what\'s on screen, debugging UI issues, capturing state.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to save the screenshot (default: ~/screenshot.png)' },
      },
      required: [],
    },
  },

  // ═══ OPEN / LAUNCH ═══
  {
    name: 'open',
    description: 'Open a file, URL, or application using the system\'s default handler. Like double-clicking a file or typing a URL. Use for: opening web pages in browser, launching apps, opening documents.',
    input_schema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'File path, URL, or application name to open' },
      },
      required: ['target'],
    },
  },

  // ═══ MEMORY ═══
  {
    name: 'memory_save',
    description: 'Save important information to persistent long-term memory. Survives session resets and restarts. Use for: remembering user preferences, project details, important facts, bookmarks, TODO lists.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Short label like "user-preferences", "project-notes", "meeting-2024-01-15"' },
        content: { type: 'string', description: 'The information to remember (markdown format recommended)' },
      },
      required: ['key', 'content'],
    },
  },
  {
    name: 'memory_search',
    description: 'Search persistent long-term memory. Use at the start of conversations to recall context, or when the user references something from the past.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to search for' },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_list',
    description: 'List all memory keys. Use to see what\'s been saved.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'memory_delete',
    description: 'Delete a memory entry by key.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key to delete' },
      },
      required: ['key'],
    },
  },

  // ═══ SCHEDULING / CRON ═══
  {
    name: 'schedule_task',
    description: 'Schedule a task to run at a specific time or on a recurring schedule. Uses cron syntax for recurring tasks. Use for: reminders, daily reports, periodic checks, automation.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for this scheduled task' },
        schedule: { type: 'string', description: 'Cron expression (e.g. "0 9 * * *" for 9am daily) or ISO date for one-time' },
        prompt: { type: 'string', description: 'The message/instruction to execute when triggered' },
        channel: { type: 'string', description: 'Which channel to send the result to (optional)' },
      },
      required: ['name', 'schedule', 'prompt'],
    },
  },
  {
    name: 'list_scheduled',
    description: 'List all scheduled/recurring tasks.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'cancel_scheduled',
    description: 'Cancel a scheduled task by name.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the task to cancel' },
      },
      required: ['name'],
    },
  },
];


// ─────────────────────────────────────────────
// TOOL EXECUTORS
// Actually do the thing on the machine
// ─────────────────────────────────────────────

export class ToolExecutor {
  constructor(config = {}) {
    this.homeDir = config.homeDir || os.homedir();
    this.memoryDir = config.memoryDir || path.join(this.homeDir, '.empli', 'memory');
    this.scheduledTasks = new Map();
    this.onScheduledTask = config.onScheduledTask || null; // callback for scheduled tasks

    fs.mkdirSync(this.memoryDir, { recursive: true });
  }

  async execute(toolName, input) {
    try {
      switch (toolName) {
        case 'bash': return this.bash(input);
        case 'read_file': return this.readFile(input);
        case 'write_file': return this.writeFile(input);
        case 'append_file': return this.appendFile(input);
        case 'edit_file': return this.editFile(input);
        case 'list_directory': return this.listDirectory(input);
        case 'search_files': return this.searchFiles(input);
        case 'move_file': return this.moveFile(input);
        case 'copy_file': return this.copyFile(input);
        case 'delete_file': return this.deleteFile(input);
        case 'web_search': return this.webSearch(input);
        case 'web_fetch': return this.webFetch(input);
        case 'web_download': return this.webDownload(input);
        case 'system_info': return this.systemInfo(input);
        case 'list_processes': return this.listProcesses(input);
        case 'kill_process': return this.killProcess(input);
        case 'clipboard_read': return this.clipboardRead(input);
        case 'clipboard_write': return this.clipboardWrite(input);
        case 'notify': return this.notify(input);
        case 'screenshot': return this.screenshot(input);
        case 'open': return this.openTarget(input);
        case 'memory_save': return this.memorySave(input);
        case 'memory_search': return this.memorySearch(input);
        case 'memory_list': return this.memoryList(input);
        case 'memory_delete': return this.memoryDelete(input);
        case 'schedule_task': return this.scheduleTask(input);
        case 'list_scheduled': return this.listScheduled(input);
        case 'cancel_scheduled': return this.cancelScheduled(input);
        default: return { error: `Unknown tool: ${toolName}` };
      }
    } catch (err) {
      return { error: `${toolName} failed: ${err.message}` };
    }
  }

  // ═══ SHELL ═══

  bash(input) {
    const { command, workdir, timeout = 30 } = input;
    try {
      const result = execSync(command, {
        cwd: workdir || this.homeDir,
        timeout: timeout * 1000,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10, // 10MB
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { output: result || '(no output)', exitCode: 0 };
    } catch (err) {
      return {
        output: (err.stdout || '') + (err.stderr || ''),
        exitCode: err.status || 1,
        error: err.message,
      };
    }
  }

  // ═══ FILE SYSTEM ═══

  readFile(input) {
    const { path: filePath, max_lines, offset = 0 } = input;
    const resolved = this.resolvePath(filePath);
    const content = fs.readFileSync(resolved, 'utf-8');

    if (max_lines) {
      const lines = content.split('\n');
      const sliced = lines.slice(offset, offset + max_lines);
      return {
        content: sliced.join('\n'),
        totalLines: lines.length,
        showing: `lines ${offset + 1}-${Math.min(offset + max_lines, lines.length)} of ${lines.length}`,
      };
    }

    return { content, size: content.length };
  }

  writeFile(input) {
    const resolved = this.resolvePath(input.path);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, input.content, 'utf-8');
    return { success: true, path: resolved, size: input.content.length };
  }

  appendFile(input) {
    const resolved = this.resolvePath(input.path);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.appendFileSync(resolved, input.content, 'utf-8');
    return { success: true, path: resolved };
  }

  editFile(input) {
    const resolved = this.resolvePath(input.path);
    let content = fs.readFileSync(resolved, 'utf-8');
    const count = content.split(input.find).length - 1;

    if (count === 0) {
      return { error: 'Search string not found in file' };
    }
    if (count > 1) {
      return { error: `Search string found ${count} times — must be unique. Add more context to narrow it down.` };
    }

    content = content.replace(input.find, input.replace);
    fs.writeFileSync(resolved, content, 'utf-8');
    return { success: true, path: resolved };
  }

  listDirectory(input) {
    const dirPath = this.resolvePath(input.path || '.');
    const items = this._listDir(dirPath, input.recursive ? 3 : 1, input.show_hidden);
    return { path: dirPath, items };
  }

  _listDir(dirPath, maxDepth, showHidden, depth = 0) {
    if (depth >= maxDepth) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      if (!showHidden && entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;

      const fullPath = path.join(dirPath, entry.name);
      const item = { name: entry.name, type: entry.isDirectory() ? 'dir' : 'file' };

      if (entry.isFile()) {
        try {
          item.size = fs.statSync(fullPath).size;
        } catch (e) {}
      }

      if (entry.isDirectory() && depth < maxDepth - 1) {
        item.children = this._listDir(fullPath, maxDepth, showHidden, depth + 1);
      }

      items.push(item);
    }
    return items;
  }

  searchFiles(input) {
    const { query, path: searchPath, file_pattern, max_results = 50 } = input;
    const dir = this.resolvePath(searchPath || '.');

    try {
      let cmd = `grep -rn --include="${file_pattern || '*'}" "${query.replace(/"/g, '\\"')}" "${dir}" | head -${max_results}`;
      const result = execSync(cmd, { encoding: 'utf-8', timeout: 15000, maxBuffer: 1024 * 1024 });
      const matches = result.split('\n').filter(Boolean).map(line => {
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (match) return { file: match[1], line: parseInt(match[2]), text: match[3].trim() };
        return { text: line };
      });
      return { matches, count: matches.length };
    } catch (err) {
      if (err.status === 1) return { matches: [], count: 0 };
      return { error: err.message };
    }
  }

  moveFile(input) {
    const from = this.resolvePath(input.from);
    const to = this.resolvePath(input.to);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    return { success: true, from, to };
  }

  copyFile(input) {
    const from = this.resolvePath(input.from);
    const to = this.resolvePath(input.to);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true });
    return { success: true, from, to };
  }

  deleteFile(input) {
    const resolved = this.resolvePath(input.path);
    if (input.recursive) {
      fs.rmSync(resolved, { recursive: true, force: true });
    } else {
      fs.unlinkSync(resolved);
    }
    return { success: true, deleted: resolved };
  }

  // ═══ WEB ═══

  async webSearch(input) {
    const { query, num_results = 5 } = input;
    // Use DuckDuckGo HTML (no API key needed)
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EmpliBot/1.0)' },
      });
      const html = await response.text();

      // Parse results from HTML
      const results = [];
      const regex = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      while ((match = regex.exec(html)) && results.length < num_results) {
        results.push({
          url: match[1].replace(/&amp;/g, '&'),
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          snippet: match[3].replace(/<[^>]+>/g, '').trim(),
        });
      }
      return { results, query };
    } catch (err) {
      // Fallback to curl
      try {
        const result = execSync(
          `curl -s "https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}" -A "EmpliBot/1.0"`,
          { encoding: 'utf-8', timeout: 15000 }
        );
        return { raw: result.substring(0, 5000), query };
      } catch (e) {
        return { error: `Search failed: ${err.message}` };
      }
    }
  }

  async webFetch(input) {
    const { url, max_length = 10000 } = input;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EmpliBot/1.0)' },
        signal: AbortSignal.timeout(15000),
      });
      const html = await response.text();
      // Strip HTML tags for clean text
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, max_length);
      return { content: text, url, length: text.length };
    } catch (err) {
      return { error: `Fetch failed: ${err.message}` };
    }
  }

  async webDownload(input) {
    const resolved = this.resolvePath(input.path);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    try {
      const response = await fetch(input.url, { signal: AbortSignal.timeout(60000) });
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(resolved, buffer);
      return { success: true, path: resolved, size: buffer.length };
    } catch (err) {
      return { error: `Download failed: ${err.message}` };
    }
  }

  // ═══ SYSTEM ═══

  systemInfo(input) {
    const sections = input.sections || ['all'];
    const wantsAll = sections.includes('all');
    const info = {};

    if (wantsAll || sections.includes('os')) {
      info.os = {
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
        user: os.userInfo().username,
        home: os.homedir(),
        shell: os.userInfo().shell,
      };
    }

    if (wantsAll || sections.includes('cpu')) {
      const cpus = os.cpus();
      info.cpu = {
        model: cpus[0]?.model,
        cores: cpus.length,
        speed: `${cpus[0]?.speed}MHz`,
      };
    }

    if (wantsAll || sections.includes('memory')) {
      const total = os.totalmem();
      const free = os.freemem();
      info.memory = {
        total: `${Math.round(total / 1024 / 1024 / 1024)}GB`,
        free: `${Math.round(free / 1024 / 1024 / 1024)}GB`,
        used: `${Math.round((total - free) / 1024 / 1024 / 1024)}GB`,
        usedPercent: `${Math.round(((total - free) / total) * 100)}%`,
      };
    }

    if (wantsAll || sections.includes('disk')) {
      try {
        const df = execSync('df -h / 2>/dev/null || df -h 2>/dev/null | head -5', { encoding: 'utf-8' });
        info.disk = df.trim();
      } catch (e) {
        info.disk = 'unavailable';
      }
    }

    if (wantsAll || sections.includes('network')) {
      const nets = os.networkInterfaces();
      info.network = {};
      for (const [name, addrs] of Object.entries(nets)) {
        const ipv4 = addrs.find(a => a.family === 'IPv4' && !a.internal);
        if (ipv4) info.network[name] = ipv4.address;
      }
    }

    if (sections.includes('env')) {
      // Only safe env vars, not secrets
      info.env = {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        SHELL: process.env.SHELL,
        LANG: process.env.LANG,
        NODE_VERSION: process.version,
      };
    }

    return info;
  }

  listProcesses(input) {
    const { filter, sort_by = 'cpu', limit = 20 } = input;
    try {
      let cmd;
      if (os.platform() === 'darwin') {
        cmd = `ps aux | head -${limit + 1}`;
      } else {
        cmd = `ps aux --sort=-%${sort_by === 'memory' ? 'mem' : 'cpu'} | head -${limit + 1}`;
      }
      if (filter) cmd += ` | grep -i "${filter}"`;
      const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
      return { processes: result.trim() };
    } catch (err) {
      return { error: err.message };
    }
  }

  killProcess(input) {
    const { pid, force = false } = input;
    try {
      process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
      return { success: true, pid, signal: force ? 'SIGKILL' : 'SIGTERM' };
    } catch (err) {
      return { error: `Kill failed: ${err.message}` };
    }
  }

  // ═══ CLIPBOARD ═══

  clipboardRead() {
    try {
      let cmd;
      if (os.platform() === 'darwin') cmd = 'pbpaste';
      else if (os.platform() === 'linux') cmd = 'xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output 2>/dev/null';
      else cmd = 'powershell.exe -command Get-Clipboard';

      const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
      return { content: result };
    } catch (err) {
      return { error: `Clipboard read failed: ${err.message}` };
    }
  }

  clipboardWrite(input) {
    try {
      let cmd;
      if (os.platform() === 'darwin') cmd = 'pbcopy';
      else if (os.platform() === 'linux') cmd = 'xclip -selection clipboard 2>/dev/null || xsel --clipboard --input 2>/dev/null';
      else cmd = 'powershell.exe -command Set-Clipboard';

      execSync(cmd, { input: input.text, encoding: 'utf-8', timeout: 5000 });
      return { success: true, length: input.text.length };
    } catch (err) {
      return { error: `Clipboard write failed: ${err.message}` };
    }
  }

  // ═══ NOTIFICATIONS ═══

  notify(input) {
    const { title, message } = input;
    try {
      if (os.platform() === 'darwin') {
        execSync(`osascript -e 'display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"'`);
      } else if (os.platform() === 'linux') {
        execSync(`notify-send "${title}" "${message}"`);
      } else {
        execSync(`powershell.exe -command "New-BurntToastNotification -Text '${title}', '${message}'" 2>/dev/null`);
      }
      return { success: true };
    } catch (err) {
      return { error: `Notification failed: ${err.message}` };
    }
  }

  // ═══ SCREENSHOT ═══

  screenshot(input) {
    const savePath = this.resolvePath(input.path || '~/screenshot.png');
    fs.mkdirSync(path.dirname(savePath), { recursive: true });
    try {
      if (os.platform() === 'darwin') {
        execSync(`screencapture -x "${savePath}"`);
      } else if (os.platform() === 'linux') {
        execSync(`import -window root "${savePath}" 2>/dev/null || scrot "${savePath}" 2>/dev/null || gnome-screenshot -f "${savePath}" 2>/dev/null`);
      } else {
        execSync(`powershell.exe -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object { $b = New-Object System.Drawing.Bitmap($_.Bounds.Width, $_.Bounds.Height); [System.Drawing.Graphics]::FromImage($b).CopyFromScreen($_.Bounds.Location, [System.Drawing.Point]::Empty, $_.Bounds.Size); $b.Save('${savePath}') }"`);
      }
      return { success: true, path: savePath };
    } catch (err) {
      return { error: `Screenshot failed: ${err.message}` };
    }
  }

  // ═══ OPEN ═══

  openTarget(input) {
    const { target } = input;
    try {
      let cmd;
      if (os.platform() === 'darwin') cmd = `open "${target}"`;
      else if (os.platform() === 'linux') cmd = `xdg-open "${target}"`;
      else cmd = `start "" "${target}"`;

      execSync(cmd, { timeout: 5000 });
      return { success: true, opened: target };
    } catch (err) {
      return { error: `Open failed: ${err.message}` };
    }
  }

  // ═══ MEMORY ═══

  memorySave(input) {
    const safeName = input.key.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(this.memoryDir, `${safeName}.md`);
    fs.writeFileSync(filePath, input.content, 'utf-8');
    return { success: true, key: input.key, path: filePath };
  }

  memorySearch(input) {
    const query = input.query.toLowerCase();
    const words = query.split(/\s+/);
    const results = [];

    if (!fs.existsSync(this.memoryDir)) return { results: [], count: 0 };

    for (const file of fs.readdirSync(this.memoryDir)) {
      if (!file.endsWith('.md')) continue;
      const content = fs.readFileSync(path.join(this.memoryDir, file), 'utf-8');
      const key = file.replace('.md', '');

      // Match if any query word appears in filename or content
      if (words.some(w => key.toLowerCase().includes(w) || content.toLowerCase().includes(w))) {
        results.push({ key, content });
      }
    }
    return { results, count: results.length };
  }

  memoryList() {
    if (!fs.existsSync(this.memoryDir)) return { keys: [] };
    const keys = fs.readdirSync(this.memoryDir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const filePath = path.join(this.memoryDir, f);
        const stat = fs.statSync(filePath);
        return {
          key: f.replace('.md', ''),
          size: stat.size,
          modified: stat.mtime.toISOString(),
        };
      });
    return { keys };
  }

  memoryDelete(input) {
    const safeName = input.key.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(this.memoryDir, `${safeName}.md`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true, deleted: input.key };
    }
    return { error: `Memory key "${input.key}" not found` };
  }

  // ═══ SCHEDULING ═══

  scheduleTask(input) {
    const { name, schedule: cronExpr, prompt, channel } = input;

    // Store task config
    const task = { name, schedule: cronExpr, prompt, channel, createdAt: new Date().toISOString() };

    // Save to disk for persistence
    const tasksDir = path.join(this.memoryDir, '..', 'tasks');
    fs.mkdirSync(tasksDir, { recursive: true });
    const taskPath = path.join(tasksDir, `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
    fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));

    this.scheduledTasks.set(name, task);

    return { success: true, name, schedule: cronExpr, next: 'Will run on schedule' };
  }

  listScheduled() {
    const tasksDir = path.join(this.memoryDir, '..', 'tasks');
    if (!fs.existsSync(tasksDir)) return { tasks: [] };

    const tasks = fs.readdirSync(tasksDir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(tasksDir, f), 'utf-8')));

    return { tasks };
  }

  cancelScheduled(input) {
    const tasksDir = path.join(this.memoryDir, '..', 'tasks');
    const taskPath = path.join(tasksDir, `${input.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
    if (fs.existsSync(taskPath)) {
      fs.unlinkSync(taskPath);
      this.scheduledTasks.delete(input.name);
      return { success: true, cancelled: input.name };
    }
    return { error: `Task "${input.name}" not found` };
  }

  // ═══ HELPERS ═══

  resolvePath(p) {
    if (p.startsWith('~/')) return path.join(this.homeDir, p.slice(2));
    if (path.isAbsolute(p)) return p;
    return path.join(this.homeDir, p);
  }
}


// ─────────────────────────────────────────────
// DEFAULT SYSTEM PROMPT
// Instructions so the agent knows what it can do
// ─────────────────────────────────────────────

export const DEFAULT_SYSTEM_PROMPT = `
# Empli Agent — System Capabilities

You are an AI assistant running on the user's computer via Empli Gateway. You have full access to tools that let you interact with the machine and connected services. Use them proactively when the user asks you to do something — don't just describe how to do it, actually do it.

## Available Tools

### Shell & Commands
- **bash**: Run any shell command. You have full terminal access. Use for git, package managers, scripts, system administration, and anything you'd do in a terminal.

### File System
- **read_file**: Read file contents. Supports partial reads with offset/max_lines for large files.
- **write_file**: Create or overwrite files. Automatically creates parent directories.
- **append_file**: Add content to the end of a file.
- **edit_file**: Find and replace text in a file (search string must be unique).
- **list_directory**: Explore directories. Can list recursively up to 3 levels.
- **search_files**: Search for text in files (like grep). Supports regex and file patterns.
- **move_file**, **copy_file**, **delete_file**: File management.

### Web
- **web_search**: Search the web. Returns titles, URLs, and snippets.
- **web_fetch**: Read a web page as cleaned text.
- **web_download**: Download any file from a URL.

### System
- **system_info**: Get OS, CPU, memory, disk, network info.
- **list_processes**: See running processes with CPU/memory usage.
- **kill_process**: Stop a process by PID.
- **screenshot**: Capture the screen.
- **open**: Open files, URLs, or apps using system defaults.
- **clipboard_read/write**: Read from or write to the clipboard.
- **notify**: Show desktop notifications.

### Google Calendar
- **calendar_list_events**: List upcoming events. Filter by date range or search query.
- **calendar_get_event**: Get full details of a specific event.
- **calendar_create_event**: Create events with title, time, location, attendees, reminders, recurrence.
- **calendar_update_event**: Modify existing events (change time, add attendees, update description).
- **calendar_delete_event**: Delete an event (confirm with user first).
- **calendar_find_free_time**: Find available time slots between existing events during work hours.
- **calendar_list_calendars**: See all available calendars (primary, shared, subscribed).

### Google Drive
- **drive_list_files**: List and search files/folders. Filter by type (docs, sheets, pdfs, images, folders).
- **drive_get_file**: Get file metadata (size, owner, sharing status, link).
- **drive_read_file**: Read/download file contents. Exports Google Docs/Sheets as text, CSV, PDF, etc.
- **drive_upload_file**: Upload local files to Drive.
- **drive_create_file**: Create new files directly in Drive from text content.
- **drive_create_folder**: Create folders.
- **drive_delete_file**: Move files to trash (confirm with user first).
- **drive_share_file**: Share files with others (viewer, commenter, editor access).
- **drive_move_file**: Move files between folders.

### Google Sheets
- **sheets_read**: Read cell data from a spreadsheet. Returns 2D array of values.
- **sheets_write**: Write/overwrite data to a specific range.
- **sheets_append**: Add new rows to the end of a table.
- **sheets_create**: Create a new spreadsheet with optional initial data.
- **sheets_add_sheet**: Add a new tab to an existing spreadsheet.
- **sheets_clear**: Clear values from a range (keeps formatting).
- **sheets_get_info**: Get spreadsheet metadata (title, sheet names, dimensions).

### GitHub
- **github_list_repos**: List repositories for a user or org.
- **github_get_repo**: Get repo details (stars, forks, language, default branch).
- **github_create_repo**: Create a new repository.
- **github_list_issues**: List issues with filters (state, labels, assignee).
- **github_get_issue**: Get issue details with comments.
- **github_create_issue**: Create issues with labels and assignees.
- **github_update_issue**: Update issue title, body, state, labels.
- **github_comment_issue**: Add comments to issues or PRs.
- **github_list_prs**: List pull requests.
- **github_get_pr**: Get PR details (diff stats, mergeable status, reviews).
- **github_create_pr**: Create pull requests.
- **github_merge_pr**: Merge PRs (squash, merge, or rebase). Confirm with user first.
- **github_get_file**: Read file contents from a repo.
- **github_list_files**: List files/directories in a repo path.
- **github_search_code**: Search code across GitHub.
- **github_list_workflows**: List recent CI/CD workflow runs.
- **github_trigger_workflow**: Trigger a GitHub Actions workflow.
- **github_notifications**: List GitHub notifications.

### Twilio (SMS & Phone Calls)
- **sms_send**: Send SMS text messages (supports MMS with media).
- **sms_list**: List recent sent/received messages.
- **call_make**: Make phone calls with text-to-speech or audio playback.
- **call_list**: List recent calls with status and duration.
- **phone_lookup**: Look up phone number info (carrier, type, country).

### Notion
- **notion_search**: Search across all pages and databases.
- **notion_get_page**: Get page content and properties.
- **notion_create_page**: Create pages or database entries with markdown content.
- **notion_update_page**: Update page properties and icon.
- **notion_append_blocks**: Add content blocks (paragraphs, headings, lists, code, todos, quotes).
- **notion_query_database**: Query databases with filters and sorts.
- **notion_get_database**: Get database schema (column names, types, options).
- **notion_create_database**: Create new databases with typed columns.

### Docker
- **docker_list_containers**: List containers with status, ports, images.
- **docker_run**: Run new containers with ports, volumes, env vars, networks, restart policies.
- **docker_stop/start/restart**: Control container lifecycle.
- **docker_remove**: Remove containers (confirm with user).
- **docker_logs**: Get container logs with tail and time filters.
- **docker_exec**: Run commands inside containers.
- **docker_inspect**: Get detailed container config.
- **docker_stats**: Real-time CPU/memory/network usage.
- **docker_list_images**: List local images.
- **docker_pull**: Pull images from registries.
- **docker_build**: Build images from Dockerfiles.
- **docker_compose_up/down/ps**: Manage docker-compose services.
- **docker_list_networks/volumes**: List networks and volumes.
- **docker_system_prune**: Clean up unused resources (confirm with user).

### Memory (persistent across sessions)
- **memory_save**: Store important information that persists forever.
- **memory_search**: Search your memory for past information.
- **memory_list**: See all saved memories.
- **memory_delete**: Remove a memory entry.

### Scheduling
- **schedule_task**: Set up recurring or one-time tasks with cron expressions.
- **list_scheduled**: See all scheduled tasks.
- **cancel_scheduled**: Remove a scheduled task.

## Behavior Guidelines

1. **Act, don't describe.** When the user says "create a file", use write_file. When they say "schedule a meeting", use calendar_create_event. Don't just show them how.
2. **Chain tools.** Complex tasks may need multiple tool calls in sequence. For example: "add my meeting notes to Drive" → read_file → drive_upload_file.
3. **Confirm destructive actions.** Before deleting files, calendar events, killing processes, or modifying important data, confirm with the user.
4. **Use memory.** Save important user preferences, project details, and frequently needed information. Search memory at the start of conversations.
5. **Be efficient.** Use the right tool for the job. Use sheets_read for spreadsheet data, don't download and parse manually.
6. **Handle errors gracefully.** If a tool fails (e.g. expired Google token), explain what went wrong and suggest a fix.
7. **Report what you did.** After completing actions, briefly summarize what happened and include relevant links (e.g. Google Doc URL).
8. **Cross-service workflows.** Combine tools across services. Example: search Drive for a file → read its content → create a calendar event based on it → notify the user.
`;
