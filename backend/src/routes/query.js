import { Router } from 'express';
import { runQuery } from '../services/scyllaService.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { runQuerySchema, validate } from '../middleware/validate.js';

const router = Router();

/**
 * اجرای کوئری CQL دلخواه — فقط ادمین‌ها.
 * شامل DDL (CREATE TABLE, DROP, CREATE INDEX) و DML (SELECT, INSERT, ...)
 */
router.post('/run', authRequired, adminRequired, validate(runQuerySchema), async (req, res) => {
  const result = await runQuery(req.body.cql, req.body.params);
  res.json(result);
});

export default router;