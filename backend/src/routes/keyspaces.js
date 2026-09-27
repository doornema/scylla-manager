import { Router } from 'express';
import {
  listKeyspaces,
  createKeyspace,
  dropKeyspace,
} from '../services/scyllaService.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { createKeyspaceSchema, validate } from '../middleware/validate.js';

const router = Router();

router.get('/', authRequired, async (req, res) => {
  try {
    const data = await listKeyspaces();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', authRequired, adminRequired, validate(createKeyspaceSchema), async (req, res) => {
  try {
    const result = await createKeyspace(
      req.body.name,
      req.body.replicationFactor,
      req.body.strategy
    );
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:name', authRequired, adminRequired, async (req, res) => {
  try {
    await dropKeyspace(req.params.name);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;