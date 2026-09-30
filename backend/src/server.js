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
import backupRoutes from './routes/backup.js';

import { getClient, closeClient } from './config/db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
const PORT = process.env.PORT || 3000;

/* ============================================================
   BigInt Serializer — برای سازگاری با ScyllaDB
   ============================================================ */
app.set('json replacer', (key, value) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
});

/* ============================================================
   امنیت — پیکربندی سازگار با HTTP (بدون نیاز به SSL)
   نکته: Helmet به‌طور پیش‌فرض هدر upgrade-insecure-requests را
   ارسال می‌کند که مرورگر را مجبور به استفاده از HTTPS می‌کند.
   این هدر برای محیط‌هایی که با IP و HTTP کار می‌کنند مشکل‌ساز است.
   ============================================================ */
app.use(
  helmet({
    // ⛔ غیرفعال کردن CSP پیش‌فرض که شامل upgrade-insecure-requests است
    contentSecurityPolicy: false,
    // ⛔ غیرفعال کردن هدرهایی که برای مبدأهای ناامن (IP + HTTP) هشدار می‌دهند
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
    // ✅ حفظ هدرهای مفید دیگر مثل X-Content-Type-Options, X-Frame-Options, ...
  })
);

/* CORS — باز برای همه (چون پنل خودش همان مبدأ است) */
app.use(cors({ origin: true, credentials: true }));
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

/* API Routes */
app.use('/api/auth', authRoutes);
app.use('/api/keyspaces', keyspaceRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/indexes', indexRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/backup', backupRoutes);

app.get('/api/health', (req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

/* سرو کردن Static Frontend */
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR, { maxAge: '1h', index: false }));

  // SPA fallback
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
} else {
  console.warn('⚠️  public/ folder not found — running in API-only mode');
}

/* مدیریت خطای نهایی */
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