import { z } from 'zod';

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'داده‌های ورودی نامعتبر',
        details: result.error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

export const loginSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(6).max(128),
});

export const createKeyspaceSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/, 'نام Keyspace باید با حرف کوچک شروع شود'),
  replicationFactor: z.number().int().min(1).max(10).default(1),
  strategy: z.enum(['SimpleStrategy', 'NetworkTopologyStrategy']).default('SimpleStrategy'),
});

export const createTableAdvancedSchema = z.object({
  keyspace: z.string().min(1),
  table: z.string().regex(/^[a-z][a-z0-9_]*$/),
  columns: z.array(
    z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      kind: z.enum(['regular', 'static']).optional(),
    })
  ).min(1),
  partitionKey: z.array(z.string()).min(1),
  clusteringKey: z.array(z.string()).optional(),
  clusteringOrder: z.record(z.enum(['ASC', 'DESC'])).optional(),
  options: z.object({
    compaction: z.object({
      class: z.enum([
        'SizeTieredCompactionStrategy',
        'LeveledCompactionStrategy',
        'TimeWindowCompactionStrategy',
        'IncrementalCompactionStrategy',
      ]),
      bucket_high: z.number().optional(),
      bucket_low: z.number().optional(),
      max_threshold: z.number().optional(),
      min_threshold: z.number().optional(),
      sstable_size_in_mb: z.number().optional(),
      window_size: z.string().optional(),
      timestamp_resolution: z.enum(['MICROSECONDS', 'MILLISECONDS', 'SECONDS']).optional(),
    }).optional(),
    caching: z.object({
      keys: z.enum(['ALL', 'NONE']).optional(),
      rows_per_partition: z.string().optional(),
    }).optional(),
    compression: z.object({
      class: z.enum(['LZ4Compressor', 'SnappyCompressor', 'DeflateCompressor', 'ZstdCompressor']),
      chunk_length_in_kb: z.number().optional(),
    }).optional(),
    ttl: z.number().int().min(0).optional(),
    gcGrace: z.number().int().min(0).optional(),
    bloomFilter: z.number().min(0).max(1).optional(),
    comment: z.string().max(500).optional(),
  }).optional().default({}),
});

export const createIndexSchema = z.object({
  keyspace: z.string().min(1),
  table: z.string().min(1),
  indexName: z.string().optional(),
  column: z.string().min(1),
  type: z.enum(['regular', 'KEYS', 'VALUES', 'ENTRIES', 'FULL', 'FULLKEYS']).default('regular'),
  customClass: z.string().optional(),
});

export const runQuerySchema = z.object({
  cql: z.string().min(1).max(10000),
  params: z.array(z.any()).optional().default([]),
});

export const crudSchema = z.object({
  keyspace: z.string().min(1),
  table: z.string().min(1),
  data: z.record(z.any()).optional(),
  where: z.string().optional(),
  whereParams: z.array(z.any()).optional(),
});