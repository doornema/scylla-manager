import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import authRoutes from './routes/auth.js';
import keyspaceRoutes from './routes/keyspaces.js';
import tableRoutes from './routes/tables.js';
import dataRoutes from './routes/data.js';
import monitorRoutes from './routes/monitor.js';
import indexRoutes from './routes/indexes.js';
import queryRoutes from './routes/query.js';

import { getClient, closeClient } from './config/db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
const PORT = process.env.PORT || 3000;

/* ============================================================
   BigInt Serializer — حیاتی برای سازگاری با ScyllaDB
   ScyllaDB برای bigint/counter/varint/timestamp مقدار BigInt
   برمی‌گرداند که JSON.stringify نمی‌تواند آن را سریالایز کند.
   این replacer آن‌ها را به String تبدیل می‌کند.
   ============================================================ */
app.set('json replacer', (key, value) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
});

/* امنیت */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
      },
    },
  })
);

app.use(cors({ origin: process.env.CORS_ORIGIN || false }));
app.use(express.json({ limit: '1mb' }));

/* Rate Limiting */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'تعداد تلاش‌های ورود بیش از حد مجاز است' },
});
app.use('/api/auth/login', loginLimiter);

/* Routes */
app.use('/api/auth', authRoutes);
app.use('/api/keyspaces', keyspaceRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/indexes', indexRoutes);
app.use('/api/query', queryRoutes);

app.get('/api/health', (req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

/* Static Frontend */
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR, { maxAge: '1h', index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

/* Error handler — با پشتیبانی از BigInt */
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  const message = typeof err?.message === 'string' ? err.message : 'خطای داخلی سرور';
  res.status(500).json({
    error: message,
    code: err?.code || err?.name || 'INTERNAL_ERROR',
  });
});

/* ========== راه‌اندازی ========== */
async function start() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  });

  try {
    await getClient();
    console.log('✅ Database initialized');
  } catch (e) {
    console.error('❌ Failed to connect to ScyllaDB after all retries:', e.message);
  }
}

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down...');
  await closeClient();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down...');
  await closeClient();
  process.exit(0);
});

start();