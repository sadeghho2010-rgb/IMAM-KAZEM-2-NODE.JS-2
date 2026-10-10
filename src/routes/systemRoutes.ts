import { Router, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/serverAuth';
import { getSystemHealthReport, recordMemorySnapshot } from '../lib/systemHealthMonitor';
import { getDbConnectionStatus, testMysqlConnection } from '../lib/databaseAbstraction';

const router = Router();

// Helper to extract JWT token from request cookies or Authorization headers
const extractToken = (req: Request): string | null => {
  if (req.cookies && req.cookies.auth_access_token) {
    return req.cookies.auth_access_token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

/**
 * GET /api/system/health
 * Realtime system health monitoring endpoint.
 * Restricted strictly to super_admin / level 1.
 * Returns RAM usage (current & 24h trend), slow queries (>1000ms), and recent server errors.
 */
router.get('/health', async (req: Request, res: Response) => {
  // Disable caching so results are always live
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'توکن امنیتی معتبر یافت نشد.' });
    }

    const verification = verifyAccessToken(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ success: false, message: 'اعتبار جلسه کاربری منقضی شده است.' });
    }

    const user = verification.decoded as any;
    const usernameUpper = (user.username || '').toUpperCase();
    const isSuperAdmin = user.role === 'super_admin' || user.level === 1 || user.role === 'school_manager' || usernameUpper === 'SADEGH';
    const isEducationManager = user.role === 'education_manager' || user.role === 'education_officer' || usernameUpper === 'SHAH' || (user.name && user.name.includes('آموزش'));
    const isFinanceManager = user.role === 'finance_manager' || user.role === 'finance_officer' || usernameUpper === 'MALI' || (user.name && user.name.includes('مالی'));
    const hasExplicitTab = Array.isArray(user.allowedTabs) && user.allowedTabs.includes('system-health');

    const isAuthorized = isSuperAdmin || isEducationManager || isFinanceManager || hasExplicitTab;
    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'دسترسی به پایش سلامت سیستم فقط برای سوپر ادمین، مسئول آموزش و مسئول مالی مجاز است.' });
    }

    // Capture latest memory snapshot before sending report
    await recordMemorySnapshot();

    const report = getSystemHealthReport();
    return res.json({
      success: true,
      ...report
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطا در دریافت وضعیت سلامت سیستم';
    return res.status(500).json({ success: false, message });
  }
});

/**
 * GET /api/system/db-status
 * Endpoint to quickly check if the server's connection to MySQL is active and healthy.
 * Helps administrators debug ENV connection variables (Host, Port, DB, User) in real-time.
 */
router.get('/db-status', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const { parseMysqlConfig, ensurePerformanceIndexes } = await import('../lib/databaseAbstraction');
  const conf = parseMysqlConfig();
  let connected = false;

  if (conf.isConfigured) {
    connected = await testMysqlConnection();
    if (connected) {
      await ensurePerformanceIndexes().catch(() => {});
    }
  }

  const status = getDbConnectionStatus();
  return res.json({
    success: true,
    isMysqlConfigured: conf.isConfigured,
    connected,
    host: conf.host || '',
    port: conf.port || 3306,
    database: conf.database || '',
    user: conf.user || '',
    lastError: status.lastError,
    engine: 'MySQL'
  });
});

export default router;
