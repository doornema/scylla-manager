import { executeQuery } from '../config/db.js';

/* ========== Keyspace ========== */

export async function listKeyspaces() {
  const result = await executeQuery(
    `SELECT keyspace_name, durable_writes, replication
     FROM system_schema.keyspaces`
  );
  return result.rows.map((r) => ({
    name: r.keyspace_name,
    durableWrites: r.durable_writes,
    replication: r.replication,
  }));
}

export async function createKeyspace(name, replicationFactor = 1, strategy = 'SimpleStrategy') {
  const cql = `CREATE KEYSPACE IF NOT EXISTS ${quoteId(name)}
    WITH replication = {'class': '${strategy}', 'replication_factor': ${replicationFactor}}`;
  await executeQuery(cql);
  return { name, replicationFactor, strategy };
}

export async function dropKeyspace(name) {
  await executeQuery(`DROP KEYSPACE IF EXISTS ${quoteId(name)}`);
}

/* ========== Tables (Advanced) ========== */

export async function listTables(keyspace) {
  const result = await executeQuery(
    `SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?`,
    [keyspace]
  );
  return result.rows.map((r) => r.table_name);
}

export async function getTableSchema(keyspace, table) {
  const cols = await executeQuery(
    `SELECT column_name, kind, type, position
     FROM system_schema.columns
     WHERE keyspace_name = ? AND table_name = ?`,
    [keyspace, table]
  );
  return cols.rows.map((r) => ({
    name: r.column_name,
    kind: r.kind,
    type: r.type,
    position: r.position,
  }));
}

/**
 * ایجاد جدول پیشرفته با پشتیبانی از:
 * - Clustering Order (ASC/DESC)
 * - Compaction Strategy (STCS, LCS, TWCS, ICS)
 * - Caching (keys, rows_per_partition)
 * - Compression (LZ4, Snappy, Deflate, Zstd)
 * - TTL پیش‌فرض
 * - gc_grace_seconds, bloom_filter_fp_chance
 * - comment
 */
export async function createTableAdvanced({
  keyspace,
  table,
  columns,
  partitionKey,
  clusteringKey,
  clusteringOrder,
  options = {},
}) {
  const colDefs = columns.map((c) => {
    let def = `${quoteId(c.name)} ${c.type}`;
    if (c.kind === 'static') def += ' STATIC';
    return def;
  }).join(', ');

  const pkParts = [];
  if (partitionKey.length === 1) {
    pkParts.push(`(${quoteId(partitionKey[0])})`);
  } else {
    pkParts.push(`(${partitionKey.map(quoteId).join(', ')})`);
  }
  if (clusteringKey && clusteringKey.length > 0) {
    pkParts.push(clusteringKey.map(quoteId).join(', '));
  }
  const pkDef = pkParts.join(', ');

  const withParts = [];

  if (clusteringOrder && Object.keys(clusteringOrder).length > 0) {
    const orderParts = Object.entries(clusteringOrder)
      .map(([col, dir]) => `${quoteId(col)} ${dir}`)
      .join(', ');
    withParts.push(`CLUSTERING ORDER BY (${orderParts})`);
  }

  if (options.compaction) {
    const comp = options.compaction;
    const compParts = [`'class': '${comp.class}'`];
    if (comp.bucket_high) compParts.push(`'bucket_high': ${comp.bucket_high}`);
    if (comp.bucket_low) compParts.push(`'bucket_low': ${comp.bucket_low}`);
    if (comp.max_threshold) compParts.push(`'max_threshold': ${comp.max_threshold}`);
    if (comp.min_threshold) compParts.push(`'min_threshold': ${comp.min_threshold}`);
    if (comp.sstable_size_in_mb) compParts.push(`'sstable_size_in_mb': ${comp.sstable_size_in_mb}`);
    if (comp.window_size) compParts.push(`'window_size': '${comp.window_size}'`);
    if (comp.timestamp_resolution) compParts.push(`'timestamp_resolution': '${comp.timestamp_resolution}'`);
    withParts.push(`compaction = {${compParts.join(', ')}}`);
  }

  if (options.caching) {
    const cacheParts = [];
    if (options.caching.keys) cacheParts.push(`'keys': '${options.caching.keys}'`);
    if (options.caching.rows_per_partition) cacheParts.push(`'rows_per_partition': '${options.caching.rows_per_partition}'`);
    if (cacheParts.length > 0) withParts.push(`caching = {${cacheParts.join(', ')}}`);
  }

  if (options.compression) {
    const comp = options.compression;
    const compParts = [];
    // ✅ استفاده از sstable_compression و نام کوتاه کلاس
    if (comp.class) {
      const shortName = comp.class.split('.').pop();
      compParts.push(`'sstable_compression': '${shortName}'`);
    }
    if (comp.chunk_length_in_kb) {
      compParts.push(`'chunk_length_in_kb': ${comp.chunk_length_in_kb}`);
    }
    if (compParts.length > 0) {
      withParts.push(`compression = {${compParts.join(', ')}}`);
    }
  }

  if (options.ttl !== undefined && options.ttl > 0) {
    withParts.push(`default_time_to_live = ${options.ttl}`);
  }

  if (options.gcGrace !== undefined) {
    withParts.push(`gc_grace_seconds = ${options.gcGrace}`);
  }

  if (options.bloomFilter !== undefined) {
    withParts.push(`bloom_filter_fp_chance = ${options.bloomFilter}`);
  }

  if (options.comment) {
    withParts.push(`comment = '${options.comment.replace(/'/g, "''")}'`);
  }

  let cql = `CREATE TABLE IF NOT EXISTS ${quoteId(keyspace)}.${quoteId(table)}
    (${colDefs}, PRIMARY KEY (${pkDef}))`;

  if (withParts.length > 0) {
    cql += ` WITH ${withParts.join(' AND ')}`;
  }

  await executeQuery(cql);
  return { cql };
}

export async function dropTable(keyspace, table) {
  await executeQuery(`DROP TABLE IF EXISTS ${quoteId(keyspace)}.${quoteId(table)}`);
}

/* ========== Indexes ========== */

export async function listIndexes(keyspace, table) {
  const result = await executeQuery(
    `SELECT index_name, kind, options
     FROM system_schema.indexes
     WHERE keyspace_name = ? AND table_name = ?`,
    [keyspace, table]
  );
  return result.rows.map((r) => ({
    name: r.index_name,
    kind: r.kind,
    options: r.options,
  }));
}

export async function createIndex({
  keyspace,
  table,
  indexName,
  column,
  type = 'regular',
  customClass,
}) {
  let target = column;
  if (type === 'KEYS') target = `KEYS(${quoteId(column)})`;
  else if (type === 'VALUES') target = `VALUES(${quoteId(column)})`;
  else if (type === 'ENTRIES') target = `ENTRIES(${quoteId(column)})`;
  else if (type === 'FULL') target = `FULL(${quoteId(column)})`;
  else if (type === 'FULLKEYS') target = `FULL(KEYS(${quoteId(column)}))`;
  else target = quoteId(column);

  let cql = `CREATE INDEX`;
  if (indexName) cql += ` ${quoteId(indexName)}`;
  cql += ` ON ${quoteId(keyspace)}.${quoteId(table)} (${target})`;
  if (customClass) cql += ` USING '${customClass}'`;

  await executeQuery(cql);
  return { cql };
}

export async function dropIndex(keyspace, indexName) {
  await executeQuery(`DROP INDEX IF EXISTS ${quoteId(keyspace)}.${quoteId(indexName)}`);
}

/* ========== Data CRUD ========== */

export async function selectRows(keyspace, table, limit = 100, where = null, params = []) {
  let cql = `SELECT * FROM ${quoteId(keyspace)}.${quoteId(table)}`;
  if (where) cql += ` WHERE ${where}`;
  cql += ` LIMIT ${parseInt(limit, 10)}`;
  const result = await executeQuery(cql, params);
  return result.rows;
}

export async function insertRow(keyspace, table, data) {
  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(', ');
  const cql = `INSERT INTO ${quoteId(keyspace)}.${quoteId(table)}
    (${cols.map(quoteId).join(', ')}) VALUES (${placeholders})`;
  await executeQuery(cql, Object.values(data));
}

export async function updateRow(keyspace, table, data, where, whereParams) {
  const pkNames = (where || '')
    .split(/\s+AND\s+/i)
    .map((part) => part.split('=')[0].trim());

  const safeData = {};
  Object.entries(data).forEach(([key, value]) => {
    if (!pkNames.includes(key)) {
      safeData[key] = value;
    }
  });

  if (Object.keys(safeData).length === 0) {
    throw new Error('هیچ فیلد غیر-کلیدی برای به‌روزرسانی وجود ندارد');
  }

  const setClause = Object.keys(safeData)
    .map((c) => `${quoteId(c)} = ?`)
    .join(', ');
  const cql = `UPDATE ${quoteId(keyspace)}.${quoteId(table)}
    SET ${setClause} WHERE ${where}`;
  await executeQuery(cql, [...Object.values(safeData), ...whereParams]);
}

export async function deleteRow(keyspace, table, where, whereParams) {
  const cql = `DELETE FROM ${quoteId(keyspace)}.${quoteId(table)} WHERE ${where}`;
  await executeQuery(cql, whereParams);
}

/* ========== CQL Query Runner ========== */

export async function runQuery(cql, params = []) {
  const startTime = Date.now();
  try {
    const result = await executeQuery(cql, params);
    const duration = Date.now() - startTime;

    return {
      success: true,
      duration,
      rows: result.rows || [],
      columns: result.columns
        ? result.columns.map((c) => ({ name: c.name, type: c.type.code }))
        : [],
      rowCount: (result.rows || []).length,
      pageState: result.pageState || null,
      warnings: result.info?.warnings || [],
      applied: result.info?.applied ?? null,
    };
  } catch (err) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: {
        message: err.message,
        code: err.code || err.name,
        info: err.info ? JSON.parse(JSON.stringify(err.info)) : null,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
    };
  }
}

/* ========== Table Full Info (شامل کوئری CREATE TABLE + ایندکس‌ها) ========== */

export async function getTableFullInfo(keyspace, table) {
  const columns = await getTableSchema(keyspace, table);

  const tableInfo = await executeQuery(
    `SELECT * FROM system_schema.tables WHERE keyspace_name = ? AND table_name = ?`,
    [keyspace, table]
  );
  const info = tableInfo.rows[0] || {};

  const indexes = await listIndexes(keyspace, table);

  let estimatedRows = null;
  try {
    const countRes = await executeQuery(
      `SELECT COUNT(*) AS c FROM ${quoteId(keyspace)}.${quoteId(table)}`
    );
    estimatedRows = countRes.rows[0]?.c || 0;
  } catch {
    /* برای جداول بزرگ ممکن است timeout بدهد */
  }

  // ساخت کوئری اصلی CREATE TABLE
  const cql = buildCreateTableCql(keyspace, table, columns, info);

  // ساخت کوئری CREATE INDEX برای هر ایندکس
  const indexCqls = (indexes || []).map((idx) => buildCreateIndexCql(keyspace, table, idx));

  // ترکیب همه کوئری‌ها (جدول + ایندکس‌ها)
  const fullCql = indexCqls.length > 0
    ? `${cql}\n\n-- Indexes --\n${indexCqls.join('\n')}`
    : cql;

  let sizeEstimates = [];
  try {
    const sizeRes = await executeQuery(
      `SELECT range_start, range_end, mean_partition_size, partitions_count
       FROM system.size_estimates
       WHERE keyspace_name = ? AND table_name = ?`,
      [keyspace, table]
    );
    sizeEstimates = sizeRes.rows || [];
  } catch {
    /* optional */
  }

  return {
    keyspace,
    table,
    columns,
    indexes,
    indexCqls,
    fullCql,
    estimatedRows,
    sizeEstimates,
    cql,
    options: {
      compaction: info.compaction,
      compression: info.compression,
      caching: info.caching,
      comment: info.comment,
      default_time_to_live: info.default_time_to_live,
      gc_grace_seconds: info.gc_grace_seconds,
      bloom_filter_fp_chance: info.bloom_filter_fp_chance,
      speculative_retry: info.speculative_retry,
      read_repair_chance: info.read_repair_chance,
      dclocal_read_repair_chance: info.dclocal_read_repair_chance,
      cdc: info.cdc,
      id: info.id,
    },
  };
}

function buildCreateTableCql(keyspace, table, columns, info) {
  if (columns.length === 0) return '';

  const pk = columns
    .filter((c) => c.kind === 'partition_key')
    .sort((a, b) => a.position - b.position)
    .map((c) => c.name);

  const ck = columns
    .filter((c) => c.kind === 'clustering')
    .sort((a, b) => a.position - b.position)
    .map((c) => c.name);

  const allColDefs = columns
    .map((c) => {
      let def = `  ${c.name} ${c.type}`;
      if (c.kind === 'static') def += ' STATIC';
      return def;
    })
    .join(',\n');

  let pkStr = pk.length === 1 ? `(${pk[0]})` : `((${pk.join(', ')}))`;
  if (ck.length > 0) {
    pkStr += `, ${ck.join(', ')}`;
  }

  let cql = `CREATE TABLE ${keyspace}.${table} (\n${allColDefs},\n  PRIMARY KEY (${pkStr})\n)`;

  const withParts = [];

  if (info.clustering_order) {
    const orderParts = Object.entries(info.clustering_order)
      .filter(([k]) => k !== 'column_name')
      .map(([col, dir]) => `${col} ${String(dir).toUpperCase()}`)
      .join(', ');
    if (orderParts) withParts.push(`  CLUSTERING ORDER BY (${orderParts})`);
  }

  if (info.compaction) {
    withParts.push(`  compaction = ${objectToCqlMap(info.compaction)}`);
  }

  if (info.compression) {
    // ✅ اصلاح: تبدیل compression از فرمت system_schema به CQL صحیح
    withParts.push(`  compression = ${buildCompressionCqlMap(info.compression)}`);
  }

  if (info.caching) {
    withParts.push(`  caching = ${objectToCqlMap(info.caching)}`);
  }
  if (info.default_time_to_live) {
    withParts.push(`  default_time_to_live = ${info.default_time_to_live}`);
  }
  if (info.gc_grace_seconds !== undefined) {
    withParts.push(`  gc_grace_seconds = ${info.gc_grace_seconds}`);
  }
  if (info.bloom_filter_fp_chance !== undefined) {
    withParts.push(`  bloom_filter_fp_chance = ${info.bloom_filter_fp_chance}`);
  }
  if (info.comment) {
    withParts.push(`  comment = '${info.comment}'`);
  }

  if (withParts.length > 0) {
    cql += `\nWITH\n${withParts.join(' AND\n')};`;
  } else {
    cql += ';';
  }

  return cql;
}

/**
 * تبدیل مقدار compression از system_schema.tables به فرمت صحیح CQL.
 * system_schema ممکن است کلید 'class' با نام کامل جاوا داشته باشد،
 * اما CQL برای CREATE TABLE نیاز به 'sstable_compression' با نام کوتاه دارد.
 */
function buildCompressionCqlMap(compression) {
  if (!compression || typeof compression !== 'object') {
    return objectToCqlMap(compression);
  }

  const parts = [];
  
  // تعیین نام کوتاه compressor
  let compressorName = compression.sstable_compression || compression.class;
  if (compressorName) {
    // اگر نام کامل جاوا بود، فقط نام کوتاه را استخراج کن
    if (compressorName.includes('.')) {
      compressorName = compressorName.split('.').pop();
    }
    parts.push(`'sstable_compression': '${compressorName}'`);
  }

  // افزودن سایر پارامترها (chunk_length_in_kb و غیره)
  for (const [key, value] of Object.entries(compression)) {
    if (key === 'class' || key === 'sstable_compression') continue;
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      parts.push(`'${key}': '${value}'`);
    } else {
      parts.push(`'${key}': ${value}`);
    }
  }

  return `{${parts.join(', ')}}`;
}

function buildCreateIndexCql(keyspace, table, index) {
  const target = index.options?.target;
  let targetStr;

  if (target && typeof target === 'object') {
    if (target.type && target.column) {
      const t = String(target.type).toUpperCase();
      if (t === 'KEYS') targetStr = `KEYS(${target.column})`;
      else if (t === 'VALUES') targetStr = `VALUES(${target.column})`;
      else if (t === 'ENTRIES') targetStr = `ENTRIES(${target.column})`;
      else if (t === 'FULL') targetStr = `FULL(${target.column})`;
      else targetStr = target.column;
    } else if (Array.isArray(target)) {
      targetStr = target.join(', ');
    } else {
      targetStr = Object.values(target).flat().join(', ');
    }
  } else if (typeof target === 'string') {
    targetStr = target;
  } else {
    const match = index.name.match(new RegExp(`^${table}_(.+?)_idx`));
    targetStr = match ? match[1] : index.name;
  }

  let cql = `CREATE INDEX ${index.name}`;
  cql += ` ON ${keyspace}.${table} (${targetStr})`;

  if (index.options?.class_name) {
    cql += ` USING '${index.options.class_name}'`;
  }

  return cql + ';';
}

function objectToCqlMap(obj) {
  if (typeof obj === 'string') return `'${obj}'`;
  if (typeof obj !== 'object' || obj === null) return obj;
  const parts = Object.entries(obj).map(([k, v]) => {
    if (typeof v === 'string') return `'${k}': '${v}'`;
    if (typeof v === 'boolean') return `'${k}': ${v}`;
    if (typeof v === 'number') return `'${k}': ${v}`;
    return `'${k}': '${v}'`;
  });
  return `{${parts.join(', ')}}`;
}

/* ========== Monitoring ========== */

export async function getClusterInfo() {
  const local = await executeQuery('SELECT * FROM system.local');
  const peers = await executeQuery(
    'SELECT peer, data_center, rack, host_id, release_version FROM system.peers'
  );
  return { local: local.rows[0] || {}, peers: peers.rows || [] };
}

export async function getNodeStatus() {
  const result = await executeQuery(
    `SELECT address, dc, rack, status, load, tokens FROM system.peers_v2`
  ).catch(() => ({ rows: [] }));
  return result.rows;
}

export async function getLargePartitions(limit = 20) {
  const result = await executeQuery(
    `SELECT keyspace_name, table_name, sstable_name, partition_size, partition_key, rows
     FROM system.large_partitions LIMIT ${parseInt(limit, 10)}`
  ).catch(() => ({ rows: [] }));
  return result.rows;
}

export async function getMetrics() {
  const local = await executeQuery('SELECT * FROM system.local');
  const info = local.rows[0] || {};
  return {
    clusterName: info.cluster_name,
    releaseVersion: info.release_version,
    cqlVersion: info.cql_version,
    dataCenter: info.data_center,
    rack: info.rack,
    nativeProtocolVersion: info.native_protocol_version,
    partitioner: info.partitioner,
    schemaVersion: info.schema_version,
    listenAddress: info.listen_address,
    rpcAddress: info.rpc_address,
    tokens: info.tokens,
  };
}

/* ========== Helper ========== */

function quoteId(id) {
  if (/^[a-z][a-z0-9_]*$/.test(id)) return id;
  return `"${id.replace(/"/g, '""')}"`;
}