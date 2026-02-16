// ═══════════════════════════════════════════════════════════════
// Empli Gateway — Notion Tools
// Pages, Databases, Blocks, Search — via Notion API
// Requires a Notion Integration Token
// ═══════════════════════════════════════════════════════════════

export const NOTION_TOOL_DEFINITIONS = [
  {
    name: 'notion_search',
    description: 'Search across all Notion pages and databases. Returns matching titles, types, and URLs. Use for: finding pages, looking up information, discovering content.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text' },
        filter: { type: 'string', enum: ['page', 'database'], description: 'Filter by type (optional)' },
        max_results: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'notion_get_page',
    description: 'Get a Notion page with its properties and content blocks. Use for: reading pages, checking page details, getting page content.',
    input_schema: {
      type: 'object',
      properties: {
        page_id: { type: 'string', description: 'The page ID (from URL or search results)' },
      },
      required: ['page_id'],
    },
  },
  {
    name: 'notion_create_page',
    description: 'Create a new page in Notion. Can be a standalone page or a row in a database. Use for: creating notes, adding database entries, writing documents.',
    input_schema: {
      type: 'object',
      properties: {
        parent_id: { type: 'string', description: 'Parent page ID or database ID' },
        parent_type: { type: 'string', enum: ['page', 'database'], description: 'Whether parent is a page or database (default: "page")' },
        title: { type: 'string', description: 'Page title' },
        content: { type: 'string', description: 'Page content as markdown text. Each paragraph becomes a block.' },
        properties: { type: 'object', description: 'Database properties as key-value pairs (for database pages). Values depend on property type.' },
        icon: { type: 'string', description: 'Page icon emoji (e.g. "📝")' },
      },
      required: ['parent_id', 'title'],
    },
  },
  {
    name: 'notion_update_page',
    description: 'Update page properties (title, icon, database fields). For content changes, use notion_append_blocks or notion_delete_block.',
    input_schema: {
      type: 'object',
      properties: {
        page_id: { type: 'string', description: 'Page ID to update' },
        properties: { type: 'object', description: 'Properties to update as key-value pairs' },
        icon: { type: 'string', description: 'New icon emoji' },
        archived: { type: 'boolean', description: 'Set to true to archive/delete the page' },
      },
      required: ['page_id'],
    },
  },
  {
    name: 'notion_append_blocks',
    description: 'Append content blocks to a page. Add text, headings, lists, to-dos, code blocks, dividers, and more.',
    input_schema: {
      type: 'object',
      properties: {
        page_id: { type: 'string', description: 'Page ID to append to' },
        content: { type: 'string', description: 'Content as markdown. Supports: paragraphs, # headings, - bullets, 1. numbered, [] todos, ``` code blocks, --- dividers, > quotes.' },
      },
      required: ['page_id', 'content'],
    },
  },
  {
    name: 'notion_query_database',
    description: 'Query a Notion database with filters and sorts. Like a structured search within a specific database. Use for: filtering tasks, finding entries matching criteria, generating reports from databases.',
    input_schema: {
      type: 'object',
      properties: {
        database_id: { type: 'string', description: 'Database ID' },
        filter: { type: 'object', description: 'Notion filter object (optional). Example: {"property":"Status","select":{"equals":"In Progress"}}' },
        sorts: { type: 'array', items: { type: 'object' }, description: 'Sort rules. Example: [{"property":"Created","direction":"descending"}]' },
        max_results: { type: 'number', description: 'Max results (default: 50)' },
      },
      required: ['database_id'],
    },
  },
  {
    name: 'notion_get_database',
    description: 'Get database schema — property names, types, and options. Use before querying to understand the database structure.',
    input_schema: {
      type: 'object',
      properties: {
        database_id: { type: 'string', description: 'Database ID' },
      },
      required: ['database_id'],
    },
  },
  {
    name: 'notion_create_database',
    description: 'Create a new database (table) inside a page.',
    input_schema: {
      type: 'object',
      properties: {
        parent_page_id: { type: 'string', description: 'Parent page ID' },
        title: { type: 'string', description: 'Database title' },
        properties: {
          type: 'object',
          description: 'Database columns as {name: type}. Types: "title", "rich_text", "number", "select", "multi_select", "date", "checkbox", "url", "email", "phone_number". Example: {"Name":"title","Status":"select","Due Date":"date"}',
        },
      },
      required: ['parent_page_id', 'title', 'properties'],
    },
  },
];


export class NotionToolExecutor {
  constructor(config = {}) {
    this.token = config.token || process.env.NOTION_TOKEN || '';
    this.baseUrl = 'https://api.notion.com/v1';
  }

  async execute(toolName, input) {
    if (!this.token) {
      return { error: 'Notion token not configured. Set NOTION_TOKEN env var or add to config.' };
    }
    try {
      switch (toolName) {
        case 'notion_search': return await this.search(input);
        case 'notion_get_page': return await this.getPage(input);
        case 'notion_create_page': return await this.createPage(input);
        case 'notion_update_page': return await this.updatePage(input);
        case 'notion_append_blocks': return await this.appendBlocks(input);
        case 'notion_query_database': return await this.queryDatabase(input);
        case 'notion_get_database': return await this.getDatabase(input);
        case 'notion_create_database': return await this.createDatabase(input);
        default: return { error: `Unknown Notion tool: ${toolName}` };
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
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.code || `HTTP ${res.status}`);
    return data;
  }

  async search(input) {
    const { query, filter, max_results = 10 } = input;
    const body = { query, page_size: max_results };
    if (filter) body.filter = { value: filter, property: 'object' };
    const data = await this._api('POST', '/search', body);
    return {
      results: (data.results || []).map(r => ({
        id: r.id,
        type: r.object,
        title: this._extractTitle(r),
        url: r.url,
        created: r.created_time,
        edited: r.last_edited_time,
      })),
      count: data.results?.length || 0,
    };
  }

  async getPage(input) {
    const page = await this._api('GET', `/pages/${input.page_id}`);
    const blocks = await this._api('GET', `/blocks/${input.page_id}/children?page_size=100`);
    return {
      id: page.id,
      title: this._extractTitle(page),
      url: page.url,
      properties: this._simplifyProperties(page.properties),
      content: (blocks.results || []).map(b => this._blockToText(b)).filter(Boolean).join('\n'),
      created: page.created_time,
      edited: page.last_edited_time,
    };
  }

  async createPage(input) {
    const { parent_id, parent_type = 'page', title, content, properties, icon } = input;
    const body = {};

    // Parent
    if (parent_type === 'database') {
      body.parent = { database_id: parent_id };
    } else {
      body.parent = { page_id: parent_id };
    }

    // Properties
    if (parent_type === 'database' && properties) {
      body.properties = this._buildProperties(properties, title);
    } else {
      body.properties = { title: { title: [{ text: { content: title } }] } };
    }

    if (icon) body.icon = { type: 'emoji', emoji: icon };

    // Content blocks
    if (content) {
      body.children = this._markdownToBlocks(content);
    }

    const data = await this._api('POST', '/pages', body);
    return { success: true, id: data.id, url: data.url };
  }

  async updatePage(input) {
    const { page_id, properties, icon, archived } = input;
    const body = {};
    if (properties) body.properties = this._buildProperties(properties);
    if (icon) body.icon = { type: 'emoji', emoji: icon };
    if (archived !== undefined) body.archived = archived;
    const data = await this._api('PATCH', `/pages/${page_id}`, body);
    return { success: true, id: data.id, url: data.url };
  }

  async appendBlocks(input) {
    const blocks = this._markdownToBlocks(input.content);
    const data = await this._api('PATCH', `/blocks/${input.page_id}/children`, { children: blocks });
    return { success: true, blocks_added: data.results?.length || 0 };
  }

  async queryDatabase(input) {
    const { database_id, filter, sorts, max_results = 50 } = input;
    const body = { page_size: max_results };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    const data = await this._api('POST', `/databases/${database_id}/query`, body);
    return {
      results: (data.results || []).map(r => ({
        id: r.id,
        url: r.url,
        properties: this._simplifyProperties(r.properties),
        created: r.created_time,
      })),
      count: data.results?.length || 0,
      has_more: data.has_more,
    };
  }

  async getDatabase(input) {
    const data = await this._api('GET', `/databases/${input.database_id}`);
    const schema = {};
    for (const [name, prop] of Object.entries(data.properties || {})) {
      schema[name] = { type: prop.type };
      if (prop.select?.options) schema[name].options = prop.select.options.map(o => o.name);
      if (prop.multi_select?.options) schema[name].options = prop.multi_select.options.map(o => o.name);
    }
    return { id: data.id, title: this._extractTitle(data), url: data.url, schema };
  }

  async createDatabase(input) {
    const { parent_page_id, title, properties } = input;
    const dbProperties = {};
    for (const [name, type] of Object.entries(properties)) {
      if (type === 'title') dbProperties[name] = { title: {} };
      else if (type === 'rich_text') dbProperties[name] = { rich_text: {} };
      else if (type === 'number') dbProperties[name] = { number: {} };
      else if (type === 'select') dbProperties[name] = { select: {} };
      else if (type === 'multi_select') dbProperties[name] = { multi_select: {} };
      else if (type === 'date') dbProperties[name] = { date: {} };
      else if (type === 'checkbox') dbProperties[name] = { checkbox: {} };
      else if (type === 'url') dbProperties[name] = { url: {} };
      else if (type === 'email') dbProperties[name] = { email: {} };
      else if (type === 'phone_number') dbProperties[name] = { phone_number: {} };
      else dbProperties[name] = { rich_text: {} };
    }

    const data = await this._api('POST', '/databases', {
      parent: { page_id: parent_page_id },
      title: [{ text: { content: title } }],
      properties: dbProperties,
    });
    return { success: true, id: data.id, url: data.url };
  }

  // ═══ HELPERS ═══

  _extractTitle(obj) {
    if (!obj.properties) return '';
    for (const prop of Object.values(obj.properties)) {
      if (prop.type === 'title' && prop.title?.length) {
        return prop.title.map(t => t.plain_text).join('');
      }
    }
    // Database title
    if (obj.title?.length) return obj.title.map(t => t.plain_text).join('');
    return '';
  }

  _simplifyProperties(properties) {
    if (!properties) return {};
    const simplified = {};
    for (const [name, prop] of Object.entries(properties)) {
      switch (prop.type) {
        case 'title': simplified[name] = prop.title?.map(t => t.plain_text).join('') || ''; break;
        case 'rich_text': simplified[name] = prop.rich_text?.map(t => t.plain_text).join('') || ''; break;
        case 'number': simplified[name] = prop.number; break;
        case 'select': simplified[name] = prop.select?.name || null; break;
        case 'multi_select': simplified[name] = prop.multi_select?.map(s => s.name) || []; break;
        case 'date': simplified[name] = prop.date?.start || null; break;
        case 'checkbox': simplified[name] = prop.checkbox; break;
        case 'url': simplified[name] = prop.url; break;
        case 'email': simplified[name] = prop.email; break;
        case 'phone_number': simplified[name] = prop.phone_number; break;
        case 'people': simplified[name] = prop.people?.map(p => p.name || p.id) || []; break;
        case 'relation': simplified[name] = prop.relation?.map(r => r.id) || []; break;
        case 'formula': simplified[name] = prop.formula?.[prop.formula?.type]; break;
        case 'status': simplified[name] = prop.status?.name || null; break;
        default: simplified[name] = `[${prop.type}]`;
      }
    }
    return simplified;
  }

  _buildProperties(props, title) {
    const built = {};
    if (title) built.Name = { title: [{ text: { content: title } }] };
    for (const [key, val] of Object.entries(props || {})) {
      if (typeof val === 'string') built[key] = { rich_text: [{ text: { content: val } }] };
      else if (typeof val === 'number') built[key] = { number: val };
      else if (typeof val === 'boolean') built[key] = { checkbox: val };
      else if (val && val.select) built[key] = { select: { name: val.select } };
      else if (val && val.date) built[key] = { date: { start: val.date } };
      else if (Array.isArray(val)) built[key] = { multi_select: val.map(v => ({ name: v })) };
    }
    return built;
  }

  _markdownToBlocks(md) {
    const lines = md.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code block
      if (line.startsWith('```')) {
        const lang = line.slice(3).trim() || 'plain text';
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        blocks.push({ object: 'block', type: 'code', code: { rich_text: [{ text: { content: codeLines.join('\n') } }], language: lang } });
        i++;
        continue;
      }

      // Heading
      if (line.startsWith('### ')) { blocks.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: [{ text: { content: line.slice(4) } }] } }); }
      else if (line.startsWith('## ')) { blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ text: { content: line.slice(3) } }] } }); }
      else if (line.startsWith('# ')) { blocks.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: [{ text: { content: line.slice(2) } }] } }); }
      // Divider
      else if (line.trim() === '---') { blocks.push({ object: 'block', type: 'divider', divider: {} }); }
      // Quote
      else if (line.startsWith('> ')) { blocks.push({ object: 'block', type: 'quote', quote: { rich_text: [{ text: { content: line.slice(2) } }] } }); }
      // Todo
      else if (line.startsWith('- [x] ') || line.startsWith('- [ ] ')) { blocks.push({ object: 'block', type: 'to_do', to_do: { rich_text: [{ text: { content: line.slice(6) } }], checked: line.startsWith('- [x]') } }); }
      // Bullet
      else if (line.startsWith('- ') || line.startsWith('* ')) { blocks.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ text: { content: line.slice(2) } }] } }); }
      // Numbered
      else if (/^\d+\.\s/.test(line)) { blocks.push({ object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: [{ text: { content: line.replace(/^\d+\.\s/, '') } }] } }); }
      // Paragraph
      else if (line.trim()) { blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: line } }] } }); }

      i++;
    }
    return blocks;
  }

  _blockToText(block) {
    const rt = (b) => b?.rich_text?.map(t => t.plain_text).join('') || '';
    switch (block.type) {
      case 'paragraph': return rt(block.paragraph);
      case 'heading_1': return `# ${rt(block.heading_1)}`;
      case 'heading_2': return `## ${rt(block.heading_2)}`;
      case 'heading_3': return `### ${rt(block.heading_3)}`;
      case 'bulleted_list_item': return `- ${rt(block.bulleted_list_item)}`;
      case 'numbered_list_item': return `1. ${rt(block.numbered_list_item)}`;
      case 'to_do': return `- [${block.to_do?.checked ? 'x' : ' '}] ${rt(block.to_do)}`;
      case 'quote': return `> ${rt(block.quote)}`;
      case 'code': return `\`\`\`${block.code?.language || ''}\n${rt(block.code)}\n\`\`\``;
      case 'divider': return '---';
      default: return '';
    }
  }
}
