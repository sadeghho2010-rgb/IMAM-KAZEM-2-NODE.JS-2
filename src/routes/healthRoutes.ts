import { Router } from 'express';
import { getMysqlPool } from '../lib/databaseAbstraction';

const router = Router();

router.get('/health', async (_req, res) => {
  const pool = getMysqlPool();
  if (!pool) {
    return res.status(200).json({
      status: 'ok',
      mysql: false,
      timestamp: Date.now()
    });
  }

  try {
    await pool.query('SELECT 1 AS ping');
    return res.status(200).json({
      status: 'ok',
      mysql: true,
      timestamp: Date.now()
    });
  } catch (err: any) {
    return res.status(503).json({
      status: 'degraded',
      mysql: false,
      error: err?.message || String(err),
      timestamp: Date.now()
    });
  }
});

export default router;
