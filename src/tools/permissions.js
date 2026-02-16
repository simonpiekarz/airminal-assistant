// ═══════════════════════════════════════════════════════════════
// Permission System — approve/deny/remember
// Controls what the agent can do without asking
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import os from 'os';

const APPROVALS_PATH = path.join(os.homedir(), '.empli', 'permissions.json');

// Commands that are always safe (read-only, no side effects)
const SAFE_COMMANDS = new Set([
  'ls', 'cat', 'head', 'tail', 'wc', 'date', 'whoami', 'echo',
  'pwd', 'which', 'file', 'stat', 'du', 'df', 'uname', 'env',
  'hostname', 'uptime', 'id', 'groups', 'printenv', 'locale',
  'find', 'grep', 'awk', 'sed', 'sort', 'uniq', 'tr', 'cut',
  'diff', 'md5sum', 'sha256sum', 'base64', 'wc',
  'git status', 'git log', 'git diff', 'git branch', 'git remote',
  'node --version', 'npm --version', 'python --version', 'python3 --version',
]);

// Patterns that should always require approval
const DANGEROUS_PATTERNS = [
  /\brm\s+-rf?\b/,                    // rm -r, rm -rf
  /\bsudo\b/,                          // anything with sudo
  /\bchmod\s+[0-7]{3,4}\b/,           // chmod with octal
  /\bcurl\b.*\|\s*(bash|sh|zsh)\b/,   // curl | bash
  /\bwget\b.*\|\s*(bash|sh|zsh)\b/,   // wget | bash
  /\bdd\s+if=/,                        // dd (disk writing)
  /\bmkfs\b/,                          // format filesystem
  /\bformat\b/,                        // format
  />\s*\/dev\//,                        // writing to devices
  /\bshutdown\b/,                      // shutdown
  /\breboot\b/,                        // reboot
  /\bkillall\b/,                       // killall
  /\bpkill\b/,                         // pkill
  /DROP\s+TABLE/i,                     // SQL drop table
  /DROP\s+DATABASE/i,                  // SQL drop database
];

// Tools that are always safe (no side effects)
const SAFE_TOOLS = new Set([
  'read_file', 'list_directory', 'search_files', 'system_info',
  'list_processes', 'clipboard_read', 'memory_search', 'memory_list',
  'list_scheduled', 'web_search', 'web_fetch',
  // Google read-only
  'calendar_list_events', 'calendar_get_event', 'calendar_find_free_time', 'calendar_list_calendars',
  'drive_list_files', 'drive_get_file', 'drive_read_file',
  'sheets_read', 'sheets_get_info',
  // GitHub read-only
  'github_list_repos', 'github_get_repo', 'github_list_issues', 'github_get_issue',
  'github_list_prs', 'github_get_pr', 'github_get_file', 'github_list_files',
  'github_search_code', 'github_list_workflows', 'github_notifications',
  // Twilio read-only
  'sms_list', 'call_list', 'phone_lookup',
  // Notion read-only
  'notion_search', 'notion_get_page', 'notion_query_database', 'notion_get_database',
  // Docker read-only
  'docker_list_containers', 'docker_logs', 'docker_inspect', 'docker_stats',
  'docker_list_images', 'docker_compose_ps', 'docker_list_networks', 'docker_list_volumes',
  // Database read-only
  'db_query', 'db_list_tables', 'db_describe_table', 'db_list_databases', 'db_table_stats',
]);

// Tools that modify things but are generally ok
const MODERATE_TOOLS = new Set([
  'write_file', 'append_file', 'edit_file', 'copy_file', 'move_file',
  'web_download', 'clipboard_write', 'notify', 'open', 'screenshot',
  'memory_save', 'memory_delete', 'schedule_task', 'cancel_scheduled',
  // Google write operations
  'calendar_create_event', 'calendar_update_event',
  'drive_upload_file', 'drive_create_file', 'drive_create_folder', 'drive_share_file', 'drive_move_file',
  'sheets_write', 'sheets_append', 'sheets_create', 'sheets_add_sheet', 'sheets_clear',
  // GitHub write operations
  'github_create_repo', 'github_create_issue', 'github_update_issue', 'github_comment_issue',
  'github_create_pr', 'github_trigger_workflow',
  // Twilio write
  'sms_send', 'call_make',
  // Notion write
  'notion_create_page', 'notion_update_page', 'notion_append_blocks', 'notion_create_database',
  // Docker moderate
  'docker_run', 'docker_start', 'docker_restart', 'docker_exec', 'docker_pull', 'docker_build',
  'docker_compose_up',
  // Database write
  'db_insert', 'db_update', 'db_create_table', 'db_export', 'db_import',
]);

// Tools that need extra caution
const DANGEROUS_TOOLS = new Set([
  'bash', 'delete_file', 'kill_process',
  // Google destructive
  'calendar_delete_event', 'drive_delete_file',
  // GitHub destructive
  'github_merge_pr',
  // Docker destructive
  'docker_stop', 'docker_remove', 'docker_compose_down', 'docker_system_prune',
  // Database destructive
  'db_execute', 'db_delete',
]);

export class PermissionSystem {
  constructor() {
    this.approvals = this._load();
    this.pendingCallbacks = new Map(); // For async approval via chat
  }

  // Check if a tool call is allowed
  // Returns: 'allowed' | 'denied' | 'needs_approval'
  check(toolName, input) {
    // Safe tools always allowed
    if (SAFE_TOOLS.has(toolName)) return 'allowed';

    // Moderate tools: allowed by default
    if (MODERATE_TOOLS.has(toolName)) {
      // But delete_file with recursive needs approval
      if (toolName === 'delete_file' && input.recursive) return this._checkApproval(toolName, input);
      return 'allowed';
    }

    // Bash: check the command
    if (toolName === 'bash') {
      return this._checkBash(input.command);
    }

    // kill_process always needs approval
    if (toolName === 'kill_process') {
      return this._checkApproval(toolName, input);
    }

    // Unknown tools: need approval
    return this._checkApproval(toolName, input);
  }

  _checkBash(command) {
    if (!command) return 'denied';
    const trimmed = command.trim();
    const baseCmd = trimmed.split(/\s+/)[0];

    // Check safe list
    if (SAFE_COMMANDS.has(baseCmd) || SAFE_COMMANDS.has(trimmed)) return 'allowed';

    // Check dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        // Check if previously approved
        const key = `bash:${trimmed}`;
        if (this.approvals.allowed.includes(key)) return 'allowed';
        if (this.approvals.denied.includes(key)) return 'denied';
        return 'needs_approval';
      }
    }

    // Check if the base command was previously approved/denied
    const baseKey = `bash_cmd:${baseCmd}`;
    if (this.approvals.allowed.includes(baseKey)) return 'allowed';

    // Check if the exact command was previously approved
    const exactKey = `bash:${trimmed}`;
    if (this.approvals.allowed.includes(exactKey)) return 'allowed';
    if (this.approvals.denied.includes(exactKey)) return 'denied';

    // Default: common commands are allowed
    const commonCommands = new Set([
      'mkdir', 'touch', 'cp', 'mv', 'ln', 'tar', 'zip', 'unzip', 'gzip',
      'curl', 'wget', 'ssh', 'scp', 'rsync',
      'git', 'npm', 'npx', 'yarn', 'pnpm', 'pip', 'pip3', 'python', 'python3', 'node',
      'docker', 'brew', 'apt', 'apt-get', 'code', 'open', 'xdg-open',
      'make', 'cmake', 'cargo', 'go', 'java', 'javac', 'ruby', 'php',
    ]);

    if (commonCommands.has(baseCmd)) return 'allowed';

    // Unknown command: needs approval
    return 'needs_approval';
  }

  _checkApproval(toolName, input) {
    const key = `${toolName}:${JSON.stringify(input)}`;
    if (this.approvals.allowed.includes(key)) return 'allowed';
    if (this.approvals.denied.includes(key)) return 'denied';
    return 'needs_approval';
  }

  // Record an approval decision
  approve(toolName, input, allowed) {
    const key = toolName === 'bash' ? `bash:${input.command}` : `${toolName}:${JSON.stringify(input)}`;
    const list = allowed ? 'allowed' : 'denied';

    if (!this.approvals[list].includes(key)) {
      this.approvals[list].push(key);
      this._save();
    }
  }

  // Approve an entire command (e.g. approve "npm" so all npm commands work)
  approveCommand(command) {
    const key = `bash_cmd:${command}`;
    if (!this.approvals.allowed.includes(key)) {
      this.approvals.allowed.push(key);
      this._save();
    }
  }

  // Get a human-readable description of what needs approval
  describeAction(toolName, input) {
    switch (toolName) {
      case 'bash':
        return `Run command: ${input.command}`;
      case 'delete_file':
        return `Delete ${input.recursive ? 'directory' : 'file'}: ${input.path}`;
      case 'kill_process':
        return `Kill process PID ${input.pid}${input.force ? ' (force)' : ''}`;
      default:
        return `${toolName}: ${JSON.stringify(input).substring(0, 100)}`;
    }
  }

  // Persistence
  _load() {
    try {
      if (fs.existsSync(APPROVALS_PATH)) {
        return JSON.parse(fs.readFileSync(APPROVALS_PATH, 'utf-8'));
      }
    } catch (e) {}
    return { allowed: [], denied: [] };
  }

  _save() {
    fs.mkdirSync(path.dirname(APPROVALS_PATH), { recursive: true });
    fs.writeFileSync(APPROVALS_PATH, JSON.stringify(this.approvals, null, 2));
  }
}
