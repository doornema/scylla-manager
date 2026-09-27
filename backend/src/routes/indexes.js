import { Router } from 'express';
import {
  listIndexes,
  createIndex,
  dropIndex,
} from '../services/scyllaService.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { createIndexSchema, validate } from '../middleware/validate.js';

const router = Router();

router.get('/:keyspace/:table', authRequired, async (req, res) => {
  try {
    const indexes = await listIndexes(req.params.keyspace, req.params.table);
    res.json(indexes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', authRequired, adminRequired, validate(createIndexSchema), async (req, res) => {
  try {
    const result = await createIndex(req.body);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:keyspace/:indexName', authRequired, adminRequired, async (req, res) => {
  try {
    await dropIndex(req.params.keyspace, req.params.indexName);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;