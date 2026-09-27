import { Router } from 'express';
import {
  selectRows,
  insertRow,
  updateRow,
  deleteRow,
} from '../services/scyllaService.js';
import { authRequired } from '../middleware/auth.js';
import { crudSchema, validate } from '../middleware/validate.js';

const router = Router();

router.get('/:keyspace/:table', authRequired, async (req, res) => {
  try {
    const { limit = 100, where, params } = req.query;
    const rows = await selectRows(
      req.params.keyspace,
      req.params.table,
      limit,
      where || null,
      params ? JSON.parse(params) : []
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', authRequired, validate(crudSchema), async (req, res) => {
  try {
    await insertRow(req.body.keyspace, req.body.table, req.body.data || {});
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/', authRequired, validate(crudSchema), async (req, res) => {
  try {
    await updateRow(
      req.body.keyspace,
      req.body.table,
      req.body.data || {},
      req.body.where,
      req.body.whereParams || []
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/', authRequired, validate(crudSchema), async (req, res) => {
  try {
    await deleteRow(
      req.body.keyspace,
      req.body.table,
      req.body.where,
      req.body.whereParams || []
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;