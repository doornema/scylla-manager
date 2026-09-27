import { Router } from 'express';
import {
  listTables,
  getTableSchema,
  getTableFullInfo,
  createTableAdvanced,
  dropTable,
} from '../services/scyllaService.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { createTableAdvancedSchema, validate } from '../middleware/validate.js';

const router = Router();

router.get('/:keyspace', authRequired, async (req, res) => {
  try {
    const tables = await listTables(req.params.keyspace);
    res.json(tables);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:keyspace/:table/schema', authRequired, async (req, res) => {
  try {
    const schema = await getTableSchema(req.params.keyspace, req.params.table);
    res.json(schema);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:keyspace/:table/info', authRequired, async (req, res) => {
  try {
    const info = await getTableFullInfo(req.params.keyspace, req.params.table);
    res.json(info);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', authRequired, adminRequired, validate(createTableAdvancedSchema), async (req, res) => {
  try {
    const result = await createTableAdvanced(req.body);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:keyspace/:table', authRequired, adminRequired, async (req, res) => {
  try {
    await dropTable(req.params.keyspace, req.params.table);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;