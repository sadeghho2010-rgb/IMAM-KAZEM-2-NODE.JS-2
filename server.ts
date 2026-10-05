import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
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

// 2. Cross-cutting Infrastructure
import { logger, requestLogger } from "./src/lib/logger";
import { globalErrorHandler } from "./src/lib/errorHandler";
import { startMemoryMonitor } from "./src/lib/memoryMonitor";
import { startSystemHealthMonitor } from "./src/lib/systemHealthMonitor";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3000", 10);

async function startServer() {
  const app = express();

  // Trust reverse proxy (Liara / Nginx / Cloudflare)
  app.set("trust proxy", 1);

  // Cross-Origin Resource Sharing (CORS) Configuration
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-TOKEN'],
  }));

  // Standard Body Parsing & Cookie Parser
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());

  // Structured Logging for all Incoming Requests
  app.use(requestLogger);

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
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
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

// Deployment trigger comment for Runflare redeploy

