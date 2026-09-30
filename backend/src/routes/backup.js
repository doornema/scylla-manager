import { Router } from 'express';
import multer from 'multer';
import {
  streamKeyspaceBackup,
  restoreKeyspaceFromZip,
} from '../services/backupService.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

/**
 * GET /api/backup/download/:keyspace
 * دانلود بک‌آپ کامل یک Keyspace به‌صورت ZIP
 */
router.get('/download/:keyspace', authRequired, adminRequired, async (req, res) => {
  try {
    const { keyspace } = req.params;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${keyspace}-backup-${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const stream = await streamKeyspaceBackup(keyspace);
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('❌ Backup stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });
  } catch (e) {
    console.error('❌ Backup error:', e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    }
  }
});

/**
 * POST /api/backup/restore
 * ریستور یک Keyspace از فایل ZIP
 * Body (multipart): file, targetKeyspace, skipSchema, skipData, truncateFirst
 */
router.post(
  '/restore',
  authRequired,
  adminRequired,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'فایلی آپلود نشده است' });
      }

      const targetKeyspace = req.body.targetKeyspace;
      if (!targetKeyspace) {
        return res.status(400).json({ error: 'نام Keyspace مقصد الزامی است' });
      }

      const options = {
        skipSchema: req.body.skipSchema === 'true',
        skipData: req.body.skipData === 'true',
        truncateFirst: req.body.truncateFirst === 'true',
      };

      const result = await restoreKeyspaceFromZip(
        req.file.buffer,
        targetKeyspace,
        options
      );

      res.json({
        success: true,
        targetKeyspace,
        schemaExecuted: result.schemaExecuted,
        tablesRestored: result.tablesRestored,
        errors: result.errors,
      });
    } catch (e) {
      console.error('❌ Restore error:', e);
      res.status(500).json({ error: e.message });
    }
  }
);

export default router;