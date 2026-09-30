import archiver from 'archiver';
import unzipper from 'unzipper';
import { PassThrough } from 'stream';
import { executeQuery } from '../config/db.js';
import { listTables, getTableFullInfo } from './scyllaService.js';

/* ============================================================
   Export / Backup
   ============================================================ */

export async function streamKeyspaceBackup(keyspace) {
  const tables = await listTables(keyspace);
  if (tables.length === 0) {
    throw new Error(`هیچ جدولی در Keyspace «${keyspace}» یافت نشد`);
  }

  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = new PassThrough();

  archive.pipe(output);
  archive.on('error', (err) => output.destroy(err));

  const schemaParts = [];
  const missingSchema = [];

  for (const table of tables) {
    try {
      const info = await getTableFullInfo(keyspace, table);
      if (!info.cql || info.cql.trim() === '') {
        missingSchema.push(table);
        schemaParts.push(`-- ⚠️ کوئری CREATE TABLE برای ${table} یافت نشد`);
        continue;
      }
      schemaParts.push(`-- Table: ${table}`);
      schemaParts.push(info.cql);
      if (info.indexCqls && info.indexCqls.length > 0) {
        schemaParts.push(...info.indexCqls);
      }
      schemaParts.push('');
    } catch (e) {
      missingSchema.push(table);
      schemaParts.push(`-- ⚠️ خطا در دریافت schema جدول ${table}: ${e.message}`);
    }
  }
  archive.append(schemaParts.join('\n'), { name: 'schema.cql' });

  for (const table of tables) {
    try {
      const csv = await exportTableToCsv(keyspace, table);
      archive.append(csv, { name: `data/${table}.csv` });
    } catch (e) {
      archive.append(`-- خطا در استخراج داده: ${e.message}\n`, {
        name: `data/${table}.error.txt`,
      });
    }
  }

  const meta = {
    exportedAt: new Date().toISOString(),
    sourceKeyspace: keyspace,
    tables,
    missingSchema,
    tool: 'scylla-manager',
    version: '1.2.0',
  };
  archive.append(JSON.stringify(meta, null, 2), { name: 'meta.json' });

  archive.finalize();
  return output;
}

async function exportTableToCsv(keyspace, table) {
  const result = await executeQuery(
    `SELECT * FROM ${quoteId(keyspace)}.${quoteId(table)}`
  );
  const rows = result.rows || [];
  const columns = result.columns || [];

  if (rows.length === 0 || columns.length === 0) {
    return '';
  }

  const header = columns.map((c) => csvEscape(c.name)).join(',');
  const lines = [header];

  for (const row of rows) {
    const line = columns
      .map((c) => csvEscape(formatCsvValue(row[c.name])))
      .join(',');
    lines.push(line);
  }

  return lines.join('\n');
}

function formatCsvValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return '0x' + value.toString('hex');
  if (typeof value === 'object') {
    try {
      return String(value);
    } catch {
      return JSON.stringify(value);
    }
  }
  return String(value);
}

function csvEscape(str) {
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/* ============================================================
   Import / Restore
   ============================================================ */

async function ensureKeyspace(keyspace) {
  const cql = `CREATE KEYSPACE IF NOT EXISTS ${quoteId(keyspace)}
    WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}`;
  await executeQuery(cql);
}

export async function restoreKeyspaceFromZip(zipBuffer, targetKeyspace, options = {}) {
  const { skipSchema = false, skipData = false, truncateFirst = false } = options;

  const directory = await unzipper.Open.buffer(zipBuffer);
  const files = directory.files;

  const schemaFile = files.find((f) => f.path === 'schema.cql');
  const metaFile = files.find((f) => f.path === 'meta.json');
  const dataFiles = files.filter(
    (f) => f.path.startsWith('data/') && f.path.endsWith('.csv')
  );

  const result = {
    schemaExecuted: false,
    tablesRestored: [],
    errors: [],
    warnings: [],
    createdTables: [],
    skippedTables: [],
    keyspaceCreated: false,
    schemaLog: [],
    meta: null,
    schemaContent: null,
  };

  // خواندن meta.json
  if (metaFile) {
    try {
      result.meta = JSON.parse((await metaFile.buffer()).toString('utf-8'));
    } catch { /* ignore */ }
  }

  // خواندن schema.cql (برای نمایش به کاربر)
  if (schemaFile) {
    try {
      result.schemaContent = (await schemaFile.buffer()).toString('utf-8');
    } catch { /* ignore */ }
  }

  // ۱. ساخت Keyspace
  try {
    await ensureKeyspace(targetKeyspace);
    result.keyspaceCreated = true;
  } catch (e) {
    result.errors.push(`خطا در ساخت Keyspace: ${e.message}`);
    return result;
  }

  // ۲. اجرای schema
  const createdTableNames = new Set();
  if (!skipSchema && schemaFile) {
    try {
      const schemaContent = result.schemaContent;
      const schemaResult = await executeSchemaCql(schemaContent, targetKeyspace);
      result.schemaExecuted = true;
      result.createdTables = schemaResult.createdTables;
      result.schemaLog = schemaResult.executionLog;
      result.errors.push(...schemaResult.errors);
      schemaResult.createdTables.forEach((t) => createdTableNames.add(t));
    } catch (e) {
      result.errors.push(`خطا در اجرای schema: ${e.message}`);
    }
  } else if (skipSchema) {
    try {
      const existing = await executeQuery(
        `SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?`,
        [targetKeyspace]
      );
      existing.rows.forEach((r) => createdTableNames.add(r.table_name));
    } catch { /* ignore */ }
  }

  // ۳. صبر برای propagation کامل (tables + columns)
  if (createdTableNames.size > 0) {
    await waitForTablesWithColumns(targetKeyspace, [...createdTableNames], 30000);
  }

  // ۴. بررسی سلامت جداول در فایل داده
  for (const file of dataFiles) {
    const tableName = file.path.replace('data/', '').replace('.csv', '');
    const exists = await tableExistsWithColumns(targetKeyspace, tableName);
    if (!exists) {
      result.warnings.push(
        `جدول "${tableName}" در فایل داده وجود دارد اما در دیتابیس یافت نشد — احتمالاً CREATE TABLE آن در بک‌آپ نبوده است`
      );
    }
  }

  // ۵. ایمپورت داده
  if (!skipData) {
    for (const file of dataFiles) {
      const tableName = file.path.replace('data/', '').replace('.csv', '');

      // بررسی نهایی وجود جدول
      const exists = await tableExistsWithColumns(targetKeyspace, tableName);
      if (!exists) {
        result.skippedTables.push({
          table: tableName,
          reason: 'جدول در دیتابیس وجود ندارد',
        });
        continue;
      }

      try {
        if (truncateFirst) {
          await executeQuery(
            `TRUNCATE ${quoteId(targetKeyspace)}.${quoteId(tableName)}`
          );
        }

        const csvContent = (await file.buffer()).toString('utf-8');
        const importResult = await importCsvToTable(targetKeyspace, tableName, csvContent);

        result.tablesRestored.push({
          table: tableName,
          rows: importResult.imported,
          skipped: importResult.skipped,
        });

        if (importResult.errors.length > 0) {
          importResult.errors.slice(0, 5).forEach((e) =>
            result.errors.push(`جدول ${tableName}: ${e}`)
          );
        }
      } catch (e) {
        result.errors.push(`خطا در ریستور جدول ${tableName}: ${e.message}`);
        result.skippedTables.push({ table: tableName, reason: e.message });
      }
    }
  }

  return result;
}

/**
 * بررسی وجود جدول به همراه ستون‌های آن
 */
async function tableExistsWithColumns(keyspace, table) {
  try {
    const res = await executeQuery(
      `SELECT column_name FROM system_schema.columns
       WHERE keyspace_name = ? AND table_name = ? LIMIT 1`,
      [keyspace, table]
    );
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

function replaceKeyspaceInSchema(cql, newKeyspace) {
  const patterns = [
    /\b(TABLE)\s+(IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\./gi,
    /\b(ON)\s+([a-z_][a-z0-9_]*)\s*\./gi,
    /\b(FROM|INTO|UPDATE)\s+([a-z_][a-z0-9_]*)\s*\./gi,
    /\b(ALTER|DROP)\s+(TABLE|KEYSPACE)\s+(IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\./gi,
  ];

  let result = cql;

  for (const pattern of patterns) {
    result = result.replace(pattern, (match) => {
      const keyspaceMatch = match.match(/([a-z_][a-z0-9_]*)\s*\.\s*$/i);
      if (!keyspaceMatch) return match;
      const oldKs = keyspaceMatch[1];
      if (oldKs.toLowerCase() === newKeyspace.toLowerCase()) return match;
      return match.replace(new RegExp(`\\b${oldKs}\\s*\\.`), `${newKeyspace}.`);
    });
  }

  return result;
}

/**
 * اجرای schema.cql — ابتدا جدول‌ها، سپس ایندکس‌ها با retry
 */
async function executeSchemaCql(schemaContent, targetKeyspace) {
  const statements = splitCqlStatements(schemaContent);
  const createdTables = [];
  const errors = [];
  const executionLog = [];

  const tableStatements = [];
  const indexStatements = [];
  const otherStatements = [];

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;

    const finalCql = replaceKeyspaceInSchema(trimmed, targetKeyspace);

    if (/^\s*CREATE\s+TABLE\b/i.test(finalCql)) {
      tableStatements.push(finalCql);
    } else if (/^\s*CREATE\s+(?:CUSTOM\s+)?INDEX\b/i.test(finalCql)) {
      indexStatements.push(finalCql);
    } else {
      otherStatements.push(finalCql);
    }
  }

  // === مرحله ۱: CREATE TABLE ===
  for (const cql of tableStatements) {
    const match = cql.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/i
    );
    const tableName = match?.[2] || '?';

    try {
      await executeQuery(cql);
      if (!createdTables.includes(tableName)) createdTables.push(tableName);
      executionLog.push({
        type: 'table',
        name: tableName,
        status: 'created',
        message: 'جدول با موفقیت ساخته شد',
      });
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('already exist') || msg.includes('already exists')) {
        if (!createdTables.includes(tableName)) createdTables.push(tableName);
        executionLog.push({
          type: 'table',
          name: tableName,
          status: 'exists',
          message: 'جدول از قبل وجود داشت',
        });
      } else {
        errors.push(`ساخت جدول "${tableName}": ${msg}`);
        executionLog.push({
          type: 'table',
          name: tableName,
          status: 'error',
          message: msg,
          cql: cql.substring(0, 200),
        });
      }
    }
  }

  // === انتظار برای propagate جداول ===
  if (createdTables.length > 0) {
    await waitForTablesWithColumns(targetKeyspace, createdTables, 30000);
  }

  // === مرحله ۲: CREATE INDEX با retry ===
  for (const cql of indexStatements) {
    const match = cql.match(/CREATE\s+(?:CUSTOM\s+)?INDEX\s+([a-z_][a-z0-9_]*)?/i);
    const indexName = match?.[1] || '(auto)';
    let success = false;
    let lastError = null;

    for (let attempt = 1; attempt <= 5 && !success; attempt++) {
      try {
        await executeQuery(cql);
        success = true;
        executionLog.push({
          type: 'index',
          name: indexName,
          status: 'created',
          message: 'ایندکس با موفقیت ساخته شد',
        });
      } catch (e) {
        lastError = e.message || '';
        if (lastError.includes('already exist') || lastError.includes('already exists')) {
          success = true;
          executionLog.push({
            type: 'index',
            name: indexName,
            status: 'exists',
            message: 'ایندکس از قبل وجود داشت',
          });
        } else if (attempt < 5) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    if (!success) {
      errors.push(`ساخت ایندکس "${indexName}": ${lastError}`);
      executionLog.push({
        type: 'index',
        name: indexName,
        status: 'error',
        message: lastError,
        cql: cql.substring(0, 200),
      });
    }
  }

  // === مرحله ۳: سایر دستورات ===
  for (const cql of otherStatements) {
    try {
      await executeQuery(cql);
      executionLog.push({
        type: 'other',
        name: cql.substring(0, 60) + (cql.length > 60 ? '...' : ''),
        status: 'ok',
        message: 'با موفقیت اجرا شد',
      });
    } catch (e) {
      errors.push(`اجرای دستور: ${e.message}`);
      executionLog.push({
        type: 'other',
        name: cql.substring(0, 60),
        status: 'error',
        message: e.message,
      });
    }
  }

  return { createdTables, errors, executionLog };
}

/**
 * انتظار برای ظهور جداول و ستون‌هایشان در system_schema
 */
async function waitForTablesWithColumns(keyspace, tableNames, timeoutMs = 30000) {
  const start = Date.now();
  const remaining = new Set(tableNames);

  while (Date.now() - start < timeoutMs && remaining.size > 0) {
    try {
      const res = await executeQuery(
        `SELECT table_name, column_name FROM system_schema.columns
         WHERE keyspace_name = ?`,
        [keyspace]
      );
      const tablesWithColumns = new Set();
      for (const row of res.rows) {
        if (row.column_name) tablesWithColumns.add(row.table_name);
      }
      for (const t of [...remaining]) {
        if (tablesWithColumns.has(t)) remaining.delete(t);
      }
      if (remaining.size === 0) return true;
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (remaining.size > 0) {
    console.warn(
      `⚠️ جداول زیر پس از ${timeoutMs}ms در system_schema ظاهر نشدند: ${[...remaining].join(', ')}`
    );
  }
  return remaining.size === 0;
}

function splitCqlStatements(text) {
  const statements = [];
  let current = '';
  let inString = false;
  let inComment = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inComment) {
      current += ch;
      if (ch === '\n') inComment = false;
      continue;
    }

    if (!inString && ch === '-' && next === '-') {
      inComment = true;
      current += ch;
      continue;
    }

    if (ch === "'" && !inComment) {
      inString = !inString;
      current += ch;
      continue;
    }

    if (ch === ';' && !inString) {
      statements.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) statements.push(current);
  return statements;
}

/**
 * ایمپورت CSV با retry برای schema lookup
 */
async function importCsvToTable(keyspace, table, csvContent) {
  const lines = csvContent.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { imported: 0, skipped: 0, errors: [] };

  // ✅ retry برای گرفتن ساختار ستون‌ها
  let schemaRes = { rows: [] };
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      schemaRes = await executeQuery(
        `SELECT column_name, type FROM system_schema.columns
         WHERE keyspace_name = ? AND table_name = ?`,
        [keyspace, table]
      );
      if (schemaRes.rows.length > 0) break;
    } catch (e) {
      console.warn(`⚠️ خطا در lookup schema (تلاش ${attempt}): ${e.message}`);
    }
    if (attempt < 10) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  if (schemaRes.rows.length === 0) {
    throw new Error(
      `ساختار جدول ${keyspace}.${table} در system_schema یافت نشد — جدول ساخته نشده یا هنوز propagate نشده است`
    );
  }

  const columnTypes = {};
  schemaRes.rows.forEach((r) => {
    columnTypes[r.column_name] = r.type;
  });

  const headers = parseCsvLine(lines[0]);
  if (headers.length === 0) return { imported: 0, skipped: 0, errors: [] };

  const colList = headers.map((h) => quoteId(h)).join(', ');
  const placeholders = headers.map(() => '?').join(', ');
  const cql = `INSERT INTO ${quoteId(keyspace)}.${quoteId(table)}
    (${colList}) VALUES (${placeholders})`;

  let imported = 0;
  let skipped = 0;
  const errors = [];
  const BATCH_SIZE = 50;

  for (let i = 1; i < lines.length; i += BATCH_SIZE) {
    const batch = lines.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (line) => {
      try {
        const rawValues = parseCsvLine(line);
        const typedValues = rawValues.map((v, idx) =>
          convertCsvValue(v, columnTypes[headers[idx]] || 'text', headers[idx])
        );
        await executeQuery(cql, typedValues);
        imported++;
      } catch (e) {
        skipped++;
        if (errors.length < 10) {
          errors.push(e.message);
        }
      }
    });
    await Promise.all(promises);
  }

  return { imported, skipped, errors };
}

function convertCsvValue(rawValue, cqlType, columnName) {
  if (rawValue === '' || rawValue === undefined || rawValue === null) {
    const t = String(cqlType).toLowerCase().trim();
    if (['text', 'varchar', 'ascii'].includes(t)) return '';
    return null;
  }

  const type = String(cqlType).toLowerCase().trim();
  const value = String(rawValue);

  if (type === 'uuid' || type === 'timeuuid') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error(
        `UUID نامعتبر در ستون "${columnName}": "${value.substring(0, 50)}"`
      );
    }
    return value;
  }

  if (type === 'timestamp') {
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      throw new Error(`Timestamp نامعتبر در ستون "${columnName}": "${value}"`);
    }
    return d;
  }

  if (type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        throw new Error(`Date نامعتبر در ستون "${columnName}": "${value}"`);
      }
      return d.toISOString().split('T')[0];
    }
    return value;
  }

  if (type === 'time') return value;

  if (['tinyint', 'smallint', 'int'].includes(type)) {
    const n = parseInt(value, 10);
    if (isNaN(n)) {
      throw new Error(`عدد صحیح نامعتبر در ستون "${columnName}": "${value}"`);
    }
    return n;
  }

  if (type === 'bigint' || type === 'counter') {
    if (/^-?\d+$/.test(value)) {
      const num = Number(value);
      if (Number.isSafeInteger(num)) return num;
      return BigInt(value);
    }
    throw new Error(`عدد صحیح بزرگ نامعتبر در ستون "${columnName}": "${value}"`);
  }

  if (type === 'varint') return value;

  if (type === 'float' || type === 'double') {
    const n = parseFloat(value);
    if (isNaN(n)) {
      throw new Error(`عدد اعشاری نامعتبر در ستون "${columnName}": "${value}"`);
    }
    return n;
  }

  if (type === 'decimal') return value;

  if (type === 'boolean' || type === 'bool') {
    const lower = value.toLowerCase().trim();
    if (['true', '1', 't', 'yes'].includes(lower)) return true;
    if (['false', '0', 'f', 'no'].includes(lower)) return false;
    throw new Error(`Boolean نامعتبر در ستون "${columnName}": "${value}"`);
  }

  if (type === 'blob') {
    if (value.startsWith('0x')) {
      return Buffer.from(value.slice(2), 'hex');
    }
    return Buffer.from(value, 'binary');
  }

  if (type.startsWith('list<') || type.startsWith('set<')) {
    const innerType = type.slice(type.indexOf('<') + 1, -1);
    try {
      const arr = JSON.parse(value);
      if (!Array.isArray(arr)) return [convertCsvValue(arr, innerType, columnName)];
      return arr.map((v) => convertCsvValue(String(v), innerType, columnName));
    } catch {
      return [convertCsvValue(value, innerType, columnName)];
    }
  }

  if (type.startsWith('map<')) {
    const inner = type.slice(4, -1);
    const parts = splitTopLevel(inner);
    const keyType = parts[0].trim();
    const valueType = parts[1].trim();
    try {
      const obj = JSON.parse(value);
      const converted = {};
      for (const [k, v] of Object.entries(obj)) {
        const ck = convertCsvValue(String(k), keyType, columnName);
        const cv = convertCsvValue(String(v), valueType, columnName);
        converted[typeof ck === 'object' ? JSON.stringify(ck) : String(ck)] = cv;
      }
      return converted;
    } catch {
      return {};
    }
  }

  if (type.startsWith('frozen<')) return value;

  if (type.startsWith('tuple<')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  if (type === 'inet') return value;

  return value;
}

function splitTopLevel(str) {
  const parts = [];
  let current = '';
  let depth = 0;

  for (const ch of str) {
    if (ch === '<') depth++;
    else if (ch === '>') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  values.push(current);
  return values;
}

/* ============================================================
   Helper
   ============================================================ */

function quoteId(id) {
  if (/^[a-z][a-z0-9_]*$/.test(id)) return id;
  return `"${id.replace(/"/g, '""')}"`;
}