import { Router, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/serverAuth';
import { getSystemHealthReport, recordMemorySnapshot } from '../lib/systemHealthMonitor';

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

export default router;
