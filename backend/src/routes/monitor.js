import { Router } from 'express';
import {
  getClusterInfo,
  getNodeStatus,
  getLargePartitions,
  getMetrics,
} from '../services/scyllaService.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/cluster', authRequired, async (req, res) => {
  try {
    const data = await getClusterInfo();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/nodes', authRequired, async (req, res) => {
  try {
    const data = await getNodeStatus();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/large-partitions', authRequired, async (req, res) => {
  try {
    const data = await getLargePartitions(req.query.limit || 20);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/metrics', authRequired, async (req, res) => {
  try {
    const data = await getMetrics();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;