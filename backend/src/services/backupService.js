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

  // ۱. تولید schema.cql
  const schemaParts = [];
  for (const table of tables) {
    try {
      const info = await getTableFullInfo(keyspace, table);
      schemaParts.push(`-- Table: ${table}`);
      schemaParts.push(info.cql);
      if (info.indexCqls && info.indexCqls.length > 0) {
        schemaParts.push(...info.indexCqls);
      }
      schemaParts.push('');
    } catch (e) {
      schemaParts.push(`-- ⚠️ خطا در دریافت schema جدول ${table}: ${e.message}`);
    }
  }
  archive.append(schemaParts.join('\n'), { name: 'schema.cql' });

  // ۲. استخراج داده هر جدول به CSV
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

  // ۳. متادیتا
  const meta = {
    exportedAt: new Date().toISOString(),
    sourceKeyspace: keyspace,
    tables,
    tool: 'scylla-manager',
    version: '1.0.0',
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
    // برای UUID یا اشیای خاص که toString معتبر دارند
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

export async function restoreKeyspaceFromZip(zipBuffer, targetKeyspace, options = {}) {
  const { skipSchema = false, skipData = false, truncateFirst = false } = options;

  const directory = await unzipper.Open.buffer(zipBuffer);
  const files = directory.files;

  const schemaFile = files.find((f) => f.path === 'schema.cql');
  const dataFiles = files.filter(
    (f) => f.path.startsWith('data/') && f.path.endsWith('.csv')
  );

  const result = {
    schemaExecuted: false,
    tablesRestored: [],
    errors: [],
    createdTables: [],
    skippedTables: [],
  };

  // ۱. اجرای schema و ثبت جداول ساخته‌شده
  const createdTableNames = new Set();
  if (!skipSchema && schemaFile) {
    try {
      const schemaContent = (await schemaFile.buffer()).toString('utf-8');
      const schemaResult = await executeSchemaCql(schemaContent, targetKeyspace);
      result.schemaExecuted = true;
      result.createdTables = schemaResult.createdTables;
      result.errors.push(...schemaResult.errors);
      schemaResult.createdTables.forEach((t) => createdTableNames.add(t));
    } catch (e) {
      result.errors.push(`خطا در اجرای schema: ${e.message}`);
    }
  } else if (skipSchema) {
    // اگر schema رد شد، جدول‌های موجود در targetKeyspace را پیدا کن
    try {
      const existing = await executeQuery(
        `SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?`,
        [targetKeyspace]
      );
      existing.rows.forEach((r) => createdTableNames.add(r.table_name));
    } catch { /* ignore */ }
  }

  // ۲. صبر برای propagation schema
  if (createdTableNames.size > 0) {
    await waitForTables(targetKeyspace, [...createdTableNames], 15000);
  }

  // ۳. ایمپورت داده
  if (!skipData) {
    for (const file of dataFiles) {
      const tableName = file.path.replace('data/', '').replace('.csv', '');

      // اگر جدول ساخته نشده، از import صرف‌نظر کن
      if (createdTableNames.size > 0 && !createdTableNames.has(tableName)) {
        result.skippedTables.push({
          table: tableName,
          reason: 'جدول ساخته نشده یا یافت نشد',
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
 * جایگزینی نام Keyspace در تمام دستورات CQL موجود در schema
 */
function replaceKeyspaceInSchema(cql, newKeyspace) {
  // الگوهای کلیدی که بعد از آن‌ها نام keyspace.table می‌آید
  // شامل: FROM, INTO, TABLE, UPDATE, ON (در CREATE INDEX و GRANT)
  const patterns = [
    // CREATE TABLE [IF NOT EXISTS] ks.tbl
    /\b(TABLE)\s+(IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\./gi,
    // CREATE INDEX name ON ks.tbl
    /\b(ON)\s+([a-z_][a-z0-9_]*)\s*\./gi,
    // SELECT/INSERT/UPDATE/DELETE ... FROM/INTO/UPDATE ks.tbl
    /\b(FROM|INTO|UPDATE)\s+([a-z_][a-z0-9_]*)\s*\./gi,
    // ALTER TABLE ks.tbl / DROP TABLE ks.tbl
    /\b(ALTER|DROP)\s+(TABLE|KEYSPACE)\s+(IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\./gi,
  ];

  let result = cql;

  for (const pattern of patterns) {
    result = result.replace(pattern, (match, ...args) => {
      // آخرین آرگومان‌ها: offset, string, groups?
      // ساده‌تر: با indexOf پیدا می‌کنیم و اولین keyspace را جایگزین می‌کنیم
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
 * اجرای محتوای schema.cql با جایگزینی نام Keyspace
 */
async function executeSchemaCql(schemaContent, targetKeyspace) {
  const statements = splitCqlStatements(schemaContent);
  const createdTables = [];
  const errors = [];

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;

    const finalCql = replaceKeyspaceInSchema(trimmed, targetKeyspace);

    // استخراج نام جدول از CREATE TABLE
    const createTableMatch = finalCql.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/i
    );

    try {
      await executeQuery(finalCql);
      if (createTableMatch) {
        const ks = createTableMatch[1];
        const tbl = createTableMatch[2];
        if (ks.toLowerCase() === targetKeyspace.toLowerCase()) {
          if (!createdTables.includes(tbl)) createdTables.push(tbl);
        }
      }
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('already exist')) {
        // جدول از قبل وجود دارد — همچنان به عنوان جدول موجود در نظر بگیر
        if (createTableMatch) {
          const tbl = createTableMatch[2];
          if (!createdTables.includes(tbl)) createdTables.push(tbl);
        }
      } else {
        // خطاهای دیگر را در errors ثبت کن اما ادامه بده
        errors.push(
          `اجرای "${finalCql.substring(0, 100)}${finalCql.length > 100 ? '...' : ''}": ${msg}`
        );
      }
    }
  }

  return { createdTables, errors };
}

/**
 * صبر تا زمانی که جداول در system_schema ظاهر شوند
 */
async function waitForTables(keyspace, tableNames, timeoutMs = 15000) {
  const start = Date.now();
  const remaining = new Set(tableNames);

  while (Date.now() - start < timeoutMs && remaining.size > 0) {
    try {
      const res = await executeQuery(
        `SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?`,
        [keyspace]
      );
      const existing = new Set(res.rows.map((r) => r.table_name));
      for (const t of [...remaining]) {
        if (existing.has(t)) remaining.delete(t);
      }
      if (remaining.size === 0) return true;
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 400));
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
 * ایمپورت CSV با تبدیل نوع‌آگاه مقادیر
 */
async function importCsvToTable(keyspace, table, csvContent) {
  const lines = csvContent.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { imported: 0, skipped: 0, errors: [] };

  // دریافت نوع ستون‌ها از system_schema
  const schemaRes = await executeQuery(
    `SELECT column_name, type FROM system_schema.columns
     WHERE keyspace_name = ? AND table_name = ?`,
    [keyspace, table]
  );

  if (schemaRes.rows.length === 0) {
    throw new Error(`ساختار جدول ${keyspace}.${table} یافت نشد`);
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

/**
 * تبدیل یک مقدار CSV به نوع صحیح CQL
 */
function convertCsvValue(rawValue, cqlType, columnName) {
  // مقدار خالی → null (به‌جز رشته‌ها که می‌توانند خالی باشند)
  if (rawValue === '' || rawValue === undefined || rawValue === null) {
    const t = String(cqlType).toLowerCase().trim();
    // برای انواع غیر-متنی، null برمی‌گردانیم
    if (['text', 'varchar', 'ascii'].includes(t)) return '';
    return null;
  }

  const type = String(cqlType).toLowerCase().trim();
  const value = String(rawValue);

  // ========== UUID / TimeUUID ==========
  if (type === 'uuid' || type === 'timeuuid') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error(
        `UUID نامعتبر در ستون "${columnName}": "${value.substring(0, 50)}"`
      );
    }
    return value;
  }

  // ========== Timestamp ==========
  if (type === 'timestamp') {
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      throw new Error(`Timestamp نامعتبر در ستون "${columnName}": "${value}"`);
    }
    return d;
  }

  // ========== Date ==========
  if (type === 'date') {
    // فرمت YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        throw new Error(`Date نامعتبر در ستون "${columnName}": "${value}"`);
      }
      return d.toISOString().split('T')[0];
    }
    return value;
  }

  // ========== Time ==========
  if (type === 'time') {
    // فرمت HH:MM:SS[.mmm]
    return value;
  }

  // ========== اعداد صحیح ==========
  if (['tinyint', 'smallint', 'int'].includes(type)) {
    const n = parseInt(value, 10);
    if (isNaN(n)) {
      throw new Error(`عدد صحیح نامعتبر در ستون "${columnName}": "${value}"`);
    }
    return n;
  }

  if (type === 'bigint' || type === 'counter') {
    if (/^-?\d+$/.test(value)) {
      // برای مقادیر بزرگ از BigInt استفاده کن
      const num = Number(value);
      if (Number.isSafeInteger(num)) return num;
      return BigInt(value);
    }
    throw new Error(`عدد صحیح بزرگ نامعتبر در ستون "${columnName}": "${value}"`);
  }

  if (type === 'varint') {
    return value; // به‌صورت رشته ارسال می‌شود
  }

  // ========== اعداد اعشاری ==========
  if (type === 'float' || type === 'double') {
    const n = parseFloat(value);
    if (isNaN(n)) {
      throw new Error(`عدد اعشاری نامعتبر در ستون "${columnName}": "${value}"`);
    }
    return n;
  }

  if (type === 'decimal') {
    return value;
  }

  // ========== Boolean ==========
  if (type === 'boolean' || type === 'bool') {
    const lower = value.toLowerCase().trim();
    if (['true', '1', 't', 'yes'].includes(lower)) return true;
    if (['false', '0', 'f', 'no'].includes(lower)) return false;
    throw new Error(`Boolean نامعتبر در ستون "${columnName}": "${value}"`);
  }

  // ========== Blob ==========
  if (type === 'blob') {
    if (value.startsWith('0x')) {
      return Buffer.from(value.slice(2), 'hex');
    }
    return Buffer.from(value, 'binary');
  }

  // ========== مجموعه‌ها ==========
  if (type.startsWith('list<') || type.startsWith('set<')) {
    const innerType = type.slice(type.indexOf('<') + 1, -1);
    try {
      const arr = JSON.parse(value);
      if (!Array.isArray(arr)) return [convertCsvValue(arr, innerType, columnName)];
      return arr.map((v) => convertCsvValue(String(v), innerType, columnName));
    } catch {
      // اگر JSON نبود، به عنوان یک آیتم واحد در نظر بگیر
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

  if (type.startsWith('frozen<')) {
    // برای frozen، مقدار را همان‌طور که هست ارسال می‌کنیم
    return value;
  }

  if (type.startsWith('tuple<')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // ========== inet ==========
  if (type === 'inet') {
    return value;
  }

  // ========== متن ==========
  return value;
}

/**
 * تقسیم یک رشته در سطح بالا بر اساس کاما (با نادیده گرفتن کاماهای داخل <...>)
 */
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

/**
 * پارس یک خط CSV با پشتیبانی از کوتیشن
 */
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