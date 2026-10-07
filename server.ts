import express from "express";
import path from "path";

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});
import cookieParser from "cookie-parser";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// 1. Core Modular Routers (Stage 1 to 9 Architecture)
import authRoutes from "./src/routes/authRoutes";
import studentRoutes from "./src/routes/studentRoutes";
import teacherRoutes from "./src/routes/teacherRoutes";
import programRoutes from "./src/routes/programRoutes";
import classroomRoutes from "./src/routes/classroomRoutes";
import tuitionRoutes from "./src/routes/tuitionRoutes";
import loanRoutes from "./src/routes/loanRoutes";
import expenseRoutes from "./src/routes/expenseRoutes";
import attendanceRoutes from "./src/routes/attendanceRoutes";
import studyRoutes from "./src/routes/studyRoutes";
import researchRoutes from "./src/routes/researchRoutes";
import oralExamRoutes from "./src/routes/oralExamRoutes";
import lockerRoutes from "./src/routes/lockerRoutes";
import calendarRoutes from "./src/routes/calendarRoutes";
import mealRoutes from "./src/routes/mealRoutes";
import studentRequestRoutes from "./src/routes/studentRequestRoutes";
import transportRoutes from "./src/routes/transportRoutes";
import courseSelectionRoutes from "./src/routes/courseSelectionRoutes";
import counselingRoutes from "./src/routes/counselingRoutes";
import dataRoutes from "./src/routes/dataRoutes";
import systemRoutes from "./src/routes/systemRoutes";
import auditRoutes from "./src/routes/auditRoutes";

// 2. Cross-cutting Infrastructure
import { logger, requestLogger } from "./src/lib/logger";
import { globalErrorHandler } from "./src/lib/errorHandler";
import { startMemoryMonitor } from "./src/lib/memoryMonitor";
import { startSystemHealthMonitor } from "./src/lib/systemHealthMonitor";
import { BUILD_INFO } from "./src/lib/buildInfo";
import { fetchAllUsersFromStorage, comparePassword, normalizeDigits } from "./src/lib/serverAuth";

dotenv.config();

// Enforce port 3000 for development
const PORT = process.env.NODE_ENV === 'production' 
  ? parseInt(process.env.PORT || "8080", 10) 
  : 3000;

async function startServer() {
  const app = express();

  // Trust reverse proxy (Liara / Nginx / Cloudflare)
  app.set("trust proxy", 1);

  // Helmet HTTP Security Headers
  app.use(helmet({ contentSecurityPolicy: false }));

  // Cross-Origin Resource Sharing (CORS) Configuration
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-TOKEN'],
  }));

  // Compression Middleware (excluding SSE stream /api/sync/events)
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['accept'] === 'text/event-stream' || req.path.includes('/sync/events')) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Standard Body Parsing & Cookie Parser
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());

  // Structured Logging for all Incoming Requests
  app.use(requestLogger);

  // Unauthenticated diagnostic endpoints for version tracking and container health checks (MOVED TO TOP BEFORE ALL ROUTERS)
  app.get('/api/version', (_req, res) => {
    res.json({
      commit: BUILD_INFO.version,
      buildTime: BUILD_INFO.buildTime,
      features: BUILD_INFO.features,
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'production',
      startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    });
  });

  app.get('/api/healthz', (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  // Test Authentication Diagnostic Endpoint (Temporary for debugging)
  app.get('/api/test-auth-debug', async (req, res) => {
    const rawUsername = String(req.query.username || 'SADEGH');
    const rawPassword = String(req.query.password || '');

    const normUser = normalizeDigits(rawUsername).trim().toUpperCase();
    const normPass = normalizeDigits(rawPassword).trim();

    let userInDb = null;
    let bcryptCompareResult = false;
    let hashStart = null;
    let errorMsg = null;

    try {
      const users = await fetchAllUsersFromStorage();
      const found = users.find(u => u.username?.toUpperCase() === normUser);

      if (found) {
        userInDb = {
          id: found.id,
          username: found.username,
          role: found.role,
          mustChangePassword: found.mustChangePassword,
          hasPasswordHash: Boolean(found.passwordHash),
          hasPasswordPlain: Boolean(found.password)
        };

        const hashToTest = found.passwordHash || found.password || '';
        if (hashToTest) {
          hashStart = hashToTest.substring(0, 20);
          bcryptCompareResult = await comparePassword(normPass, hashToTest);
        }
      }
    } catch (err: any) {
      errorMsg = err?.message || String(err);
    }

    return res.json({
      input: { rawUsername, rawPassword },
      normalized: { normUser, normPass },
      userFoundInDb: Boolean(userInDb),
      userRecord: userInDb,
      hashFirst20Chars: hashStart,
      bcryptCompareResult,
      error: errorMsg
    });
  });

  // Mount Modular Application Routers
  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/teachers', teacherRoutes);
  app.use('/api/programs', programRoutes);
  app.use('/api/classrooms', classroomRoutes);
  app.use('/api/tuition', tuitionRoutes);
  app.use('/api/loans', loanRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/study', studyRoutes);
  app.use('/api/research', researchRoutes);
  app.use('/api/oral-exams', oralExamRoutes);
  app.use('/api/lockers', lockerRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/meals', mealRoutes);
  app.use('/api/requests', studentRequestRoutes);
  app.use('/api/transport', transportRoutes);
  app.use('/api/course-selection', courseSelectionRoutes);
  app.use('/api/counseling', counselingRoutes);
  app.use('/api/system', systemRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api', dataRoutes);

  // System Health Check Endpoint
  app.get("/health", (_req, res) => {
    try {
      const memory = process.memoryUsage();
      return res.status(200).json({
        status: "ok",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        version: "1.0.1",
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || "development",
        memory: {
          rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
          heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
          heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        },
        services: {
          mysqlConfigured: Boolean(process.env.MYSQL_DATABASE || process.env.DB_DATABASE),
          supabaseConfigured: Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_SECRET_KEY),
        }
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Health check failed";
      return res.status(503).json({ status: "error", message });
    }
  });

  // Serve Static Assets (Public Directory)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Client SPA Serving & Dev Server Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('index.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Universal Global Error Handler for API routes
  app.use(globalErrorHandler);

  // Ensure critical database performance indexes and test connection before accepting incoming requests
  try {
    const { isMysqlConfigured, validateMysqlConfig, testMysqlConnection, ensurePerformanceIndexes } = await import("./src/lib/databaseAbstraction");
    if (isMysqlConfigured) {
      console.log('[Startup] Validating MySQL Configuration...');
      const validation = validateMysqlConfig();
      if (validation.isValid) {
        console.log('[Startup] Testing MySQL Connection...');
        const isOk = await testMysqlConnection();
        if (isOk) {
          console.log('[Startup] MySQL connected successfully! Creating schemas/indexes...');
          await ensurePerformanceIndexes();
        } else {
          console.error('[Startup Error] MySQL database is not reachable right now. Server will start, but db-status endpoint should be checked.');
        }
      } else {
        console.error('[Startup Error] MySQL configuration is invalid. Please check your environment variables.');
      }
    }
  } catch (idxErr: any) {
    logger.warn('[Startup] Database initialization notice:', idxErr?.message || idxErr);
  }

  console.log('BOOT', {
    timestamp: new Date().toISOString(),
    version: process.env.GIT_COMMIT || 'unknown',
    nodeVersion: process.version,
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`[Production Server] running on http://0.0.0.0:${PORT}`);
    
    // Automated memory monitoring
    startMemoryMonitor(5 * 60 * 1000, 450);
    startSystemHealthMonitor(10 * 60 * 1000);

    // Automated database backup scheduler
    import('./src/lib/serverBackupEngine').then(mod => {
      mod.initScheduledBackupService();
      logger.info('[System] Automated database backup scheduler initialized.');
    }).catch(() => {});

    // Automated 24-hour audit logs cleanup scheduler (purges logs older than 30 days)
    setInterval(async () => {
      try {
        const { getMysqlPool } = await import('./src/lib/databaseAbstraction');
        const pool = getMysqlPool();
        if (pool) {
          const [res]: any = await pool.execute(`DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`);
          logger.info(`[Audit Cron] Automated 30-day cleanup purged ${res?.affectedRows || 0} old audit logs.`);
        }
      } catch (e) {
        logger.warn('[Audit Cron Notice] Automated cleanup notice:', e);
      }
    }, 24 * 60 * 60 * 1000);
  });

  // Graceful Shutdown Handlers
  const handleShutdown = (signal: string) => {
    logger.warn(`[Process] Received ${signal}. Starting graceful shutdown...`);
    server.close(() => {
      logger.info('[Process] HTTP server closed gracefully.');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('[Process] Forcefully terminating server after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

// Global Safety Nets for Uncaught Process Errors
process.on("uncaughtException", (error) => {
  logger.error("[CRITICAL FATAL EXCEPTION]", error);
});

process.on("unhandledRejection", (reason) => {
  logger.error("[CRITICAL UNHANDLED REJECTION]", reason);
});

startServer();

// Final Diagnostic & Secure MySQL deployment trigger


// Deployment trigger comment for Runflare redeploy
// Deployment sync trigger

