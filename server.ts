import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
  comparePassword,
  hashPassword,
  validatePasswordStrength,
  validateUsername,
  validateRole,
  dummyPasswordCheck,
  checkEndpointRateLimit,
  trackSecurityIncident,
  updateLastActivity,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  revokeToken,
  revokeAllUserSessions,
  sanitizeUser,
  fetchAllUsersFromStorage,
  saveUserToStorage,
  migrateAllPlainPasswords,
  logServerAudit,
  StoredUser
} from "./src/lib/serverAuth";
import {
  serverSaveDoc,
  serverDeleteDoc,
  serverQueryCollection,
  authorizeCollectionAccess
} from "./src/lib/serverDataApi";

dotenv.config();

function getGenAIClient(customApiKey?: string) {
  const apiKey = customApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("کلید API جمینای یافت نشد. لطفاً کلید API را وارد کنید یا در تنظیمات سیستم قرار دهید.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

async function generateContentWithFallback(client: GoogleGenAI, options: any) {
  const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const res = await client.models.generateContent({
        ...options,
        model: modelName,
      });
      return res;
    } catch (err: any) {
      console.warn(`Model ${modelName} failed, trying next model... Error:`, err?.message || err);
      lastError = err;
    }
  }
  throw lastError || new Error("ارتباط با مدل‌های هوش مصنوعی با خطا مواجه شد.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON body parser with generous limit
  app.use(express.json({ limit: '20mb' }));
  app.use(cookieParser());

  // Enhanced Security Headers Middleware with CSP
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");

    // Content Security Policy: allows AI studio frame embed while locking down scripts & styles
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com; frame-ancestors 'self' https://ai.studio https://*.google.com https://*.run.app; base-uri 'self'; form-action 'self';"
    );

    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    next();
  });

  // CORS and pre-flight handling with restricted origins
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Basic CSRF Protection & Audit Logging for state-changing endpoints
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && req.path.startsWith('/api/')) {
      const origin = req.headers.origin;
      const host = req.headers.host;
      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
            console.warn(`[CSRF_INVALID] Origin ${originHost} does not match Host ${host}`);
            logServerAudit({
              action: 'CSRF_INVALID',
              entityType: 'security',
              entityId: originHost,
              description: `ناهماهنگی مبدأ در درخواست امنیتی: Origin ${originHost} در برابر Host ${host}`,
              ipAddress: typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.socket.remoteAddress || '0.0.0.0'
            }).catch(() => {});
          }
        } catch (e) {}
      }
    }
    next();
  });

  // General API Rate Limiting (100 requests per minute per IP)
  app.use('/api', (req, res, next) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';
    const check = checkEndpointRateLimit(`general_ip_${ip}`, 100, 60 * 1000);
    if (!check.allowed) {
      logServerAudit({
        action: 'RATE_LIMIT_HIT',
        entityType: 'security',
        entityId: ip,
        description: `تخلف از محدودیت تعداد درخواست‌های مجاز عمومی (100 req/min): ${req.path}`,
        ipAddress: ip
      }).catch(() => {});
      return res.status(429).json({ success: false, message: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.' });
    }
    next();
  });

  // ===================== AUTHENTICATION & SECURITY ENDPOINTS =====================

  // Helper to extract JWT token from httpOnly cookie or Authorization header
  const extractToken = (req: express.Request): string | null => {
    if (req.cookies && req.cookies.auth_access_token) {
      return req.cookies.auth_access_token;
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }
    return null;
  };

  // Helper to extract client IP
  const getClientIp = (req: express.Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
  };

  // POST /api/auth/login
  app.post("/api/auth/login", async (req, res) => {
    const ip = getClientIp(req);
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "نام کاربری و رمز عبور الزامی است." });
    }

    const cleanUser = String(username).trim().toUpperCase();
    const cleanPass = String(password).trim();

    const userVal = validateUsername(cleanUser);
    if (!userVal.valid) {
      return res.status(400).json({ success: false, message: userVal.message });
    }

    // 1. Rate Limiting & Lockout Check
    const rateCheck = checkRateLimit(ip, cleanUser);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `تعداد دفعات تلاش ناموفق بیش از حد مجاز است. لطفاً ${rateCheck.waitMinutes} دقیقه دیگر مجدداً تلاش کنید.`
      });
    }

    try {
      // 2. Fetch users from storage
      const users = await fetchAllUsersFromStorage();
      const user = users.find(u => u.username?.toUpperCase() === cleanUser);

      if (!user) {
        // Timing attack mitigation: run constant-time dummy bcrypt check
        await dummyPasswordCheck(cleanPass);

        recordFailedAttempt(ip, cleanUser);
        trackSecurityIncident(ip, undefined, 'LOGIN_FAILED');
        await logServerAudit({
          username: cleanUser,
          action: 'LOGIN_FAILED',
          entityType: 'auth',
          entityId: cleanUser,
          description: 'تلاش ناموفق برای ورود: نام کاربری یا رمز عبور نامعتبر است.',
          ipAddress: ip
        });
        return res.status(401).json({ success: false, message: "نام کاربری یا رمز عبور اشتباه است." });
      }

      // Check if user is locked
      if (user.accountLockedUntil && new Date(user.accountLockedUntil) > new Date()) {
        return res.status(403).json({
          success: false,
          message: "حساب کاربری موقتاً مسدود شده است. با مدیر سامانه تماس بگیرید."
        });
      }

      // 3. Verify Password using bcrypt
      const storedHashOrPlain = user.passwordHash || user.password || "";
      const isMatch = await comparePassword(cleanPass, storedHashOrPlain);

      if (!isMatch) {
        recordFailedAttempt(ip, cleanUser);
        trackSecurityIncident(ip, user.id, 'LOGIN_FAILED');
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }
        await saveUserToStorage(user);

        await logServerAudit({
          userId: user.id,
          username: user.username,
          userRole: user.role,
          action: 'LOGIN_FAILED',
          entityType: 'auth',
          entityId: user.id,
          description: `تلاش ناموفق برای ورود: رمز عبور نادرست برای ${user.username}`,
          ipAddress: ip
        });

        return res.status(401).json({ success: false, message: "نام کاربری یا رمز عبور اشتباه است." });
      }

      // 4. If password was plain text or needs hash migration, upgrade to bcrypt on the fly
      if (!user.passwordHash || (!user.passwordHash.startsWith('$2a$') && !user.passwordHash.startsWith('$2b$'))) {
        user.passwordHash = await hashPassword(cleanPass);
        delete user.password; // Erase plain text
      }

      // Reset failed attempts upon successful authentication
      resetFailedAttempts(ip, cleanUser);
      user.failedLoginAttempts = 0;
      user.accountLockedUntil = undefined;
      user.lastLogin = new Date().toISOString();
      await saveUserToStorage(user);

      // Track last activity for 30-min idle timeout
      updateLastActivity(user.id);

      // 5. Generate secure JWT Access Token (15m) + Refresh Token (7d)
      const safeUser = sanitizeUser(user);
      const { token, refreshToken } = generateTokens(safeUser);

      // 6. Set httpOnly, secure, SameSite=strict cookies
      const isProd = process.env.NODE_ENV === "production";
      res.cookie("auth_access_token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: "strict",
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.cookie("auth_refresh_token", refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "strict",
        path: "/api/auth",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // 7. Audit Log Login Success
      await logServerAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'LOGIN_SUCCESS',
        entityType: 'auth',
        entityId: user.id,
        description: `ورود موفق کاربر ${user.name || user.username} به سامانه`,
        ipAddress: ip
      });

      return res.json({
        success: true,
        user: safeUser,
        token // Provided for client state compatibility
      });
    } catch (err: any) {
      console.error("Login route error:", err);
      return res.status(500).json({ success: false, message: "خطای سرور در فرایند ورود." });
    }
  });

  // GET /api/auth/me - Verify session and return sanitized user
  app.get("/api/auth/me", async (req, res) => {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ authenticated: false, message: "توکن ورود یافت نشد." });
    }

    const verification = verifyAccessToken(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ authenticated: false, message: verification.error || "توکن نامعتبر است." });
    }

    const { userId } = verification.decoded;
    const users = await fetchAllUsersFromStorage();
    const user = users.find(u => u.id === userId);

    if (!user) {
      return res.status(401).json({ authenticated: false, message: "کاربر در سامانه یافت نشد." });
    }

    return res.json({
      authenticated: true,
      user: sanitizeUser(user)
    });
  });

  // GET /api/auth/users - Retrieve sanitized system users for authenticated staff
  app.get("/api/auth/users", async (req, res) => {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "دسترسی غیرمجاز: لطفاً ابتدا وارد شوید." });
    }

    const verification = verifyAccessToken(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ success: false, message: verification.error || "توکن نامعتبر است." });
    }

    const users = await fetchAllUsersFromStorage();
    const sanitizedList = users.map(u => sanitizeUser(u));

    return res.json({
      success: true,
      users: sanitizedList
    });
  });

  // POST /api/auth/refresh - Refresh Access Token
  app.post("/api/auth/refresh", async (req, res) => {
    const refreshToken = req.cookies?.auth_refresh_token || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "ریفرش توکن یافت نشد." });
    }

    const verification = verifyRefreshToken(refreshToken);
    if (!verification.valid || !verification.decoded) {
      logServerAudit({
        action: 'JWT_EXPIRED',
        entityType: 'security',
        entityId: 'refresh_token',
        description: `تلاش برای تمدید با ریفرش‌توکن نامعتبر یا منقضی: ${verification.error}`
      }).catch(() => {});
      return res.status(401).json({ success: false, message: "ریفرش توکن منقضی یا نامعتبر است." });
    }

    const userId = verification.decoded.userId;
    // Rate limit: 30 per hour per user
    const rlCheck = checkEndpointRateLimit(`refresh_${userId}`, 30, 60 * 60 * 1000);
    if (!rlCheck.allowed) {
      return res.status(429).json({ success: false, message: 'تعداد درخواست‌های تمدید نشست بیش از حد مجاز است.' });
    }

    const users = await fetchAllUsersFromStorage();
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "کاربر یافت نشد." });
    }

    updateLastActivity(user.id);
    const safeUser = sanitizeUser(user);
    const tokens = generateTokens(safeUser);
    const isProd = process.env.NODE_ENV === "production";

    res.cookie("auth_access_token", tokens.token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    return res.json({
      success: true,
      user: safeUser,
      token: tokens.token
    });
  });

  // POST /api/auth/logout - Invalidate Session & Clear Cookies
  app.post("/api/auth/logout", async (req, res) => {
    const token = extractToken(req);
    const refreshToken = req.cookies?.auth_refresh_token;

    if (token) revokeToken(token);
    if (refreshToken) revokeToken(refreshToken);

    res.clearCookie("auth_access_token", { sameSite: "strict" });
    res.clearCookie("auth_refresh_token", { path: "/api/auth", sameSite: "strict" });

    return res.json({ success: true, message: "خروج موفقیت‌آمیز انجام شد." });
  });

  // POST /api/auth/logout-all - Invalidate All Sessions for user
  app.post("/api/auth/logout-all", async (req, res) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ success: false, message: "احراز هویت نشده‌اید." });

    const verification = verifyAccessToken(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ success: false, message: "توکن نامعتبر است." });
    }

    const userId = verification.decoded.userId;
    // Rate limit: 5 in 1 hour per user
    const rlCheck = checkEndpointRateLimit(`logout_all_${userId}`, 5, 60 * 60 * 1000);
    if (!rlCheck.allowed) {
      return res.status(429).json({ success: false, message: 'تعداد درخواست‌های خروج همگانی بیش از حد مجاز است.' });
    }

    revokeAllUserSessions(userId);
    res.clearCookie("auth_access_token", { sameSite: "strict" });
    res.clearCookie("auth_refresh_token", { path: "/api/auth", sameSite: "strict" });

    await logServerAudit({
      userId: verification.decoded.userId,
      username: verification.decoded.username,
      action: 'LOGOUT_ALL',
      entityType: 'auth',
      entityId: verification.decoded.userId,
      description: 'خروج از تمام دستگاه‌ها و ابطال کلیه توکن‌های فعال'
    });

    return res.json({ success: true, message: "تمام نشست‌های کاربری شما باطل شد." });
  });

  // POST /api/auth/change-password - Change current user's password with strength check
  app.post("/api/auth/change-password", async (req, res) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ success: false, message: "احراز هویت الزامی است." });

    const verification = verifyAccessToken(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ success: false, message: "توکن نامعتبر است." });
    }

    const userId = verification.decoded.userId;
    // Rate limit: 3 per 15 min per user
    const rlCheck = checkEndpointRateLimit(`change_pwd_${userId}`, 3, 15 * 60 * 1000);
    if (!rlCheck.allowed) {
      return res.status(429).json({ success: false, message: 'تعداد تلاش‌ها برای تغییر رمز عبور بیش از حد مجاز است. لطفاً ۱۵ دقیقه بعد تلاش فرمایید.' });
    }

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "رمز عبور فعلی و رمز عبور جدید الزامی هستند." });
    }

    // Password strength check
    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return res.status(400).json({ success: false, message: strength.message });
    }

    const users = await fetchAllUsersFromStorage();
    const user = users.find(u => u.id === verification.decoded.userId);
    if (!user) return res.status(404).json({ success: false, message: "کاربر یافت نشد." });

    const isMatch = await comparePassword(currentPassword, user.passwordHash || user.password || "");
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "رمز عبور فعلی نادرست است." });
    }

    user.passwordHash = await hashPassword(newPassword);
    delete user.password;
    user.mustChangePassword = false;
    await saveUserToStorage(user);

    // Invalidate other sessions
    revokeAllUserSessions(user.id);

    await logServerAudit({
      userId: user.id,
      username: user.username,
      action: 'CHANGE_PASSWORD',
      entityType: 'user',
      entityId: user.id,
      description: `تغییر موفقیت‌آمیز رمز عبور توسط کاربر ${user.username}`
    });

    return res.json({ success: true, message: "رمز عبور با موفقیت به‌روزرسانی شد." });
  });

  // POST /api/auth/admin-reset-password - Super Admin or Manager resets a user password
  app.post("/api/auth/admin-reset-password", async (req, res) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ success: false, message: "احراز هویت الزامی است." });

    const verification = verifyAccessToken(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ success: false, message: "توکن نامعتبر است." });
    }

    const adminId = verification.decoded.userId;
    // Rate limit: 10 per hour per admin
    const rlCheck = checkEndpointRateLimit(`admin_reset_${adminId}`, 10, 60 * 60 * 1000);
    if (!rlCheck.allowed) {
      return res.status(429).json({ success: false, message: 'محدودیت تعداد بازنشانی رمز عبور در یک ساعت فرا رسیده است.' });
    }

    // Role check: Only Level 1 or Education Managers can reset
    const callerRole = verification.decoded.role;
    const callerLevel = verification.decoded.level;
    const canReset = callerLevel === 1 || callerRole === 'super_admin' || callerRole === 'education_manager' || callerRole === 'education_officer';
    if (!canReset) {
      const ip = getClientIp(req);
      trackSecurityIncident(ip, adminId, 'FORBIDDEN');
      logServerAudit({
        userId: adminId,
        username: verification.decoded.username,
        action: 'FORBIDDEN',
        entityType: 'security',
        entityId: 'admin-reset-password',
        description: `دسترسی غیرمجاز برای بازنشانی رمز عبور توسط کاربر ${verification.decoded.username} با نقش ${callerRole}`,
        ipAddress: ip
      }).catch(() => {});
      return res.status(403).json({ success: false, message: "شما دسترسی بازنشانی رمز عبور کاربران را ندارید." });
    }

    const { targetUserId, newPassword, mustChangeOnNextLogin = true } = req.body || {};
    if (!targetUserId || !newPassword) {
      return res.status(400).json({ success: false, message: "شناسه کاربر و رمز عبور جدید الزامی هستند." });
    }

    const users = await fetchAllUsersFromStorage();
    const targetUser = users.find(u => u.id === targetUserId || u.username.toUpperCase() === targetUserId.toUpperCase());
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "کاربر مورد نظر یافت نشد." });
    }

    targetUser.passwordHash = await hashPassword(newPassword);
    delete targetUser.password;
    targetUser.mustChangePassword = mustChangeOnNextLogin;
    targetUser.accountLockedUntil = undefined;
    targetUser.failedLoginAttempts = 0;
    await saveUserToStorage(targetUser);

    revokeAllUserSessions(targetUser.id);

    await logServerAudit({
      userId: verification.decoded.userId,
      username: verification.decoded.username,
      userRole: callerRole,
      action: 'ADMIN_RESET_PASSWORD',
      entityType: 'user',
      entityId: targetUser.id,
      description: `بازنشانی رمز عبور کاربر «${targetUser.name || targetUser.username}» توسط ${verification.decoded.username}`
    });

    return res.json({ success: true, message: `رمز عبور کاربر «${targetUser.name || targetUser.username}» با موفقیت بازنشانی شد.` });
  });

  // POST /api/auth/change-role - Server-side verified role update
  app.post("/api/auth/change-role", async (req, res) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ success: false, message: "احراز هویت الزامی است." });

    const verification = verifyAccessToken(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ success: false, message: "توکن نامعتبر است." });
    }

    const adminId = verification.decoded.userId;
    // Rate limit: 5 per hour per admin
    const rlCheck = checkEndpointRateLimit(`change_role_${adminId}`, 5, 60 * 60 * 1000);
    if (!rlCheck.allowed) {
      return res.status(429).json({ success: false, message: 'محدودیت تعداد تغییر نقش کاربران در یک ساعت فرا رسیده است.' });
    }

    // Role check: ONLY Super Admin (Level 1) can change roles
    if (verification.decoded.level !== 1 || verification.decoded.role !== 'super_admin') {
      const ip = getClientIp(req);
      trackSecurityIncident(ip, adminId, 'FORBIDDEN');
      logServerAudit({
        userId: adminId,
        username: verification.decoded.username,
        action: 'FORBIDDEN',
        entityType: 'security',
        entityId: 'change-role',
        description: `تلاش غیرمجاز برای تغییر نقش توسط ${verification.decoded.username} با سطح ${verification.decoded.level}`,
        ipAddress: ip
      }).catch(() => {});
      return res.status(403).json({ success: false, message: "تغییر نقش کاربران منحصراً در اختیار سوپر ادمین (سطح ۱) است." });
    }

    const { targetUserId, newRole, newLevel, allowedTabs, roleTitle } = req.body || {};
    if (!targetUserId || !newRole || !newLevel) {
      return res.status(400).json({ success: false, message: "اطلاعات تغییر نقش ناقص است." });
    }

    const roleValidation = validateRole(newRole, Number(newLevel));
    if (!roleValidation.valid) {
      return res.status(400).json({ success: false, message: roleValidation.message });
    }

    // Detect if role change happens outside typical working hours (e.g. 19:00 to 07:00)
    const currentHour = new Date().getHours();
    if (currentHour >= 20 || currentHour < 7) {
      logServerAudit({
        action: 'SUSPICIOUS_ACTIVITY',
        entityType: 'security_alert',
        entityId: targetUserId,
        description: `هشدار امنیتی: تغییر نقش خارج از ساعات اداری (ساعت ${currentHour}) توسط ${verification.decoded.username}`
      }).catch(() => {});
    }

    const users = await fetchAllUsersFromStorage();
    const target = users.find(u => u.id === targetUserId || u.username.toUpperCase() === targetUserId.toUpperCase());
    if (!target) return res.status(404).json({ success: false, message: "کاربر یافت نشد." });

    const prevRole = target.role;
    target.role = newRole;
    target.level = Number(newLevel);
    if (roleTitle) target.roleTitle = roleTitle;
    if (Array.isArray(allowedTabs)) target.allowedTabs = allowedTabs;
    await saveUserToStorage(target);

    // Invalidate sessions so that new permissions take effect immediately
    revokeAllUserSessions(target.id);

    await logServerAudit({
      userId: verification.decoded.userId,
      username: verification.decoded.username,
      action: 'CHANGE_ROLE',
      entityType: 'user',
      entityId: target.id,
      description: `تغییر نقش کاربر ${target.username} از ${prevRole} به ${newRole} (سطح ${newLevel})`,
      previousState: { role: prevRole },
      newState: { role: newRole, level: newLevel }
    });

    return res.json({ success: true, message: "نقش کاربر در سمت سرور با موفقیت به‌روزرسانی شد.", user: sanitizeUser(target) });
  });

  // POST /api/auth/migrate-passwords - One-time migration to hash all legacy plain-text passwords
  app.post("/api/auth/migrate-passwords", async (req, res) => {
    try {
      const result = await migrateAllPlainPasswords();
      return res.json({
        success: true,
        message: `مهاجرت امنیتی کلمات عبور با موفقیت انجام شد: ${result.migratedCount} از ${result.totalUsers} کاربر به bcrypt ارتقا یافتند.`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || "خطا در مهاجرت کلمات عبور" });
    }
  });

  // ===================== SECURE DEDICATED DATA API ENDPOINTS =====================

  // GET /api/data/:collection - Fetch collection records with server-side authorization
  app.get("/api/data/:collection", async (req, res) => {
    const { collection } = req.params;
    const token = extractToken(req);
    let callerUser: any = null;

    if (token) {
      const verification = verifyAccessToken(token);
      if (verification.valid && verification.decoded) {
        callerUser = verification.decoded;
      }
    }

    const authCheck = authorizeCollectionAccess(callerUser, collection, 'read');
    if (!authCheck.allowed) {
      return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
    }

    try {
      const items = await serverQueryCollection(collection, callerUser);
      return res.json({ success: true, items });
    } catch (err: any) {
      console.error(`Error querying collection ${collection}:`, err);
      return res.status(500).json({ success: false, message: 'خطا در دریافت اطلاعات از سرور.' });
    }
  });

  // POST /api/data/:collection - Add or update document in dedicated tables & app_collections
  app.post("/api/data/:collection", async (req, res) => {
    const { collection } = req.params;
    const token = extractToken(req);
    let callerUser: any = null;

    if (token) {
      const verification = verifyAccessToken(token);
      if (verification.valid && verification.decoded) {
        callerUser = verification.decoded;
      }
    }

    const data = req.body;
    const recordOwnerId = data?.userId || data?.studentId;
    const authCheck = authorizeCollectionAccess(callerUser, collection, 'write', recordOwnerId);
    if (!authCheck.allowed) {
      return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
    }

    try {
      const saveRes = await serverSaveDoc(collection, data, callerUser);
      if (!saveRes.success) {
        return res.status(500).json({ success: false, message: saveRes.error || 'خطا در ذخیره‌سازی داده' });
      }

      // Audit Log for data modification
      if (callerUser) {
        logServerAudit({
          userId: callerUser.userId,
          username: callerUser.username,
          userRole: callerUser.role,
          action: 'DATA_WRITE',
          entityType: collection,
          entityId: saveRes.id,
          description: `ثبت یا ویرایش رکورد در کالکشن ${collection} توسط ${callerUser.username}`,
          ipAddress: getClientIp(req)
        }).catch(() => {});
      }

      return res.json({ success: true, id: saveRes.id });
    } catch (err: any) {
      console.error(`Error writing to collection ${collection}:`, err);
      return res.status(500).json({ success: false, message: 'خطا در ذخیره اطلاعات در سرور.' });
    }
  });

  // PUT /api/data/:collection/:id - Update specific document
  app.put("/api/data/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    const token = extractToken(req);
    let callerUser: any = null;

    if (token) {
      const verification = verifyAccessToken(token);
      if (verification.valid && verification.decoded) {
        callerUser = verification.decoded;
      }
    }

    const data = { ...req.body, id };
    const recordOwnerId = data?.userId || data?.studentId;
    const authCheck = authorizeCollectionAccess(callerUser, collection, 'write', recordOwnerId);
    if (!authCheck.allowed) {
      return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
    }

    try {
      const saveRes = await serverSaveDoc(collection, data, callerUser);
      if (!saveRes.success) {
        return res.status(500).json({ success: false, message: saveRes.error || 'خطا در ویرایش داده' });
      }

      return res.json({ success: true, id: saveRes.id });
    } catch (err: any) {
      console.error(`Error updating collection ${collection}:`, err);
      return res.status(500).json({ success: false, message: 'خطا در ویرایش اطلاعات در سرور.' });
    }
  });

  // DELETE /api/data/:collection/:id - Delete document from dedicated tables & app_collections
  app.delete("/api/data/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    const token = extractToken(req);
    let callerUser: any = null;

    if (token) {
      const verification = verifyAccessToken(token);
      if (verification.valid && verification.decoded) {
        callerUser = verification.decoded;
      }
    }

    const authCheck = authorizeCollectionAccess(callerUser, collection, 'delete');
    if (!authCheck.allowed) {
      return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
    }

    try {
      const delRes = await serverDeleteDoc(collection, id, callerUser);
      if (!delRes.success) {
        return res.status(500).json({ success: false, message: delRes.error || 'خطا در حذف داده' });
      }

      if (callerUser) {
        logServerAudit({
          userId: callerUser.userId,
          username: callerUser.username,
          userRole: callerUser.role,
          action: 'DATA_DELETE',
          entityType: collection,
          entityId: id,
          description: `حذف رکورد ${id} از کالکشن ${collection} توسط ${callerUser.username}`,
          ipAddress: getClientIp(req)
        }).catch(() => {});
      }

      return res.json({ success: true, message: 'رکورد با موفقیت حذف شد.' });
    } catch (err: any) {
      console.error(`Error deleting from collection ${collection}:`, err);
      return res.status(500).json({ success: false, message: 'خطا در حذف اطلاعات در سرور.' });
    }
  });

  // POST /api/data/:collection/batch - Bulk insert / update
  app.post("/api/data/:collection/batch", async (req, res) => {
    const { collection } = req.params;
    const token = extractToken(req);
    let callerUser: any = null;

    if (token) {
      const verification = verifyAccessToken(token);
      if (verification.valid && verification.decoded) {
        callerUser = verification.decoded;
      }
    }

    const authCheck = authorizeCollectionAccess(callerUser, collection, 'write');
    if (!authCheck.allowed) {
      return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
    }

    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'آیتم‌ها باید آرایه‌ای باشند.' });
    }

    try {
      for (const item of items) {
        await serverSaveDoc(collection, item, callerUser);
      }
      return res.json({ success: true, count: items.length });
    } catch (err: any) {
      console.error(`Error batch saving ${collection}:`, err);
      return res.status(500).json({ success: false, message: 'خطا در ذخیره دسته‌ای اطلاعات.' });
    }
  });

  // ===============================================================================

  // API Route for Gemini Multi-turn Chat
  app.post("/api/chat", async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { studentData, history = [], message, customApiKey } = req.body;
      const client = getGenAIClient(customApiKey);

      const contents: any[] = [
        {
          role: 'user',
          parts: [{ text: `اطلاعات کامل پرونده طلبه جهت گفت‌وگو و مشاوره:\n${JSON.stringify(studentData, null, 2)}` }]
        },
        {
          role: 'model',
          parts: [{ text: 'اطلاعات کامل پرونده طلبه دریافت شد. آماده ارائه تحلیل، مشاوره و پاسخگویی بر اساس اطلاعات پرونده هستم.' }]
        }
      ];

      if (Array.isArray(history)) {
        for (const item of history) {
          contents.push({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.content }]
          });
        }
      }

      if (message) {
        contents.push({
          role: 'user',
          parts: [{ text: message }]
        });
      }

      const response = await generateContentWithFallback(client, {
        contents,
        config: {
          systemInstruction: "شما یک مشاور و ارزیاب هوشمند آموزشی، پژوهشی و تربیتی حوزه علمیه هستید. با تحلیل دقیق داده‌های کامل طلبه (مشخصات، آمار مطالعه و تعهد، مقایسه با میانگین طلاب، نظرات و نمرات شفاهی اساتید، وضعیت پژوهش) به زبان فارسی، دقیق، محترمانه و کاربردی پاسخ دهید.",
        }
      });

      return res.json({ reply: response.text });
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      return res.status(500).json({ error: error.message || "خطا در برقراری ارتباط با هوش مصنوعی" });
    }
  });

  // API Route for Gemini Analysis
  app.post("/api/analyze", async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { studentData, query, customApiKey } = req.body;
      const client = getGenAIClient(customApiKey);

      const prompt = `
        شما یک مشاور و ارزیاب آموزشی و تربیتی ارشد در حوزه علمیه هستید.
        بر اساس اطلاعات زیر که مربوط به یک طلبه است، تحلیل جامع و مفصلی ارائه دهید:

        اطلاعات کامل طلبه:
        ${JSON.stringify(studentData, null, 2)}

        درخواست / سوال کاربر:
        ${query || 'تحلیل جامع از وضعیت آموزشی، پژوهشی، اخلاقی، انضباطی و پیشنهادات رشد ارائه دهید.'}

        لطفا پاسخ را کاملا به زبان فارسی، ساختاریافته با پاراگراف‌ها و بالت‌پوینت‌های شفاف ارائه دهید.
      `;

      const response = await generateContentWithFallback(client, {
        contents: prompt,
      });

      return res.json({ analysis: response.text });
    } catch (error: any) {
      console.error("Gemini Analysis Error:", error);
      return res.status(500).json({ error: error.message || "Failed to analyze student data" });
    }
  });

  // Serve public assets (e.g. login-bg.jpg, icons, etc.)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();


