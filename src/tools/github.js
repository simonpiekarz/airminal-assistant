// ═══════════════════════════════════════════════════════════════
// Empli Gateway — GitHub Tools
// Repos, Issues, PRs, Code, Actions — via GitHub REST API
// Requires a Personal Access Token (PAT)
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import os from 'os';

export const GITHUB_TOOL_DEFINITIONS = [

  // ═══ REPOS ═══
  {
    name: 'github_list_repos',
    description: 'List GitHub repositories for the authenticated user or a specified user/org. Returns repo names, descriptions, stars, language, and URLs.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Username or org (optional, defaults to authenticated user)' },
        type: { type: 'string', enum: ['all', 'owner', 'public', 'private', 'member'], description: 'Filter type (default: "all")' },
        sort: { type: 'string', enum: ['created', 'updated', 'pushed', 'full_name'], description: 'Sort by (default: "updated")' },
        max_results: { type: 'number', description: 'Max repos to return (default: 20)' },
      },
      required: [],
    },
  },
  {
    name: 'github_get_repo',
    description: 'Get detailed info about a specific repository.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_create_repo',
    description: 'Create a new GitHub repository.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Repository name' },
        description: { type: 'string', description: 'Repository description' },
        private: { type: 'boolean', description: 'Make private (default: false)' },
        auto_init: { type: 'boolean', description: 'Initialize with README (default: true)' },
      },
      required: ['name'],
    },
  },

  // ═══ ISSUES ═══
  {
    name: 'github_list_issues',
    description: 'List issues for a repository. Filter by state, labels, assignee.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Filter by state (default: "open")' },
        labels: { type: 'string', description: 'Comma-separated label names to filter by' },
        assignee: { type: 'string', description: 'Filter by assignee username' },
        max_results: { type: 'number', description: 'Max results (default: 20)' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_get_issue',
    description: 'Get full details of an issue including comments.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
        issue_number: { type: 'number', description: 'Issue number' },
      },
      required: ['owner', 'repo', 'issue_number'],
    },
  },
  {
    name: 'github_create_issue',
    description: 'Create a new issue on a repository.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue body (markdown)' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Labels to add' },
        assignees: { type: 'array', items: { type: 'string' }, description: 'Usernames to assign' },
      },
      required: ['owner', 'repo', 'title'],
    },
  },
  {
    name: 'github_update_issue',
    description: 'Update an existing issue (title, body, state, labels, assignees).',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
        issue_number: { type: 'number', description: 'Issue number' },
        title: { type: 'string', description: 'New title' },
        body: { type: 'string', description: 'New body' },
        state: { type: 'string', enum: ['open', 'closed'], description: 'Change state' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Replace labels' },
        assignees: { type: 'array', items: { type: 'string' }, description: 'Replace assignees' },
      },
      required: ['owner', 'repo', 'issue_number'],
    },
  },
  {
    name: 'github_comment_issue',
    description: 'Add a comment to an issue or pull request.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
        issue_number: { type: 'number', description: 'Issue or PR number' },
        body: { type: 'string', description: 'Comment body (markdown)' },
      },
      required: ['owner', 'repo', 'issue_number', 'body'],
    },
  },

  // ═══ PULL REQUESTS ═══
  {
    name: 'github_list_prs',
    description: 'List pull requests for a repository.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Filter state (default: "open")' },
        max_results: { type: 'number', description: 'Max results (default: 20)' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_get_pr',
    description: 'Get full details of a pull request including diff stats and review status.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
        pr_number: { type: 'number', description: 'PR number' },
      },
      required: ['owner', 'repo', 'pr_number'],
    },
  },
  {
    name: 'github_create_pr',
    description: 'Create a pull request.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
        title: { type: 'string', description: 'PR title' },
        body: { type: 'string', description: 'PR description (markdown)' },
        head: { type: 'string', description: 'Branch with changes (e.g. "feature-branch")' },
        base: { type: 'string', description: 'Target branch (default: "main")' },
        draft: { type: 'boolean', description: 'Create as draft PR (default: false)' },
      },
      required: ['owner', 'repo', 'title', 'head'],
    },
  },
  {
    name: 'github_merge_pr',
    description: 'Merge a pull request. CAUTION: confirm with user before merging.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
        pr_number: { type: 'number', description: 'PR number' },
        merge_method: { type: 'string', enum: ['merge', 'squash', 'rebase'], description: 'Merge method (default: "squash")' },
        commit_message: { type: 'string', description: 'Custom merge commit message (optional)' },
      },
      required: ['owner', 'repo', 'pr_number'],
    },
  },

  // ═══ CODE / FILES ═══
  {
    name: 'github_get_file',
    description: 'Read a file from a GitHub repository. Returns the decoded text content.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
        path: { type: 'string', description: 'File path in the repo (e.g. "src/index.js")' },
        ref: { type: 'string', description: 'Branch or commit SHA (default: default branch)' },
      },
      required: ['owner', 'repo', 'path'],
    },
  },
  {
    name: 'github_list_files',
    description: 'List files and directories in a repository path.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
        path: { type: 'string', description: 'Directory path (default: root)' },
        ref: { type: 'string', description: 'Branch or commit SHA' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_search_code',
    description: 'Search for code across GitHub repositories.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (e.g. "useState repo:facebook/react")' },
        max_results: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: ['query'],
    },
  },

  // ═══ ACTIONS / WORKFLOWS ═══
  {
    name: 'github_list_workflows',
    description: 'List recent workflow runs (CI/CD) for a repository.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
        status: { type: 'string', enum: ['completed', 'in_progress', 'queued', 'failure', 'success'], description: 'Filter by status' },
        max_results: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_trigger_workflow',
    description: 'Trigger a GitHub Actions workflow dispatch event.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner' },
        repo: { type: 'string', description: 'Repo name' },
        workflow_id: { type: 'string', description: 'Workflow file name (e.g. "deploy.yml") or ID' },
        ref: { type: 'string', description: 'Branch to run on (default: "main")' },
        inputs: { type: 'object', description: 'Workflow input parameters (optional)' },
      },
      required: ['owner', 'repo', 'workflow_id'],
    },
  },

  // ═══ NOTIFICATIONS ═══
  {
    name: 'github_notifications',
    description: 'List GitHub notifications (mentions, review requests, assigned issues).',
    input_schema: {
      type: 'object',
      properties: {
        all: { type: 'boolean', description: 'Include read notifications (default: false)' },
        max_results: { type: 'number', description: 'Max results (default: 20)' },
      },
      required: [],
    },
  },
];


// ─────────────────────────────────────────────
// GITHUB TOOL EXECUTOR
// ─────────────────────────────────────────────

export class GitHubToolExecutor {
  constructor(config = {}) {
    this.token = config.token || process.env.GITHUB_TOKEN || '';
    this.baseUrl = 'https://api.github.com';
  }

  async execute(toolName, input) {
    if (!this.token) {
      return { error: 'GitHub token not configured. Set GITHUB_TOKEN env var or add to config.' };
    }
    try {
      switch (toolName) {
        case 'github_list_repos': return await this.listRepos(input);
        case 'github_get_repo': return await this.getRepo(input);
        case 'github_create_repo': return await this.createRepo(input);
        case 'github_list_issues': return await this.listIssues(input);
        case 'github_get_issue': return await this.getIssue(input);
        case 'github_create_issue': return await this.createIssue(input);
        case 'github_update_issue': return await this.updateIssue(input);
        case 'github_comment_issue': return await this.commentIssue(input);
        case 'github_list_prs': return await this.listPRs(input);
        case 'github_get_pr': return await this.getPR(input);
        case 'github_create_pr': return await this.createPR(input);
        case 'github_merge_pr': return await this.mergePR(input);
        case 'github_get_file': return await this.getFile(input);
        case 'github_list_files': return await this.listFiles(input);
        case 'github_search_code': return await this.searchCode(input);
        case 'github_list_workflows': return await this.listWorkflows(input);
        case 'github_trigger_workflow': return await this.triggerWorkflow(input);
        case 'github_notifications': return await this.notifications(input);
        default: return { error: `Unknown GitHub tool: ${toolName}` };
      }
    } catch (err) {
      return { error: `${toolName} failed: ${err.message}` };
    }
  }

  async _api(method, endpoint, body) {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  }

  // ═══ REPOS ═══

  async listRepos(input) {
    const { owner, type = 'all', sort = 'updated', max_results = 20 } = input;
    const endpoint = owner ? `/users/${owner}/repos` : '/user/repos';
    const data = await this._api('GET', `${endpoint}?type=${type}&sort=${sort}&per_page=${max_results}`);
    return { repos: data.map(r => ({ name: r.full_name, description: r.description, stars: r.stargazers_count, language: r.language, private: r.private, updated: r.updated_at, url: r.html_url })), count: data.length };
  }

  async getRepo(input) {
    const data = await this._api('GET', `/repos/${input.owner}/${input.repo}`);
    return { name: data.full_name, description: data.description, stars: data.stargazers_count, forks: data.forks_count, language: data.language, private: data.private, default_branch: data.default_branch, open_issues: data.open_issues_count, created: data.created_at, updated: data.updated_at, url: data.html_url, clone_url: data.clone_url };
  }

  async createRepo(input) {
    const data = await this._api('POST', '/user/repos', { name: input.name, description: input.description, private: input.private || false, auto_init: input.auto_init !== false });
    return { success: true, name: data.full_name, url: data.html_url, clone_url: data.clone_url };
  }

  // ═══ ISSUES ═══

  async listIssues(input) {
    const { owner, repo, state = 'open', labels, assignee, max_results = 20 } = input;
    let q = `?state=${state}&per_page=${max_results}`;
    if (labels) q += `&labels=${labels}`;
    if (assignee) q += `&assignee=${assignee}`;
    const data = await this._api('GET', `/repos/${owner}/${repo}/issues${q}`);
    return { issues: data.filter(i => !i.pull_request).map(i => ({ number: i.number, title: i.title, state: i.state, author: i.user?.login, labels: i.labels?.map(l => l.name), assignees: i.assignees?.map(a => a.login), created: i.created_at, comments: i.comments, url: i.html_url })), count: data.filter(i => !i.pull_request).length };
  }

  async getIssue(input) {
    const { owner, repo, issue_number } = input;
    const issue = await this._api('GET', `/repos/${owner}/${repo}/issues/${issue_number}`);
    const comments = await this._api('GET', `/repos/${owner}/${repo}/issues/${issue_number}/comments?per_page=20`);
    return { number: issue.number, title: issue.title, state: issue.state, body: issue.body?.substring(0, 3000), author: issue.user?.login, labels: issue.labels?.map(l => l.name), assignees: issue.assignees?.map(a => a.login), created: issue.created_at, url: issue.html_url, comments: comments.map(c => ({ author: c.user?.login, body: c.body?.substring(0, 500), created: c.created_at })) };
  }

  async createIssue(input) {
    const { owner, repo, title, body, labels, assignees } = input;
    const data = await this._api('POST', `/repos/${owner}/${repo}/issues`, { title, body, labels, assignees });
    return { success: true, number: data.number, url: data.html_url };
  }

  async updateIssue(input) {
    const { owner, repo, issue_number, ...updates } = input;
    const data = await this._api('PATCH', `/repos/${owner}/${repo}/issues/${issue_number}`, updates);
    return { success: true, number: data.number, state: data.state, url: data.html_url };
  }

  async commentIssue(input) {
    const { owner, repo, issue_number, body } = input;
    const data = await this._api('POST', `/repos/${owner}/${repo}/issues/${issue_number}/comments`, { body });
    return { success: true, id: data.id, url: data.html_url };
  }

  // ═══ PULL REQUESTS ═══

  async listPRs(input) {
    const { owner, repo, state = 'open', max_results = 20 } = input;
    const data = await this._api('GET', `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${max_results}`);
    return { prs: data.map(p => ({ number: p.number, title: p.title, state: p.state, author: p.user?.login, head: p.head?.ref, base: p.base?.ref, draft: p.draft, created: p.created_at, url: p.html_url })), count: data.length };
  }

  async getPR(input) {
    const { owner, repo, pr_number } = input;
    const pr = await this._api('GET', `/repos/${owner}/${repo}/pulls/${pr_number}`);
    return { number: pr.number, title: pr.title, state: pr.state, body: pr.body?.substring(0, 3000), author: pr.user?.login, head: pr.head?.ref, base: pr.base?.ref, draft: pr.draft, mergeable: pr.mergeable, additions: pr.additions, deletions: pr.deletions, changed_files: pr.changed_files, created: pr.created_at, url: pr.html_url };
  }

  async createPR(input) {
    const { owner, repo, title, body, head, base = 'main', draft } = input;
    const data = await this._api('POST', `/repos/${owner}/${repo}/pulls`, { title, body, head, base, draft });
    return { success: true, number: data.number, url: data.html_url };
  }

  async mergePR(input) {
    const { owner, repo, pr_number, merge_method = 'squash', commit_message } = input;
    const body = { merge_method };
    if (commit_message) body.commit_message = commit_message;
    const data = await this._api('PUT', `/repos/${owner}/${repo}/pulls/${pr_number}/merge`, body);
    return { success: true, sha: data.sha, message: data.message };
  }

  // ═══ CODE ═══

  async getFile(input) {
    const { owner, repo, path: filePath, ref } = input;
    let endpoint = `/repos/${owner}/${repo}/contents/${filePath}`;
    if (ref) endpoint += `?ref=${ref}`;
    const data = await this._api('GET', endpoint);
    const content = data.encoding === 'base64' ? Buffer.from(data.content, 'base64').toString('utf-8') : data.content;
    return { content: content.substring(0, 50000), name: data.name, path: data.path, size: data.size, sha: data.sha };
  }

  async listFiles(input) {
    const { owner, repo, path: dirPath = '', ref } = input;
    let endpoint = `/repos/${owner}/${repo}/contents/${dirPath}`;
    if (ref) endpoint += `?ref=${ref}`;
    const data = await this._api('GET', endpoint);
    return { files: (Array.isArray(data) ? data : [data]).map(f => ({ name: f.name, type: f.type, size: f.size, path: f.path })) };
  }

  async searchCode(input) {
    const { query, max_results = 10 } = input;
    const data = await this._api('GET', `/search/code?q=${encodeURIComponent(query)}&per_page=${max_results}`);
    return { results: (data.items || []).map(i => ({ name: i.name, path: i.path, repo: i.repository?.full_name, url: i.html_url })), total: data.total_count };
  }

  // ═══ WORKFLOWS ═══

  async listWorkflows(input) {
    const { owner, repo, status, max_results = 10 } = input;
    let endpoint = `/repos/${owner}/${repo}/actions/runs?per_page=${max_results}`;
    if (status) endpoint += `&status=${status}`;
    const data = await this._api('GET', endpoint);
    return { runs: (data.workflow_runs || []).map(r => ({ id: r.id, name: r.name, status: r.status, conclusion: r.conclusion, branch: r.head_branch, event: r.event, created: r.created_at, url: r.html_url })), count: data.total_count };
  }

  async triggerWorkflow(input) {
    const { owner, repo, workflow_id, ref = 'main', inputs } = input;
    await this._api('POST', `/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`, { ref, inputs: inputs || {} });
    return { success: true, workflow: workflow_id, ref };
  }

  // ═══ NOTIFICATIONS ═══

  async notifications(input) {
    const { all = false, max_results = 20 } = input;
    const data = await this._api('GET', `/notifications?all=${all}&per_page=${max_results}`);
    return { notifications: data.map(n => ({ id: n.id, reason: n.reason, title: n.subject?.title, type: n.subject?.type, repo: n.repository?.full_name, updated: n.updated_at, unread: n.unread })), count: data.length };
  }
}
