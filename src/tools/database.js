// ═══════════════════════════════════════════════════════════════
// Empli Gateway — Database Tools
// PostgreSQL, MySQL, SQLite — query, schema, CRUD, migrations
// Uses CLI tools (psql, mysql, sqlite3) — no npm dependencies
// ═══════════════════════════════════════════════════════════════

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const DATABASE_TOOL_DEFINITIONS = [

  // ═══ QUERY ═══
  {
    name: 'db_query',
    description: 'Execute a SQL query against a database (PostgreSQL, MySQL, or SQLite). Returns results as rows. Use for: reading data, running reports, checking records, aggregations, joins. For SELECT queries only — use db_execute for INSERT/UPDATE/DELETE.',
    input_schema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SQL SELECT query to execute' },
        database: { type: 'string', description: 'Database connection string or SQLite file path. Formats:\n- PostgreSQL: "postgresql://user:pass@host:5432/dbname"\n- MySQL: "mysql://user:pass@host:3306/dbname"\n- SQLite: "/path/to/database.db" or "sqlite:///path/to/db.sqlite"' },
        max_rows: { type: 'number', description: 'Maximum rows to return (default: 100)' },
      },
      required: ['sql', 'database'],
    },
  },
  {
    name: 'db_execute',
    description: 'Execute a SQL statement that modifies data (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP). Returns affected row count. CAUTION: confirm destructive operations (DROP, DELETE without WHERE, TRUNCATE) with user.',
    input_schema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SQL statement to execute' },
        database: { type: 'string', description: 'Database connection string or SQLite file path' },
      },
      required: ['sql', 'database'],
    },
  },

  // ═══ SCHEMA ═══
  {
    name: 'db_list_tables',
    description: 'List all tables in a database. Returns table names and row counts.',
    input_schema: {
      type: 'object',
      properties: {
        database: { type: 'string', description: 'Database connection string or SQLite file path' },
      },
      required: ['database'],
    },
  },
  {
    name: 'db_describe_table',
    description: 'Get the schema/structure of a table: column names, types, nullable, defaults, primary keys, foreign keys, indexes.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
        database: { type: 'string', description: 'Database connection string or SQLite file path' },
      },
      required: ['table', 'database'],
    },
  },
  {
    name: 'db_list_databases',
    description: 'List all databases on a PostgreSQL or MySQL server.',
    input_schema: {
      type: 'object',
      properties: {
        database: { type: 'string', description: 'Connection string (connects to the server, not a specific database)' },
      },
      required: ['database'],
    },
  },

  // ═══ CONVENIENCE ═══
  {
    name: 'db_insert',
    description: 'Insert one or more rows into a table. Builds the INSERT statement for you from key-value data.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
        rows: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of objects where keys are column names. Example: [{"name":"Alice","age":30},{"name":"Bob","age":25}]',
        },
        database: { type: 'string', description: 'Database connection string or SQLite file path' },
      },
      required: ['table', 'rows', 'database'],
    },
  },
  {
    name: 'db_update',
    description: 'Update rows in a table matching a WHERE condition.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
        set: { type: 'object', description: 'Column-value pairs to update. Example: {"status":"completed","updated_at":"2026-01-15"}' },
        where: { type: 'string', description: 'WHERE clause (without the WHERE keyword). Example: "id = 42" or "status = \'pending\' AND created_at < \'2026-01-01\'"' },
        database: { type: 'string', description: 'Database connection string or SQLite file path' },
      },
      required: ['table', 'set', 'where', 'database'],
    },
  },
  {
    name: 'db_delete',
    description: 'Delete rows from a table matching a WHERE condition. CAUTION: always requires a WHERE clause — confirm with user before executing.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
        where: { type: 'string', description: 'WHERE clause (required, no DELETE without WHERE). Example: "id = 42"' },
        database: { type: 'string', description: 'Database connection string or SQLite file path' },
      },
      required: ['table', 'where', 'database'],
    },
  },

  // ═══ EXPORT / IMPORT ═══
  {
    name: 'db_export',
    description: 'Export query results or a full table to CSV, JSON, or SQL dump file.',
    input_schema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Table name or SQL query to export' },
        database: { type: 'string', description: 'Database connection string or SQLite file path' },
        format: { type: 'string', enum: ['csv', 'json', 'sql'], description: 'Export format (default: "csv")' },
        output_path: { type: 'string', description: 'Local file path to save export' },
      },
      required: ['source', 'database', 'output_path'],
    },
  },
  {
    name: 'db_import',
    description: 'Import data from a CSV or SQL file into a database.',
    input_schema: {
      type: 'object',
      properties: {
        input_path: { type: 'string', description: 'Path to CSV or SQL file' },
        table: { type: 'string', description: 'Target table (for CSV import)' },
        database: { type: 'string', description: 'Database connection string or SQLite file path' },
      },
      required: ['input_path', 'database'],
    },
  },

  // ═══ ADMIN ═══
  {
    name: 'db_create_table',
    description: 'Create a new table with specified columns and types.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
        columns: {
          type: 'object',
          description: 'Column definitions as {name: type}. Types: "TEXT", "INTEGER", "REAL", "BOOLEAN", "TIMESTAMP", "SERIAL PRIMARY KEY", "VARCHAR(255)", "JSONB", etc. Example: {"id":"SERIAL PRIMARY KEY","name":"VARCHAR(255) NOT NULL","email":"VARCHAR(255) UNIQUE","created_at":"TIMESTAMP DEFAULT NOW()"}',
        },
        database: { type: 'string', description: 'Database connection string or SQLite file path' },
        if_not_exists: { type: 'boolean', description: 'Add IF NOT EXISTS (default: true)' },
      },
      required: ['table', 'columns', 'database'],
    },
  },
  {
    name: 'db_table_stats',
    description: 'Get statistics about a table: row count, disk size, index sizes, last vacuum/analyze.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
        database: { type: 'string', description: 'Database connection string or SQLite file path' },
      },
      required: ['table', 'database'],
    },
  },
];


// ─────────────────────────────────────────────
// DATABASE TOOL EXECUTOR
// ─────────────────────────────────────────────

export class DatabaseToolExecutor {
  constructor(config = {}) {
    this.config = config;
    this.defaultDb = config.defaultDatabase || '';
  }

  async execute(toolName, input) {
    // Allow default database
    if (!input.database && this.defaultDb) input.database = this.defaultDb;

    try {
      switch (toolName) {
        case 'db_query': return this.query(input);
        case 'db_execute': return this.exec(input);
        case 'db_list_tables': return this.listTables(input);
        case 'db_describe_table': return this.describeTable(input);
        case 'db_list_databases': return this.listDatabases(input);
        case 'db_insert': return this.insert(input);
        case 'db_update': return this.update(input);
        case 'db_delete': return this.delete(input);
        case 'db_export': return this.exportData(input);
        case 'db_import': return this.importData(input);
        case 'db_create_table': return this.createTable(input);
        case 'db_table_stats': return this.tableStats(input);
        default: return { error: `Unknown database tool: ${toolName}` };
      }
    } catch (err) {
      return { error: `${toolName} failed: ${err.message}` };
    }
  }

  // ═══ CORE ═══

  query(input) {
    const { sql, database, max_rows = 100 } = input;
    const db = this._parseConn(database);
    const limited = sql.trim().replace(/;?\s*$/, '') + ` LIMIT ${max_rows}`;

    const result = this._run(db, limited);
    return this._parseResult(result, db.type);
  }

  exec(input) {
    const { sql, database } = input;
    const db = this._parseConn(database);
    const result = this._run(db, sql);
    return { output: result.trim() || 'Statement executed successfully', database: db.type };
  }

  // ═══ SCHEMA ═══

  listTables(input) {
    const db = this._parseConn(input.database);
    let sql;
    switch (db.type) {
      case 'postgresql':
        sql = "SELECT tablename AS name, schemaname AS schema FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY tablename";
        break;
      case 'mysql':
        sql = 'SHOW TABLES';
        break;
      case 'sqlite':
        sql = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
        break;
    }
    const result = this._run(db, sql);
    return this._parseResult(result, db.type);
  }

  describeTable(input) {
    const { table, database } = input;
    const db = this._parseConn(database);
    let sql;
    switch (db.type) {
      case 'postgresql':
        sql = `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_name = '${this._esc(table)}' ORDER BY ordinal_position`;
        break;
      case 'mysql':
        sql = `DESCRIBE ${table}`;
        break;
      case 'sqlite':
        sql = `PRAGMA table_info(${table})`;
        break;
    }
    const schema = this._run(db, sql);

    // Also get indexes
    let indexes = '';
    try {
      switch (db.type) {
        case 'postgresql':
          indexes = this._run(db, `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '${this._esc(table)}'`);
          break;
        case 'mysql':
          indexes = this._run(db, `SHOW INDEX FROM ${table}`);
          break;
        case 'sqlite':
          indexes = this._run(db, `PRAGMA index_list(${table})`);
          break;
      }
    } catch (e) { }

    const result = this._parseResult(schema, db.type);
    if (indexes) result.indexes = this._parseResult(indexes, db.type);
    return result;
  }

  listDatabases(input) {
    const db = this._parseConn(input.database);
    let sql;
    switch (db.type) {
      case 'postgresql': sql = 'SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname'; break;
      case 'mysql': sql = 'SHOW DATABASES'; break;
      case 'sqlite': return { databases: [{ name: path.basename(db.path) }] };
    }
    const result = this._run(db, sql);
    return this._parseResult(result, db.type);
  }

  // ═══ CONVENIENCE ═══

  insert(input) {
    const { table, rows, database } = input;
    if (!rows?.length) return { error: 'No rows to insert' };

    const db = this._parseConn(database);
    const columns = Object.keys(rows[0]);
    const colList = columns.map(c => `"${c}"`).join(', ');

    const valueRows = rows.map(row => {
      const vals = columns.map(c => this._sqlVal(row[c]));
      return `(${vals.join(', ')})`;
    });

    const sql = `INSERT INTO "${table}" (${colList}) VALUES ${valueRows.join(', ')}`;
    const result = this._run(db, sql);
    return { success: true, inserted: rows.length, output: result.trim() || 'Rows inserted' };
  }

  update(input) {
    const { table, set, where, database } = input;
    const db = this._parseConn(database);

    const setClauses = Object.entries(set).map(([col, val]) => `"${col}" = ${this._sqlVal(val)}`).join(', ');
    const sql = `UPDATE "${table}" SET ${setClauses} WHERE ${where}`;
    const result = this._run(db, sql);
    return { success: true, output: result.trim() || 'Rows updated' };
  }

  delete(input) {
    const { table, where, database } = input;
    if (!where || where.trim() === '') return { error: 'WHERE clause is required for DELETE. Refusing to delete all rows.' };

    const db = this._parseConn(database);
    const sql = `DELETE FROM "${table}" WHERE ${where}`;
    const result = this._run(db, sql);
    return { success: true, output: result.trim() || 'Rows deleted' };
  }

  // ═══ EXPORT / IMPORT ═══

  exportData(input) {
    const { source, database, format = 'csv', output_path } = input;
    const db = this._parseConn(database);
    const resolved = this._resolvePath(output_path);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });

    const isQuery = source.trim().toUpperCase().startsWith('SELECT');
    const query = isQuery ? source : `SELECT * FROM "${source}"`;

    switch (format) {
      case 'csv': {
        let cmd;
        switch (db.type) {
          case 'postgresql':
            cmd = `psql "${db.connStr}" -c "COPY (${query.replace(/"/g, '\\"')}) TO STDOUT WITH CSV HEADER" > "${resolved}"`;
            break;
          case 'mysql':
            cmd = `mysql ${this._mysqlArgs(db)} -e "${query.replace(/"/g, '\\"')}" --batch > "${resolved}"`;
            break;
          case 'sqlite':
            cmd = `sqlite3 -header -csv "${db.path}" "${query.replace(/"/g, '\\"')}" > "${resolved}"`;
            break;
        }
        execSync(cmd, { encoding: 'utf-8', timeout: 60000 });
        break;
      }
      case 'json': {
        let result;
        switch (db.type) {
          case 'postgresql':
            result = this._run(db, `SELECT json_agg(t) FROM (${query}) t`);
            break;
          default:
            result = this._run(db, query);
            break;
        }
        fs.writeFileSync(resolved, result, 'utf-8');
        break;
      }
      case 'sql': {
        let cmd;
        switch (db.type) {
          case 'postgresql':
            cmd = isQuery
              ? `psql "${db.connStr}" -c "COPY (${query.replace(/"/g, '\\"')}) TO STDOUT" > "${resolved}"`
              : `pg_dump "${db.connStr}" -t "${source}" > "${resolved}"`;
            break;
          case 'mysql':
            cmd = `mysqldump ${this._mysqlArgs(db)} ${isQuery ? '' : source} > "${resolved}"`;
            break;
          case 'sqlite':
            cmd = `sqlite3 "${db.path}" ".dump ${isQuery ? '' : source}" > "${resolved}"`;
            break;
        }
        execSync(cmd, { encoding: 'utf-8', timeout: 120000 });
        break;
      }
    }

    const stat = fs.statSync(resolved);
    return { success: true, path: resolved, size: `${Math.round(stat.size / 1024)}KB`, format };
  }

  importData(input) {
    const { input_path, table, database } = input;
    const db = this._parseConn(database);
    const resolved = this._resolvePath(input_path);
    const ext = path.extname(resolved).toLowerCase();

    if (ext === '.sql') {
      let cmd;
      switch (db.type) {
        case 'postgresql': cmd = `psql "${db.connStr}" < "${resolved}"`; break;
        case 'mysql': cmd = `mysql ${this._mysqlArgs(db)} < "${resolved}"`; break;
        case 'sqlite': cmd = `sqlite3 "${db.path}" < "${resolved}"`; break;
      }
      const result = execSync(cmd, { encoding: 'utf-8', timeout: 120000 });
      return { success: true, output: result.trim() || 'SQL file imported' };
    }

    if (ext === '.csv' && table) {
      let cmd;
      switch (db.type) {
        case 'postgresql':
          cmd = `psql "${db.connStr}" -c "\\COPY ${table} FROM '${resolved}' WITH CSV HEADER"`;
          break;
        case 'mysql':
          cmd = `mysqlimport ${this._mysqlArgs(db)} --local --ignore-lines=1 --fields-terminated-by=, ${table} "${resolved}"`;
          break;
        case 'sqlite':
          cmd = `sqlite3 "${db.path}" ".mode csv" ".import ${resolved} ${table}"`;
          break;
      }
      const result = execSync(cmd, { encoding: 'utf-8', timeout: 120000 });
      return { success: true, output: result.trim() || 'CSV imported' };
    }

    return { error: 'Unsupported import format. Use .sql or .csv (with table name).' };
  }

  // ═══ ADMIN ═══

  createTable(input) {
    const { table, columns, database, if_not_exists = true } = input;
    const db = this._parseConn(database);

    const colDefs = Object.entries(columns).map(([name, type]) => `"${name}" ${type}`).join(', ');
    const ifne = if_not_exists ? 'IF NOT EXISTS ' : '';
    const sql = `CREATE TABLE ${ifne}"${table}" (${colDefs})`;

    const result = this._run(db, sql);
    return { success: true, table, output: result.trim() || 'Table created' };
  }

  tableStats(input) {
    const { table, database } = input;
    const db = this._parseConn(database);

    const stats = {};

    // Row count
    try {
      const countResult = this._run(db, `SELECT COUNT(*) as count FROM "${table}"`);
      const parsed = this._parseResult(countResult, db.type);
      stats.row_count = parsed.rows?.[0]?.count || parsed.rows?.[0] || countResult.trim();
    } catch (e) {
      stats.row_count = 'unknown';
    }

    // Size (PostgreSQL specific)
    if (db.type === 'postgresql') {
      try {
        const sizeResult = this._run(db, `SELECT pg_size_pretty(pg_total_relation_size('"${table}"')) as total_size, pg_size_pretty(pg_relation_size('"${table}"')) as table_size, pg_size_pretty(pg_indexes_size('"${table}"')) as index_size`);
        const parsed = this._parseResult(sizeResult, db.type);
        if (parsed.rows?.[0]) Object.assign(stats, parsed.rows[0]);
      } catch (e) { }
    }

    // SQLite: file size
    if (db.type === 'sqlite') {
      try {
        const fileStat = fs.statSync(db.path);
        stats.file_size = `${Math.round(fileStat.size / 1024)}KB`;
      } catch (e) { }
    }

    return stats;
  }

  // ═══════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════

  _parseConn(connStr) {
    if (!connStr) throw new Error('Database connection string required');

    // SQLite: file path or sqlite:// prefix
    if (connStr.startsWith('sqlite://') || connStr.startsWith('sqlite:///')) {
      return { type: 'sqlite', path: connStr.replace(/^sqlite:\/\/\/?/, '') };
    }
    if (connStr.endsWith('.db') || connStr.endsWith('.sqlite') || connStr.endsWith('.sqlite3')) {
      return { type: 'sqlite', path: this._resolvePath(connStr) };
    }

    // PostgreSQL
    if (connStr.startsWith('postgresql://') || connStr.startsWith('postgres://')) {
      return { type: 'postgresql', connStr };
    }

    // MySQL
    if (connStr.startsWith('mysql://')) {
      const url = new URL(connStr);
      return {
        type: 'mysql',
        connStr,
        host: url.hostname,
        port: url.port || '3306',
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1),
      };
    }

    // Default: assume SQLite file
    return { type: 'sqlite', path: this._resolvePath(connStr) };
  }

  _run(db, sql) {
    const timeout = 30000;
    const cleanSql = sql.replace(/;?\s*$/, '').trim();

    switch (db.type) {
      case 'sqlite': {
        const cmd = `sqlite3 -header -column "${db.path}" "${cleanSql.replace(/"/g, '\\"')};"`;
        return execSync(cmd, { encoding: 'utf-8', timeout, maxBuffer: 1024 * 1024 * 50 });
      }
      case 'postgresql': {
        const cmd = `psql "${db.connStr}" -c "${cleanSql.replace(/"/g, '\\"')}" --no-align --field-separator='|' --pset footer=off`;
        return execSync(cmd, { encoding: 'utf-8', timeout, maxBuffer: 1024 * 1024 * 50 });
      }
      case 'mysql': {
        const cmd = `mysql ${this._mysqlArgs(db)} -e "${cleanSql.replace(/"/g, '\\"')}" --batch --table`;
        return execSync(cmd, { encoding: 'utf-8', timeout, maxBuffer: 1024 * 1024 * 50 });
      }
      default:
        throw new Error(`Unsupported database type: ${db.type}`);
    }
  }

  _mysqlArgs(db) {
    let args = '';
    if (db.host) args += ` -h ${db.host}`;
    if (db.port) args += ` -P ${db.port}`;
    if (db.user) args += ` -u ${db.user}`;
    if (db.password) args += ` -p'${db.password}'`;
    if (db.database) args += ` ${db.database}`;
    return args;
  }

  _parseResult(raw, dbType) {
    if (!raw || !raw.trim()) return { rows: [], columns: [], count: 0 };

    const lines = raw.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return { rows: [], columns: [], count: 0 };

    // PostgreSQL pipe-delimited
    if (dbType === 'postgresql') {
      const headers = lines[0].split('|').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const vals = line.split('|').map(v => v.trim());
        const row = {};
        headers.forEach((h, i) => { row[h] = vals[i] || null; });
        return row;
      });
      return { columns: headers, rows, count: rows.length };
    }

    // MySQL/SQLite table format — try tab-delimited
    if (lines[0].includes('\t')) {
      const headers = lines[0].split('\t').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const vals = line.split('\t').map(v => v.trim());
        const row = {};
        headers.forEach((h, i) => { row[h] = vals[i] || null; });
        return row;
      });
      return { columns: headers, rows, count: rows.length };
    }

    // Fallback: return raw
    return { raw: raw.trim(), count: lines.length };
  }

  _sqlVal(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    return `'${String(val).replace(/'/g, "''")}'`;
  }

  _esc(str) {
    return str.replace(/'/g, "''");
  }

  _resolvePath(p) {
    if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
    if (path.isAbsolute(p)) return p;
    return path.join(os.homedir(), p);
  }
}
