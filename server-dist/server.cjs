var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/lib/logger.ts
function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 9);
  req.requestId = requestId;
  res.on("finish", () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${duration}ms`;
    if (res.statusCode >= 500) {
      logger.error(message, { requestId, ip: req.ip, duration });
    } else if (res.statusCode >= 400) {
      logger.warn(message, { requestId, ip: req.ip, duration });
    } else {
      logger.info(message, { requestId, duration });
    }
  });
  next();
}
async function persistErrorLog(params) {
  const { endpoint, method, userId, errorMessage, stackTrace, ipAddress } = params;
  const id = "err_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
  const logEntry = {
    id,
    endpoint,
    method,
    userId,
    errorMessage,
    stackTrace,
    ipAddress,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    const errorFile = import_path.default.join(logDir, "database_error_logs.json");
    let existing = [];
    if (import_fs.default.existsSync(errorFile)) {
      try {
        existing = JSON.parse(import_fs.default.readFileSync(errorFile, "utf-8"));
      } catch (e) {
        existing = [];
      }
    }
    existing.unshift(logEntry);
    if (existing.length > 500) existing = existing.slice(0, 500);
    import_fs.default.writeFileSync(errorFile, JSON.stringify(existing, null, 2), "utf-8");
  } catch (err) {
    logger.error("Failed to persist error log entry", { err });
  }
}
var import_winston, import_fs, import_path, logDir, logFormat, logger;
var init_logger = __esm({
  "src/lib/logger.ts"() {
    import_winston = __toESM(require("winston"), 1);
    import_fs = __toESM(require("fs"), 1);
    import_path = __toESM(require("path"), 1);
    logDir = import_path.default.join(process.cwd(), "logs");
    if (!import_fs.default.existsSync(logDir)) {
      import_fs.default.mkdirSync(logDir, { recursive: true });
    }
    logFormat = import_winston.default.format.combine(
      import_winston.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      import_winston.default.format.errors({ stack: true }),
      import_winston.default.format.json()
    );
    logger = import_winston.default.createLogger({
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      format: logFormat,
      defaultMeta: { service: "madrasah-backend" },
      transports: [
        new import_winston.default.transports.File({
          filename: import_path.default.join(logDir, "error.log"),
          level: "error",
          maxsize: 10 * 1024 * 1024,
          // 10MB max size per log file
          maxFiles: 5,
          // Keep up to 5 rotated files, automatic deletion of oldest
          tailable: true
        }),
        new import_winston.default.transports.File({
          filename: import_path.default.join(logDir, "combined.log"),
          maxsize: 10 * 1024 * 1024,
          // 10MB max size per log file
          maxFiles: 5,
          // Keep up to 5 rotated files, automatic deletion of oldest
          tailable: true
        }),
        new import_winston.default.transports.Console({
          format: import_winston.default.format.combine(
            import_winston.default.format.colorize(),
            import_winston.default.format.printf(({ timestamp, level, message, stack, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
              return `[${timestamp}] ${level}: ${message} ${stack ? "\n" + stack : ""} ${metaStr}`;
            })
          )
        })
      ]
    });
  }
});

// src/lib/systemHealthMonitor.ts
function getCpuUsage() {
  try {
    if (!osModule) return { percent: 0, cores: 1, model: "CPU", loadAvg: [0, 0, 0] };
    const currentCpus = osModule.cpus();
    const cores = currentCpus.length || 1;
    const model = currentCpus[0]?.model || "\u067E\u0631\u062F\u0627\u0632\u0646\u062F\u0647 \u0627\u0635\u0644\u06CC";
    const rawLoadAvg = osModule.loadavg() || [0, 0, 0];
    const loadAvg = rawLoadAvg.map((l) => Math.round(l * 100) / 100);
    let totalIdle = 0;
    let totalTick = 0;
    for (let i = 0; i < cores; i++) {
      const prev = previousCpus[i] || currentCpus[i];
      const curr = currentCpus[i];
      if (!prev || !curr) continue;
      for (const type in curr.times) {
        totalTick += curr.times[type] - prev.times[type];
      }
      totalIdle += curr.times.idle - prev.times.idle;
    }
    previousCpus = currentCpus;
    const idlePercent = totalTick > 0 ? totalIdle / totalTick : 1;
    let percent = Math.round((1 - idlePercent) * 100);
    if (totalTick === 0 && loadAvg && loadAvg[0] !== void 0 && cores > 0) {
      percent = Math.min(100, Math.round(loadAvg[0] / cores * 100));
    }
    if (isNaN(percent) || percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    return {
      percent,
      cores,
      model,
      loadAvg
    };
  } catch (e) {
    return {
      percent: 0,
      cores: os.cpus()?.length || 1,
      model: "CPU",
      loadAvg: [0, 0, 0]
    };
  }
}
function getOsMemoryInfo() {
  return new Promise((resolve) => {
    exec("free -h", (error, stdout) => {
      if (error || !stdout) {
        return resolve("\u0627\u0637\u0644\u0627\u0639\u0627\u062A RAM \u0633\u06CC\u0633\u062A\u0645 \u0639\u0627\u0645\u0644 \u0642\u0627\u0628\u0644 \u062F\u0631\u06CC\u0627\u0641\u062A \u0646\u06CC\u0633\u062A.");
      }
      resolve(stdout.trim());
    });
  });
}
function readLastLogEntries(filePath, maxEntries) {
  if (!fs2.existsSync(filePath)) {
    return [];
  }
  try {
    const fileContent = fs2.readFileSync(filePath, "utf-8");
    const lines = fileContent.split("\n").filter((line) => line.trim() !== "");
    const lastLines = lines.slice(-maxEntries);
    const parsedEntries = [];
    for (const line of lastLines) {
      try {
        parsedEntries.push(JSON.parse(line));
      } catch (err) {
        parsedEntries.push({
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          message: line
        });
      }
    }
    return parsedEntries;
  } catch (err) {
    console.error(`Error reading log file ${filePath}:`, err);
    return [];
  }
}
async function recordMemorySnapshot() {
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100;
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100;
  const rssMb = Math.round(mem.rss / 1024 / 1024 * 100) / 100;
  const externalMb = Math.round(mem.external / 1024 / 1024 * 100) / 100;
  const freeOsMemInfo = await getOsMemoryInfo();
  const snapshot = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    heapUsedMb,
    heapTotalMb,
    rssMb,
    externalMb,
    freeOsMemInfo
  };
  try {
    fs2.appendFileSync(memoryLogFile, JSON.stringify(snapshot) + "\n", "utf-8");
    const stats = fs2.statSync(memoryLogFile);
    if (stats.size > 2 * 1024 * 1024) {
      const content = fs2.readFileSync(memoryLogFile, "utf-8");
      const lines = content.split("\n").filter(Boolean);
      if (lines.length > 500) {
        fs2.writeFileSync(memoryLogFile, lines.slice(-288).join("\n") + "\n", "utf-8");
      }
    }
  } catch (err) {
    console.error("Failed to write to memory.log:", err);
  }
  return snapshot;
}
function logSlowQuery(collection, durationMs, querySnippet) {
  if (durationMs < 1e3) return;
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    collection: collection || "General DB",
    durationMs: Math.round(durationMs),
    querySnippet: querySnippet ? querySnippet.substring(0, 300) : "N/A"
  };
  try {
    fs2.appendFileSync(slowQueryLogFile, JSON.stringify(entry) + "\n", "utf-8");
    logger.warn(`[SlowQuery] ${collection} query took ${durationMs}ms: ${entry.querySnippet}`);
  } catch (err) {
    console.error("Failed to log slow query:", err);
  }
}
function logServerError(message, stack, source) {
  logger.error(`[ServerErrorLog] ${message}`, { source, stack });
}
function startSystemHealthMonitor(intervalMs = 10 * 60 * 1e3) {
  if (monitorTimer) clearInterval(monitorTimer);
  recordMemorySnapshot().catch(() => {
  });
  monitorTimer = setInterval(() => {
    recordMemorySnapshot().catch(() => {
    });
  }, intervalMs);
  if (monitorTimer.unref) monitorTimer.unref();
  logger.info("[SystemHealthMonitor] Automated 10-min memory logger to file initialized.");
}
function getSystemHealthReport() {
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100;
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100;
  const rssMb = Math.round(mem.rss / 1024 / 1024 * 100) / 100;
  const externalMb = Math.round(mem.external / 1024 / 1024 * 100) / 100;
  const memoryHistory = readLastLogEntries(memoryLogFile, 144);
  let peakHeap24hMb = heapUsedMb;
  for (const s of memoryHistory) {
    if (s.heapUsedMb > peakHeap24hMb) {
      peakHeap24hMb = s.heapUsedMb;
    }
  }
  const slowQueries = readLastLogEntries(slowQueryLogFile, 20).reverse();
  const rawErrors = readLastLogEntries(errorLogFile, 20).reverse();
  const recentErrors = rawErrors.map((err) => ({
    timestamp: err.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
    message: err.message || JSON.stringify(err),
    stack: err.stack,
    source: err.service || "madrasah-backend"
  }));
  const freeOsMemInfo = memoryHistory[memoryHistory.length - 1]?.freeOsMemInfo || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0645\u0648\u062C\u0648\u062F \u0646\u06CC\u0633\u062A";
  const currentCpu = getCpuUsage();
  return {
    currentMemory: {
      heapUsedMb,
      heapTotalMb,
      rssMb,
      externalMb,
      heapUsagePercent: Math.round(heapUsedMb / heapTotalMb * 100),
      freeOsMemInfo
    },
    currentCpu,
    peakHeap24hMb,
    memoryHistory,
    slowQueries,
    recentErrors,
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || "development",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var isNode, execFn, fsModule, pathModule, osModule, fs2, os, exec, logDir2, memoryLogFile, slowQueryLogFile, errorLogFile, previousCpus, monitorTimer;
var init_systemHealthMonitor = __esm({
  "src/lib/systemHealthMonitor.ts"() {
    init_logger();
    isNode = typeof window === "undefined" && typeof process !== "undefined" && process.versions && process.versions.node;
    execFn = null;
    fsModule = null;
    pathModule = null;
    osModule = null;
    if (isNode) {
      try {
        execFn = eval("require")("child_process").exec;
        fsModule = eval("require")("fs");
        pathModule = eval("require")("path");
        osModule = eval("require")("os");
      } catch (e) {
      }
    }
    fs2 = fsModule || {};
    os = osModule || {};
    exec = execFn || ((_cmd, cb) => cb && cb(new Error("not node")));
    logDir2 = pathModule ? pathModule.join(process.cwd(), "logs") : "/tmp/logs";
    memoryLogFile = pathModule ? pathModule.join(logDir2, "memory.log") : "";
    slowQueryLogFile = pathModule ? pathModule.join(logDir2, "slow_queries.log") : "";
    errorLogFile = pathModule ? pathModule.join(logDir2, "error.log") : "";
    if (fsModule && !fsModule.existsSync(logDir2)) {
      try {
        fsModule.mkdirSync(logDir2, { recursive: true });
      } catch (e) {
      }
    }
    previousCpus = osModule ? osModule.cpus() : [];
    monitorTimer = null;
  }
});

// src/lib/databaseAbstraction.ts
var databaseAbstraction_exports = {};
__export(databaseAbstraction_exports, {
  MysqlRepository: () => MysqlRepository,
  ensurePerformanceIndexes: () => ensurePerformanceIndexes,
  executeMysqlQuery: () => executeMysqlQuery,
  getDbConnectionStatus: () => getDbConnectionStatus,
  getMysqlPool: () => getMysqlPool,
  isMysqlConfigured: () => isMysqlConfigured,
  parseMysqlConfig: () => parseMysqlConfig,
  recordLoginAuditInDb: () => recordLoginAuditInDb,
  sanitizeRecordForDb: () => sanitizeRecordForDb,
  testMysqlConnection: () => testMysqlConnection,
  translateMysqlError: () => translateMysqlError,
  validateMysqlConfig: () => validateMysqlConfig
});
function sanitizeRecordForDb(data) {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(sanitizeRecordForDb);
  const copy = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val === void 0) continue;
    if (typeof val === "string" && val.startsWith("data:image/") && val.length > 5e5) {
      copy[key] = val.substring(0, 100) + "...[photo_truncated]";
      continue;
    }
    copy[key] = val;
  }
  return copy;
}
function parseMysqlConfig() {
  const env = process.env;
  let host = "";
  let port = Number(env.MYSQL_PORT || env.MYSQLPORT || env.DB_PORT) || 3306;
  let user = env.MYSQL_USER || env.MYSQLUSER || env.DB_USER || env.DB_USERNAME || "";
  let password = env.MYSQL_PASSWORD || env.MYSQLPASSWORD || env.DB_PASSWORD || env.DB_PASS || "";
  let database = env.MYSQL_DATABASE || env.MYSQLDATABASE || env.DB_DATABASE || env.DB_NAME || "";
  const connectionUrl = env.DATABASE_URL || env.MYSQL_URL || "";
  if (connectionUrl && (connectionUrl.startsWith("mysql://") || connectionUrl.startsWith("mysql2://"))) {
    try {
      const parsed = new URL(connectionUrl);
      host = parsed.hostname || "";
      if (parsed.port) port = Number(parsed.port) || 3306;
      if (parsed.username) user = decodeURIComponent(parsed.username);
      if (parsed.password) password = decodeURIComponent(parsed.password);
      if (parsed.pathname) database = parsed.pathname.replace(/^\//, "") || database;
    } catch (e) {
      console.error("[MySQL Config] Error parsing DATABASE_URL / MYSQL_URL:", e);
    }
  }
  if (!host) {
    host = env.DB_HOST || env.MYSQL_HOST || env.MYSQLHOST || env.DB_HOSTNAME || "";
  }
  const isConfigured = Boolean(host && database);
  return { isConfigured, host, port, user, password, database };
}
function getDbConnectionStatus() {
  const conf = parseMysqlConfig();
  return {
    connected: isCurrentlyConnected,
    host: conf.host || "",
    port: conf.port || 3306,
    database: conf.database || "",
    user: conf.user || "",
    lastError: lastConnectionError
  };
}
function translateMysqlError(err) {
  const code = err?.code || "";
  const message = err?.message || String(err);
  if (code === "ENOTFOUND" || message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
    return "\u062E\u0637\u0627: \u0622\u062F\u0631\u0633 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F. \u0645\u0642\u062F\u0627\u0631 DB_HOST \u0631\u0627 \u0686\u06A9 \u06A9\u0646\u06CC\u062F.";
  }
  if (code === "ER_ACCESS_DENIED_ERROR" || err?.errno === 1045 || message.includes("Access denied")) {
    return "\u062E\u0637\u0627: \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u06CC\u0627 \u0631\u0645\u0632 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0627\u0634\u062A\u0628\u0627\u0647 \u0627\u0633\u062A.";
  }
  if (code === "ECONNREFUSED" || message.includes("ECONNREFUSED")) {
    return "\u062E\u0637\u0627: \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A.";
  }
  if (code === "ETIMEDOUT" || message.includes("ETIMEDOUT") || message.includes("timeout")) {
    return "\u062E\u0637\u0627: \u0632\u0645\u0627\u0646 \u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u062A\u0645\u0627\u0645 \u0634\u062F.";
  }
  return `\u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 MySQL: ${message}`;
}
function validateMysqlConfig() {
  const conf = parseMysqlConfig();
  const errors = [];
  if (!conf.host) {
    errors.push("[MySQL Config Error] DB_HOST is empty or invalid");
  } else {
    const hostPattern = /^[a-zA-Z0-9.\-_]+$/;
    if (!hostPattern.test(conf.host)) {
      errors.push(`[MySQL Config Error] DB_HOST "${conf.host}" contains invalid characters`);
    }
  }
  if (!conf.port || isNaN(conf.port) || conf.port < 1 || conf.port > 65535) {
    errors.push(`[MySQL Config Error] DB_PORT "${conf.port}" is invalid (must be between 1 and 65535)`);
  }
  if (!conf.database) {
    errors.push("[MySQL Config Error] DB_DATABASE is not set");
  }
  if (!conf.user) {
    errors.push("[MySQL Config Error] DB_USERNAME is not set");
  }
  if (!conf.password) {
    errors.push("[MySQL Config Error] DB_PASSWORD is not set");
  }
  const isValid = errors.length === 0;
  if (!isValid) {
    errors.forEach((err) => console.error(err));
  }
  return { isValid, errors };
}
async function testMysqlConnection() {
  const mysqlPool = getMysqlPool();
  if (!mysqlPool) {
    isCurrentlyConnected = false;
    if (!lastConnectionError) {
      lastConnectionError = "MySQL is not configured or configuration validation failed.";
    }
    return false;
  }
  try {
    const connection = await mysqlPool.getConnection();
    await connection.ping();
    connection.release();
    isCurrentlyConnected = true;
    lastConnectionError = null;
    return true;
  } catch (err) {
    isCurrentlyConnected = false;
    lastConnectionError = translateMysqlError(err);
    console.error(`[MySQL Connection Test Failed]: ${lastConnectionError}`);
    return false;
  }
}
async function ensurePerformanceIndexes(p) {
  const mysqlPool = p || getMysqlPool();
  if (!mysqlPool) return;
  if (hasEnsuredIndexes) return;
  hasEnsuredIndexes = true;
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`app_collections\` (
        \`collection_name\` VARCHAR(100) NOT NULL,
        \`id\` VARCHAR(100) NOT NULL,
        \`data\` JSON NOT NULL,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`collection_name\`, \`id\`),
        INDEX \`idx_collection_updated\` (\`collection_name\`, \`updated_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e) {
    console.warn("[MySQL Schema Notice - app_collections]:", e?.message || e);
  }
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`system_users\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`username\` VARCHAR(100) NOT NULL,
        \`password_hash\` VARCHAR(255) NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`role\` VARCHAR(50) NOT NULL DEFAULT 'student',
        \`role_title\` VARCHAR(100) NULL,
        \`avatar_url\` VARCHAR(500) NULL,
        \`level\` INT NOT NULL DEFAULT 3,
        \`grade_label\` VARCHAR(100) NULL,
        \`mentor_id\` VARCHAR(100) NULL,
        \`student_id\` VARCHAR(100) NULL,
        \`linked_student_id\` VARCHAR(100) NULL,
        \`avatar_bg\` VARCHAR(50) NULL,
        \`allowed_tabs\` JSON NULL,
        \`editable_tabs\` JSON NULL,
        \`module_permissions\` JSON NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`must_change_password\` TINYINT(1) NOT NULL DEFAULT 0,
        \`failed_login_attempts\` INT NOT NULL DEFAULT 0,
        \`account_locked_until\` DATETIME NULL,
        \`last_login\` DATETIME NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_username\` (\`username\`),
        INDEX \`idx_users_role_level\` (\`role\`, \`level\`),
        INDEX \`idx_users_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e) {
    console.warn("[MySQL Schema Notice - system_users]:", e?.message || e);
  }
  try {
    await mysqlPool.query(`ALTER TABLE system_users ADD COLUMN IF NOT EXISTS role_title VARCHAR(100) NULL`);
  } catch (e) {
    try {
      await mysqlPool.query(`ALTER TABLE system_users ADD COLUMN role_title VARCHAR(100) NULL`);
    } catch (err) {
    }
  }
  try {
    await mysqlPool.query(`ALTER TABLE system_users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) NULL`);
  } catch (e) {
    try {
      await mysqlPool.query(`ALTER TABLE system_users ADD COLUMN avatar_url VARCHAR(500) NULL`);
    } catch (err) {
    }
  }
  try {
    const [existingAdmin] = await mysqlPool.query(
      `SELECT id, username, password_hash FROM system_users WHERE UPPER(username) = 'SADEGH' LIMIT 1`
    );
    const targetPassword = process.env.DEFAULT_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || "8411924As";
    const passwordHash = await import_bcryptjs.default.hash(targetPassword, 10);
    const allTabsJson = JSON.stringify([
      "todos",
      "workflow",
      "academic-calendar",
      "presence-hours",
      "finance",
      "students",
      "active-students",
      "discussion",
      "programs",
      "classrooms",
      "student-schedule",
      "teachers-schedule",
      "stats",
      "research",
      "attendance",
      "course-selection",
      "comments",
      "summary",
      "teachers-bank",
      "backup",
      "user-management",
      "user-credentials",
      "audit-logs"
    ]);
    if (!existingAdmin || existingAdmin.length === 0) {
      await mysqlPool.query(`
        INSERT INTO system_users (
          id, username, password_hash, name, role, role_title, level, grade_label,
          mentor_id, avatar_bg, allowed_tabs, editable_tabs, is_active, must_change_password
        ) VALUES (
          'user_sadegh', 'SADEGH', ?, '\u0635\u0627\u062F\u0642 (\u0633\u0648\u067E\u0631 \u0627\u062F\u0645\u06CC\u0646)', 'super_admin', '\u0633\u0648\u067E\u0631 \u0627\u062F\u0645\u06CC\u0646 (\u0645\u062F\u06CC\u0631 \u06A9\u0644 \u0633\u06CC\u0633\u062A\u0645)',
          1, '\u06A9\u0644 \u0633\u06CC\u0633\u062A\u0645', 'shahpoori', 'bg-indigo-700', ?, ?, 1, 0
        )
      `, [passwordHash, allTabsJson, allTabsJson]);
      console.log(`[MySQL Startup] \u2705 \u06A9\u0627\u0631\u0628\u0631 \u0633\u0648\u067E\u0631 \u0627\u062F\u0645\u06CC\u0646 SADEGH \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062F\u0631 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0633\u0627\u062E\u062A\u0647 \u0634\u062F.`);
    } else if (!existingAdmin[0].password_hash || existingAdmin[0].password_hash === "") {
      await mysqlPool.query(
        `UPDATE system_users SET password_hash = ?, is_active = 1 WHERE UPPER(username) = 'SADEGH'`,
        [passwordHash]
      );
      console.log(`[MySQL Startup] \u2705 \u0647\u0634 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u06A9\u0627\u0631\u0628\u0631 \u0633\u0648\u067E\u0631 \u0627\u062F\u0645\u06CC\u0646 SADEGH \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F.`);
    }
  } catch (adminSeedErr) {
    console.warn("[MySQL Startup Notice - SADEGH Seed]:", adminSeedErr?.message || adminSeedErr);
  }
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`login_audit_log\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`username\` VARCHAR(150) NOT NULL,
        \`success\` TINYINT(1) NOT NULL,
        \`ip_address\` VARCHAR(50) NOT NULL,
        \`user_agent\` VARCHAR(500) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_login_username\` (\`username\`),
        INDEX \`idx_login_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e) {
    console.warn("[MySQL Schema Notice - login_audit_log]:", e?.message || e);
  }
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`students\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`student_code\` VARCHAR(50) NULL,
        \`national_id\` VARCHAR(20) NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`father_name\` VARCHAR(150) NULL,
        \`grade\` VARCHAR(100) NOT NULL,
        \`phone\` VARCHAR(50) NULL,
        \`address\` TEXT NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'active',
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`entry_year\` VARCHAR(10) NULL,
        \`mentor_id\` VARCHAR(100) NULL,
        \`notes\` TEXT NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_student_national_id\` (\`national_id\`),
        INDEX \`idx_student_grade\` (\`grade\`),
        INDEX \`idx_student_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e) {
    console.warn("[MySQL Schema Notice - students]:", e?.message || e);
  }
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`classrooms\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`title\` VARCHAR(200) NOT NULL,
        \`grade\` VARCHAR(100) NULL,
        \`capacity\` INT NOT NULL DEFAULT 20,
        \`location\` VARCHAR(255) NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e) {
    console.warn("[MySQL Schema Notice - classrooms]:", e?.message || e);
  }
  await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`teachers\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`specialty\` VARCHAR(255) NULL,
        \`phone\` VARCHAR(50) NULL,
        \`email\` VARCHAR(150) NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_teacher_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`classrooms\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`title\` VARCHAR(200) NOT NULL,
        \`grade\` VARCHAR(100) NULL,
        \`capacity\` INT NOT NULL DEFAULT 20,
        \`location\` VARCHAR(255) NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`programs\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`grade\` VARCHAR(100) NOT NULL,
        \`teacher_id\` VARCHAR(100) NULL,
        \`teacher_name\` VARCHAR(255) NULL,
        \`classroom_id\` VARCHAR(100) NULL,
        \`day_of_week\` VARCHAR(50) NULL,
        \`start_time\` VARCHAR(20) NULL,
        \`end_time\` VARCHAR(20) NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_programs_grade\` (\`grade\`),
        INDEX \`idx_programs_teacher\` (\`teacher_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`enrollments\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`student_id\` VARCHAR(100) NOT NULL,
        \`program_id\` VARCHAR(100) NOT NULL,
        \`grade\` VARCHAR(100) NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'enrolled',
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_enrollment_program\` (\`program_id\`),
        INDEX \`idx_enrollment_student\` (\`student_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`attendance\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`student_id\` VARCHAR(100) NOT NULL,
        \`date\` VARCHAR(30) NOT NULL,
        \`program_id\` VARCHAR(100) NULL,
        \`status\` VARCHAR(30) NOT NULL DEFAULT 'present',
        \`minutes_late\` INT NOT NULL DEFAULT 0,
        \`reason\` TEXT NULL,
        \`recorded_by\` VARCHAR(100) NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_attendance_student_date\` (\`student_id\`, \`date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`student_requests\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`student_id\` VARCHAR(100) NOT NULL,
        \`student_name\` VARCHAR(150) NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`category\` VARCHAR(100) NOT NULL DEFAULT 'educational',
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'pending',
        \`description\` TEXT NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_request_student\` (\`student_id\`),
        INDEX \`idx_request_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  try {
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`audit_logs\` (
          \`id\` VARCHAR(100) NOT NULL,
          \`action\` VARCHAR(50) NOT NULL,
          \`collection_name\` VARCHAR(100) NULL,
          \`record_id\` VARCHAR(100) NULL,
          \`user_id\` VARCHAR(100) NULL,
          \`user_name\` VARCHAR(150) NULL,
          \`user_role\` VARCHAR(100) NULL,
          \`details\` JSON NULL,
          \`ip_address\` VARCHAR(60) NULL,
          \`status\` VARCHAR(20) NOT NULL DEFAULT 'success',
          \`error_message\` TEXT NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          INDEX \`idx_audit_action\` (\`action\`),
          INDEX \`idx_audit_collection\` (\`collection_name\`),
          INDEX \`idx_audit_user\` (\`user_id\`),
          INDEX \`idx_audit_date\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    const alterCols = [
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS collection_name VARCHAR(100) NULL",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS record_id VARCHAR(100) NULL",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name VARCHAR(150) NULL",
      'ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT "success"',
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS error_message TEXT NULL",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSON NULL"
    ];
    for (const colSql of alterCols) {
      try {
        await mysqlPool.query(colSql);
      } catch (e) {
      }
    }
  } catch (e) {
    console.warn("[MySQL Schema Notice - audit_logs]:", e?.message || e);
  }
  try {
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`audit_chain_logs\` (
          \`id\` VARCHAR(100) NOT NULL,
          \`sequence\` BIGINT NOT NULL AUTO_INCREMENT,
          \`prev_hash\` VARCHAR(255) NOT NULL,
          \`hash\` VARCHAR(255) NOT NULL,
          \`action\` VARCHAR(100) NOT NULL,
          \`user_id\` VARCHAR(100) NULL,
          \`username\` VARCHAR(100) NULL,
          \`details\` JSON NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`sequence\`),
          UNIQUE KEY \`uk_chain_id\` (\`id\`),
          INDEX \`idx_chain_hash\` (\`hash\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
  } catch (e) {
    console.warn("[MySQL Schema Notice - audit_chain_logs]:", e?.message || e);
  }
  const indexes = [
    { table: "app_collections", name: "idx_col_name_updated", cols: "`collection_name`, `updated_at`" }
  ];
  for (const idx of indexes) {
    const label = `${idx.table}.${idx.name}`;
    try {
      const [rows] = await mysqlPool.query(
        `SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
        [idx.table, idx.name]
      );
      if (rows && rows.length > 0) {
        console.log(`[MySQL Index] ${label}: \u0627\u0632 \u0642\u0628\u0644 \u0648\u062C\u0648\u062F \u062F\u0627\u0634\u062A`);
      } else {
        await mysqlPool.query(`CREATE INDEX \`${idx.name}\` ON \`${idx.table}\` (${idx.cols})`);
        console.log(`[MySQL Index] ${label}: \u0633\u0627\u062E\u062A\u0647 \u0634\u062F`);
      }
    } catch (e) {
      const errCode = e?.errno || e?.code;
      const errMsg = e?.message || String(e);
      if (errCode === 1142 || errCode === 1044 || errMsg.toLowerCase().includes("command denied") || errMsg.toLowerCase().includes("access denied")) {
        console.warn(`[MySQL Index] ${label}: \u062E\u0637\u0627: \u0639\u062F\u0645 \u062F\u0633\u062A\u0631\u0633\u06CC \u0644\u0627\u0632\u0645 (\u06A9\u0627\u0631\u0628\u0631 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0645\u062C\u0648\u0632 \u0627\u06CC\u062C\u0627\u062F \u0627\u06CC\u0646\u062F\u06A9\u0633 INDEX privilege \u0631\u0627 \u0646\u062F\u0627\u0631\u062F)`);
      } else {
        console.warn(`[MySQL Index] ${label}: \u062E\u0637\u0627: ${errMsg}`);
      }
    }
  }
}
function getMysqlPool() {
  const { isValid, errors } = validateMysqlConfig();
  if (!isValid) {
    lastConnectionError = errors.join(" | ");
    return null;
  }
  const conf = parseMysqlConfig();
  if (!pool) {
    try {
      console.log(`==================================================`);
      console.log(`[MySQL Connection Attempt]`);
      console.log(` - Host: "${conf.host}"`);
      console.log(` - Port: ${conf.port}`);
      console.log(` - Database: "${conf.database}"`);
      console.log(` - User: "${conf.user}"`);
      console.log(` - Password Length: ${conf.password ? conf.password.length : 0} chars`);
      console.log(` - Source Priority: DATABASE_URL -> MYSQL_URL -> DB_HOST -> MYSQL_HOST`);
      console.log(`==================================================`);
      pool = import_promise.default.createPool({
        host: conf.host,
        port: conf.port,
        user: conf.user,
        password: conf.password,
        database: conf.database,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 50,
        charset: "utf8mb4_unicode_ci",
        timezone: "+03:30"
        // Iran Standard Time
      });
      console.log(`[MySQL Engine] Connection pool successfully initialized for database "${conf.database}" on "${conf.host}:${conf.port}"`);
    } catch (err) {
      const errMsg = translateMysqlError(err);
      console.error("[MySQL Engine] Pool initialization error:", errMsg, err);
      lastConnectionError = errMsg;
      pool = null;
    }
  }
  return pool;
}
async function executeMysqlQuery(sql, params = []) {
  if (!isCurrentlyConnected) {
    await testMysqlConnection();
  }
  const mysqlPool = getMysqlPool();
  if (!mysqlPool) {
    throw new Error("\u062E\u0637\u0627: \u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u0633\u0631\u0648\u0631 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0628\u0631\u0642\u0631\u0627\u0631 \u0646\u0634\u062F. \u0644\u0637\u0641\u0627\u064B \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646\u06CC\u062F.");
  }
  const startTime = Date.now();
  try {
    const [rows] = await mysqlPool.execute(sql, params);
    const duration = Date.now() - startTime;
    if (duration > 1e3) {
      logSlowQuery("MySQL Query", duration, sql);
    }
    isCurrentlyConnected = true;
    return rows;
  } catch (err) {
    logServerError(err.message, err.stack, "executeMysqlQuery");
    console.error("[MySQL Execution Error]:", err.message, "\nQuery:", sql);
    const translatedMessage = translateMysqlError(err);
    isCurrentlyConnected = false;
    lastConnectionError = translatedMessage;
    throw new Error(translatedMessage);
  }
}
async function recordLoginAuditInDb(log) {
  const pool2 = getMysqlPool();
  if (!pool2) return;
  try {
    const id = `login_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await pool2.execute(
      `INSERT INTO login_audit_log (id, username, success, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, log.username.trim().toUpperCase(), log.success ? 1 : 0, log.ipAddress, log.userAgent || ""]
    );
  } catch (err) {
    console.warn("[Login Audit DB Notice]:", err?.message || err);
  }
}
var import_promise, import_bcryptjs, import_dotenv, isMysqlConfigured, pool, hasEnsuredIndexes, lastConnectionError, isCurrentlyConnected, MysqlRepository;
var init_databaseAbstraction = __esm({
  "src/lib/databaseAbstraction.ts"() {
    import_promise = __toESM(require("mysql2/promise"), 1);
    import_bcryptjs = __toESM(require("bcryptjs"), 1);
    import_dotenv = __toESM(require("dotenv"), 1);
    init_systemHealthMonitor();
    import_dotenv.default.config();
    isMysqlConfigured = Boolean(
      process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.DB_HOST || process.env.MYSQL_HOST || process.env.MYSQLHOST || process.env.DB_HOSTNAME
    );
    pool = null;
    hasEnsuredIndexes = false;
    lastConnectionError = null;
    isCurrentlyConnected = false;
    MysqlRepository = {
      // 1. Fetch User by Username
      async findUserByUsername(username) {
        const pool2 = getMysqlPool();
        if (!pool2) return null;
        try {
          const [rows] = await pool2.execute(
            `SELECT id, username, password_hash AS passwordHash, name, role, role_title AS roleTitle,
                level, grade_label AS gradeLabel, mentor_id AS mentorId, student_id AS studentId,
                linked_student_id AS linkedStudentId, avatar_bg AS avatarBg,
                allowed_tabs AS allowedTabs, editable_tabs AS editableTabs, module_permissions AS modulePermissions,
                is_active AS isActive, must_change_password AS mustChangePassword,
                failed_login_attempts AS failedLoginAttempts, account_locked_until AS accountLockedUntil,
                last_login AS lastLogin, data
         FROM system_users
         WHERE UPPER(username) = UPPER(?) LIMIT 1`,
            [username]
          );
          if (rows && rows.length > 0) {
            const u = rows[0];
            return {
              ...u,
              allowedTabs: typeof u.allowedTabs === "string" ? JSON.parse(u.allowedTabs) : u.allowedTabs || [],
              editableTabs: typeof u.editableTabs === "string" ? JSON.parse(u.editableTabs) : u.editableTabs || [],
              modulePermissions: typeof u.modulePermissions === "string" ? JSON.parse(u.modulePermissions) : u.modulePermissions || {},
              isActive: Boolean(u.isActive),
              mustChangePassword: Boolean(u.mustChangePassword)
            };
          }
          return null;
        } catch (e) {
          console.warn("[MySQL findUserByUsername Error]:", e);
          return null;
        }
      },
      // 2. Fetch All Users
      async getAllUsers() {
        const pool2 = getMysqlPool();
        if (!pool2) return [];
        try {
          const [rows] = await pool2.execute(
            `SELECT id, username, password_hash AS passwordHash, name, role, role_title AS roleTitle,
                level, grade_label AS gradeLabel, mentor_id AS mentorId, student_id AS studentId,
                linked_student_id AS linkedStudentId, avatar_bg AS avatarBg,
                allowed_tabs AS allowedTabs, editable_tabs AS editableTabs, module_permissions AS modulePermissions,
                is_active AS isActive, must_change_password AS mustChangePassword,
                failed_login_attempts AS failedLoginAttempts, account_locked_until AS accountLockedUntil,
                last_login AS lastLogin, data
         FROM system_users ORDER BY level ASC, name ASC`
          );
          return (rows || []).map((u) => ({
            ...u,
            allowedTabs: typeof u.allowedTabs === "string" ? JSON.parse(u.allowedTabs) : u.allowedTabs || [],
            editableTabs: typeof u.editableTabs === "string" ? JSON.parse(u.editableTabs) : u.editableTabs || [],
            modulePermissions: typeof u.modulePermissions === "string" ? JSON.parse(u.modulePermissions) : u.modulePermissions || {},
            isActive: Boolean(u.isActive),
            mustChangePassword: Boolean(u.mustChangePassword)
          }));
        } catch (e) {
          console.warn("[MySQL getAllUsers Error]:", e);
          return [];
        }
      },
      // 3. Upsert User (Insert or Update with Prepared Statement)
      async saveUser(user) {
        const pool2 = getMysqlPool();
        if (!pool2) return;
        const sql = `
      INSERT INTO system_users (
        id, username, password_hash, name, role, role_title, level, grade_label,
        mentor_id, student_id, linked_student_id, avatar_bg, allowed_tabs,
        editable_tabs, module_permissions, is_active, must_change_password,
        failed_login_attempts, account_locked_until, last_login, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        password_hash = IF(VALUES(password_hash) IS NOT NULL AND VALUES(password_hash) != '', VALUES(password_hash), password_hash),
        role = VALUES(role),
        role_title = VALUES(role_title),
        level = VALUES(level),
        grade_label = VALUES(grade_label),
        mentor_id = VALUES(mentor_id),
        student_id = VALUES(student_id),
        linked_student_id = VALUES(linked_student_id),
        avatar_bg = VALUES(avatar_bg),
        allowed_tabs = VALUES(allowed_tabs),
        editable_tabs = VALUES(editable_tabs),
        module_permissions = VALUES(module_permissions),
        is_active = VALUES(is_active),
        must_change_password = VALUES(must_change_password),
        failed_login_attempts = VALUES(failed_login_attempts),
        account_locked_until = VALUES(account_locked_until),
        last_login = VALUES(last_login),
        data = VALUES(data),
        updated_at = NOW();
    `;
        const params = [
          user.id,
          user.username.toUpperCase(),
          user.passwordHash || null,
          user.name,
          user.role,
          user.roleTitle || null,
          user.level,
          user.gradeLabel || null,
          user.mentorId || null,
          user.studentId || null,
          user.linkedStudentId || null,
          user.avatarBg || null,
          JSON.stringify(user.allowedTabs || []),
          JSON.stringify(user.editableTabs || []),
          JSON.stringify(user.modulePermissions || {}),
          user.isActive !== false ? 1 : 0,
          user.mustChangePassword ? 1 : 0,
          user.failedLoginAttempts || 0,
          user.accountLockedUntil ? new Date(user.accountLockedUntil) : null,
          user.lastLogin ? new Date(user.lastLogin) : null,
          JSON.stringify(user.data || {})
        ];
        await pool2.execute(sql, params);
      },
      // 4. Record Audit Log
      async recordAuditLog(log) {
        const pool2 = getMysqlPool();
        if (!pool2) return;
        try {
          const id = log.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          await pool2.execute(
            `INSERT INTO audit_logs (id, user_id, username, user_role, action, entity_type, entity_id, description, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              id,
              log.userId || null,
              log.username || null,
              log.userRole || null,
              log.action,
              log.entityType || null,
              log.entityId || null,
              log.description,
              log.ipAddress || null
            ]
          );
        } catch (e) {
          console.warn("[MySQL AuditLog Error]:", e);
        }
      },
      // 5. Save Document to App Collections or Dedicated Table
      async saveDocument(collectionName, id, data) {
        const pool2 = getMysqlPool();
        if (!pool2) {
          throw new Error("\u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647 MySQL \u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC \u0646\u0634\u062F\u0647 \u06CC\u0627 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A.");
        }
        const cleanData = sanitizeRecordForDb(data);
        const jsonStr = JSON.stringify(cleanData);
        const sql = `
      INSERT INTO app_collections (collection_name, id, data, updated_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        data = ?,
        updated_at = NOW();
    `;
        const [result] = await pool2.execute(sql, [collectionName, id, jsonStr, jsonStr]);
        const affectedRows = Number(result?.affectedRows) || 0;
        console.log(`[MySQL Save Log] Collection: "${collectionName}", ID: "${id}", Affected Rows: ${affectedRows}`);
        if (affectedRows === 0) {
          console.warn(`[MySQL Save Warning] Collection: "${collectionName}", ID: "${id}" yielded 0 affected rows!`);
        }
        return { affectedRows };
      },
      // 5b. Save Document to Dedicated Table if it exists
      async saveToDedicatedTable(tableName, row) {
        const pool2 = getMysqlPool();
        if (!pool2 || !row || !row.id) return;
        try {
          if (tableName === "students") {
            const sql = `
          INSERT INTO students (id, student_code, national_id, name, father_name, grade, phone, address, status, is_active, entry_year, mentor_id, notes, data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            student_code = VALUES(student_code),
            national_id = VALUES(national_id),
            name = VALUES(name),
            father_name = VALUES(father_name),
            grade = VALUES(grade),
            phone = VALUES(phone),
            address = VALUES(address),
            status = VALUES(status),
            is_active = VALUES(is_active),
            entry_year = VALUES(entry_year),
            mentor_id = VALUES(mentor_id),
            notes = VALUES(notes),
            data = VALUES(data),
            updated_at = NOW();
        `;
            await pool2.execute(sql, [
              row.id,
              row.student_code || null,
              row.national_id || null,
              row.name || "\u0646\u0627\u0645\u0634\u062E\u0635",
              row.father_name || null,
              row.grade || "\u0646\u0627\u0645\u0634\u062E\u0635",
              row.phone || null,
              row.address || null,
              row.status || "active",
              row.is_active !== void 0 ? row.is_active ? 1 : 0 : 1,
              row.entry_year || null,
              row.mentor_id || null,
              row.notes || null,
              JSON.stringify(row.data || {})
            ]);
          } else if (tableName === "classrooms") {
            const sql = `
          INSERT INTO classrooms (id, title, grade, capacity, location, data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            grade = VALUES(grade),
            capacity = VALUES(capacity),
            location = VALUES(location),
            data = VALUES(data),
            updated_at = NOW();
        `;
            await pool2.execute(sql, [
              row.id,
              row.title || "\u06A9\u0644\u0627\u0633 \u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646",
              row.grade || null,
              Number(row.capacity) || 20,
              row.location || null,
              JSON.stringify(row.data || {})
            ]);
          }
        } catch (e) {
          console.warn(`[MySQL Dedicated Table Notice] ${tableName}:`, e?.message || e);
        }
      },
      // 6. Delete Document
      async deleteDocument(collectionName, id) {
        const pool2 = getMysqlPool();
        if (!pool2) {
          throw new Error("MySQL connection pool is not configured or unavailable.");
        }
        const [result] = await pool2.execute(
          `DELETE FROM app_collections WHERE collection_name = ? AND id = ?`,
          [collectionName, id]
        );
        const affectedRows = Number(result?.affectedRows) || 0;
        console.log(`[MySQL Delete Log] Collection: "${collectionName}", ID: "${id}", Affected Rows: ${affectedRows}`);
        if (collectionName === "system_users") {
          try {
            await pool2.execute(
              `DELETE FROM system_users WHERE id = ? OR UPPER(username) = UPPER(?)`,
              [id, id]
            );
          } catch (e) {
          }
        }
        return { affectedRows };
      },
      // 6b. Delete User
      async deleteUser(userIdOrUsername) {
        const pool2 = getMysqlPool();
        if (!pool2) return;
        try {
          await pool2.execute(
            `DELETE FROM system_users WHERE id = ? OR UPPER(username) = UPPER(?)`,
            [userIdOrUsername, userIdOrUsername]
          );
          await pool2.execute(
            `DELETE FROM app_collections WHERE collection_name = 'system_users' AND (id = ? OR UPPER(id) = UPPER(?))`,
            [userIdOrUsername, userIdOrUsername]
          );
        } catch (e) {
          console.warn("[MySQL deleteUser Error]:", e);
        }
      },
      // 7. Get Single Document by Primary Key
      async getDocument(collectionName, id) {
        const pool2 = getMysqlPool();
        if (!pool2) return null;
        const [rows] = await pool2.execute(
          `SELECT data FROM app_collections WHERE collection_name = ? AND id = ? LIMIT 1`,
          [collectionName, id]
        );
        if (rows && rows.length > 0) {
          const r = rows[0];
          const parsed = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
          return { ...parsed, id };
        }
        return null;
      },
      // 8. Get Multiple Documents by Candidate IDs (Primary Keys)
      async getDocumentsByIds(collectionName, ids) {
        if (!ids || ids.length === 0) return [];
        const pool2 = getMysqlPool();
        if (!pool2) return [];
        const placeholders = ids.map(() => "?").join(", ");
        const [rows] = await pool2.execute(
          `SELECT id, data FROM app_collections WHERE collection_name = ? AND id IN (${placeholders})`,
          [collectionName, ...ids]
        );
        return (rows || []).map((r) => {
          const parsed = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
          return { ...parsed, id: r.id };
        });
      },
      // 9. Query Documents
      async queryCollection(collectionName) {
        const pool2 = getMysqlPool();
        if (!pool2) return [];
        const startTime = Date.now();
        const [rows] = await pool2.execute(
          `SELECT id, data FROM app_collections WHERE collection_name = ? ORDER BY updated_at DESC`,
          [collectionName]
        );
        const duration = Date.now() - startTime;
        if (duration > 1e3) {
          logSlowQuery(collectionName, duration, `SELECT id, data FROM app_collections WHERE collection_name = '${collectionName}' ORDER BY updated_at DESC`);
        }
        return (rows || []).map((r) => {
          const parsed = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
          return { ...parsed, id: r.id };
        });
      }
    };
  }
});

// src/lib/serverAuditChain.ts
var serverAuditChain_exports = {};
__export(serverAuditChain_exports, {
  computeRecordHash: () => computeRecordHash,
  verifyAuditChain: () => verifyAuditChain
});
function computeRecordHash(entry) {
  const normalizedPrev = entry.previous_hash || GENESIS_HASH;
  const oldValStr = entry.old_values ? JSON.stringify(entry.old_values) : "";
  const newValStr = entry.new_values ? JSON.stringify(entry.new_values) : "";
  const payload = [
    normalizedPrev,
    entry.id || "",
    entry.user_id || "",
    entry.user_name || "",
    entry.role || "",
    entry.action || "",
    entry.module || "",
    entry.target_id || "",
    entry.target_type || "",
    oldValStr,
    newValStr,
    entry.ip_address || "",
    entry.created_at || "",
    PEPPER
  ].join("|#|");
  return import_crypto.default.createHash("sha256").update(payload, "utf8").digest("hex");
}
function verifyAuditChain(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return { isValid: true, totalVerified: 0 };
  }
  const sorted = [...logs].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime() || 0;
    const timeB = new Date(b.created_at).getTime() || 0;
    return timeA - timeB;
  });
  let expectedPrevHash = GENESIS_HASH;
  for (let i = 0; i < sorted.length; i++) {
    const record = sorted[i];
    const actualPrevHash = record.previous_hash || GENESIS_HASH;
    if (i > 0 && actualPrevHash !== expectedPrevHash) {
      return {
        isValid: false,
        brokenAtIndex: i,
        brokenRecordId: record.id,
        reason: `\u06AF\u0633\u0633\u062A\u06AF\u06CC \u062F\u0631 \u0632\u0646\u062C\u06CC\u0631\u0647 \u0647\u0634 \u062F\u0631 \u0631\u062F\u06CC\u0641 ${i + 1} (\u0634\u0646\u0627\u0633\u0647: ${record.id}). \u0647\u0634 \u0645\u0627\u0642\u0628\u0644 \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u0628\u0627 \u0647\u0634 \u0631\u06A9\u0648\u0631\u062F \u0642\u0628\u0644\u06CC \u062A\u0637\u0627\u0628\u0642 \u0646\u062F\u0627\u0631\u062F.`,
        totalVerified: i
      };
    }
    const recalculatedHash = computeRecordHash({
      id: record.id,
      previous_hash: actualPrevHash,
      user_id: record.user_id,
      user_name: record.user_name,
      role: record.role,
      action: record.action,
      module: record.module,
      target_id: record.target_id,
      target_type: record.target_type,
      old_values: record.old_values,
      new_values: record.new_values,
      ip_address: record.ip_address,
      created_at: record.created_at
    });
    if (recalculatedHash !== record.current_hash) {
      return {
        isValid: false,
        brokenAtIndex: i,
        brokenRecordId: record.id,
        reason: `\u062F\u0633\u062A\u06A9\u0627\u0631\u06CC \u062F\u0631 \u062F\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u0644\u0627\u06AF \u0631\u062F\u06CC\u0641 ${i + 1} (\u0634\u0646\u0627\u0633\u0647: ${record.id}). \u0647\u0634 \u0645\u062D\u0627\u0633\u0628\u0647\u200C\u0634\u062F\u0647 \u0628\u0627 \u0647\u0634 \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u062F\u0631 \u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647 \u0645\u063A\u0627\u06CC\u0631\u062A \u062F\u0627\u0631\u062F.`,
        totalVerified: i
      };
    }
    expectedPrevHash = record.current_hash;
  }
  return {
    isValid: true,
    totalVerified: sorted.length
  };
}
var import_crypto, PEPPER, GENESIS_HASH;
var init_serverAuditChain = __esm({
  "src/lib/serverAuditChain.ts"() {
    import_crypto = __toESM(require("crypto"), 1);
    PEPPER = process.env.AUDIT_PEPPER;
    if (!PEPPER || PEPPER.length < 24) {
      console.error("FATAL ERROR: AUDIT_PEPPER not set or too short.");
      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      }
    }
    GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
  }
});

// src/lib/auditLogger.ts
var auditLogger_exports = {};
__export(auditLogger_exports, {
  logAudit: () => logAudit,
  revertAuditActivity: () => revertAuditActivity
});
function sanitizeDetails(details) {
  if (!details || typeof details !== "object") return details;
  const clone = Array.isArray(details) ? [...details] : { ...details };
  const sensitiveKeys = ["password", "passwordHash", "password_hash", "token", "accessToken", "jwt", "secret"];
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      clone[key] = "[REDACTED]";
    } else if (typeof clone[key] === "object" && clone[key] !== null) {
      clone[key] = sanitizeDetails(clone[key]);
    }
  }
  return clone;
}
async function logAudit(input) {
  try {
    const pool2 = getMysqlPool();
    if (!pool2) return;
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const action = input.action || "unknown";
    const collectionName = input.collectionName || null;
    const recordId = input.recordId || null;
    const userId = input.userId || null;
    const userName = input.userName || null;
    const userRole = input.userRole || null;
    const status = input.status || "success";
    const errorMessage = input.errorMessage || null;
    const ipAddress = input.ipAddress || null;
    let detailsJson = null;
    if (input.details) {
      const sanitized = sanitizeDetails(input.details);
      detailsJson = typeof sanitized === "string" ? sanitized : JSON.stringify(sanitized);
    }
    const sql = `
      INSERT INTO audit_logs (
        id, action, collection_name, record_id, user_id, user_name, user_role, details, ip_address, status, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    await pool2.execute(sql, [
      id,
      action,
      collectionName,
      recordId,
      userId,
      userName,
      userRole,
      detailsJson,
      ipAddress,
      status,
      errorMessage
    ]);
  } catch (e) {
    console.warn("[AuditLogger Notice] Failed to persist audit log silently:", e?.message || e);
  }
}
async function revertAuditActivity(logId, revertedBy) {
  try {
    const pool2 = getMysqlPool();
    if (!pool2) {
      return { success: false, message: "\u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A." };
    }
    await logAudit({
      action: "revert",
      recordId: logId,
      userName: revertedBy,
      details: { originalLogId: logId, revertedBy },
      status: "success"
    });
    return { success: true, message: "\u0639\u0645\u0644\u06CC\u0627\u062A \u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F." };
  } catch (err) {
    return { success: false, message: err?.message || "\u062E\u0637\u0627 \u062F\u0631 \u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC \u0639\u0645\u0644\u06CC\u0627\u062A" };
  }
}
var init_auditLogger = __esm({
  "src/lib/auditLogger.ts"() {
    init_databaseAbstraction();
  }
});

// src/lib/serverDataApi.ts
var serverDataApi_exports = {};
__export(serverDataApi_exports, {
  COLLECTION_TABLE_MAP: () => COLLECTION_TABLE_MAP,
  authorizeCollectionAccess: () => authorizeCollectionAccess,
  canUserReadDoc: () => canUserReadDoc,
  deleteDataFromServer: () => deleteDataFromServer,
  fetchBootstrapData: () => fetchBootstrapData,
  fetchDataFromServer: () => fetchDataFromServer,
  notifyRealtimeChange: () => notifyRealtimeChange,
  postDataToServer: () => postDataToServer,
  prepareRecordForDedicatedTable: () => prepareRecordForDedicatedTable,
  registerRealtimeListener: () => registerRealtimeListener,
  serverDeleteDoc: () => serverDeleteDoc,
  serverGetDocByCandidateIds: () => serverGetDocByCandidateIds,
  serverQueryCollection: () => serverQueryCollection,
  serverSaveDoc: () => serverSaveDoc
});
function registerRealtimeListener(listener) {
  realtimeListeners.add(listener);
  return () => realtimeListeners.delete(listener);
}
function notifyRealtimeChange(collection, id, action) {
  const evt = { collection, id, action, timestamp: Date.now() };
  realtimeListeners.forEach((fn) => {
    try {
      fn(evt);
    } catch (e) {
    }
  });
}
async function postDataToServer(collection, data) {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || localStorage.getItem("token") || sessionStorage.getItem("token") : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`/api/data/${collection}`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(data)
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      return { success: true, id: json.id };
    }
    return { success: false, error: json.message || `HTTP ${res.status}` };
  } catch (e) {
    return { success: false, error: e?.message || "\u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u0633\u0631\u0648\u0631" };
  }
}
async function fetchDataFromServer(collection) {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || localStorage.getItem("token") || sessionStorage.getItem("token") : null;
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`/api/data/${collection}`, {
      method: "GET",
      headers,
      credentials: "include"
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success && Array.isArray(json.items)) {
      return { success: true, items: json.items };
    }
    return { success: false, error: json.message || `HTTP ${res.status}`, items: [] };
  } catch (e) {
    return { success: false, error: e?.message || "\u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u0633\u0631\u0648\u0631", items: [] };
  }
}
async function deleteDataFromServer(collection, id) {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || localStorage.getItem("token") || sessionStorage.getItem("token") : null;
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`/api/data/${collection}/${id}`, {
      method: "DELETE",
      headers,
      credentials: "include"
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      return { success: true };
    }
    return { success: false, error: json.message || `HTTP ${res.status}` };
  } catch (e) {
    return { success: false, error: e?.message || "\u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u0633\u0631\u0648\u0631" };
  }
}
function cleanTeacherName(raw) {
  if (!raw) return "";
  let str = String(raw).replace(/\([^)]*\)/g, " ");
  str = str.replace(/[ي]/g, "\u06CC").replace(/[ك]/g, "\u06A9").replace(/[ة]/g, "\u0647").replace(/[آأإ]/g, "\u0627").replace(/[ؤ]/g, "\u0648").replace(/[ئ]/g, "\u06CC");
  str = str.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\u00A0]/g, " ");
  str = str.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
  const prefixRegex = /^(استاد|حجت\s*الاسلام\s*و\s*المسلمین|حجت\s*الاسلام|ایت\s*الله|شیخ|دکتر|جناب\s*اقای|جناب\s*آقای|اقای|آقای|سید|میر)\s+/g;
  let prev = "";
  while (prev !== str) {
    prev = str;
    str = str.replace(prefixRegex, "").trim();
  }
  return str.replace(/\s+/g, " ").toLowerCase().trim();
}
function authorizeCollectionAccess(user, collection, action, recordOwnerId) {
  if (!user) {
    if (action === "read" && PUBLIC_READ_COLLECTIONS.has(collection)) {
      return { allowed: true };
    }
    return { allowed: false, reason: "\u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A. \u0645\u0634\u0627\u0647\u062F\u0647 \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u06CC\u0646 \u062F\u0627\u062F\u0647\u200C\u0647\u0627 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0648\u0631\u0648\u062F \u0628\u0647 \u0633\u0627\u0645\u0627\u0646\u0647 \u0627\u0633\u062A." };
  }
  if (user.level === 1 || user.role === "super_admin" || user.role === "school_manager") {
    return { allowed: true };
  }
  if (collection === "students" && (action === "write" || action === "delete")) {
    const isEduManager = user.role === "education_manager" || user.role === "education_officer";
    if (!isEduManager && user.level > 1) {
      return { allowed: false, reason: "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0648 \u0627\u06CC\u062C\u0627\u062F/\u062D\u0630\u0641 \u0645\u0634\u062E\u0635\u0627\u062A \u0637\u0644\u0627\u0628 \u0645\u0646\u062D\u0635\u0631\u0627\u064B \u062F\u0631 \u0627\u062E\u062A\u06CC\u0627\u0631 \u0648\u0627\u062D\u062F \u0622\u0645\u0648\u0632\u0634 \u0648 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0627\u0633\u062A." };
    }
  }
  if (FINANCIAL_COLLECTIONS.has(collection)) {
    const isFinanceStaff = user.role === "finance_manager" || user.role === "financial_officer" || user.username?.toUpperCase() === "MALI";
    if (!isFinanceStaff) {
      if (collection === "tuition_records" && action === "read" && (user.level === 3 || user.role === "student")) {
        return { allowed: true };
      }
      return { allowed: false, reason: "\u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0628\u062E\u0634 \u0627\u0645\u0648\u0631 \u0645\u0627\u0644\u06CC \u0628\u0631\u0627\u06CC \u0634\u0645\u0627 \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A." };
    }
    return { allowed: true };
  }
  if (USER_SPECIFIC_COLLECTIONS.has(collection)) {
    if (action === "write" || action === "delete") {
      if (recordOwnerId && recordOwnerId !== user.id) {
        return { allowed: false, reason: "\u0634\u0645\u0627 \u0641\u0642\u0637 \u0645\u062C\u0627\u0632 \u0628\u0647 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u06CC\u0627 \u062D\u0630\u0641 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0634\u062E\u0635\u06CC \u062E\u0648\u062F \u0647\u0633\u062A\u06CC\u062F." };
      }
    }
    return { allowed: true };
  }
  if (collection === "received_articles" || collection === "evaluation_requests") {
    if (user.level === 3 && action === "write") {
      return { allowed: true };
    }
  }
  if (collection === "system_users") {
    if (user.level > 1 && user.role !== "education_manager") {
      return { allowed: false, reason: "\u0645\u0634\u0627\u0647\u062F\u0647 \u0648 \u0645\u062F\u06CC\u0631\u06CC\u062A \u06A9\u0627\u0631\u0628\u0631\u0627\u0646 \u0633\u06CC\u0633\u062A\u0645 \u0645\u0646\u062D\u0635\u0631\u0627\u064B \u062F\u0631 \u0627\u062E\u062A\u06CC\u0627\u0631 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0627\u0633\u062A." };
    }
  }
  if (collection === "audit_logs") {
    if (action === "delete" || action === "write") return { allowed: false, reason: "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u06CC\u0627 \u062D\u0630\u0641 \u0644\u0627\u06AF\u200C\u0647\u0627\u06CC \u0627\u0645\u0646\u06CC\u062A\u06CC \u0627\u0645\u06A9\u0627\u0646\u200C\u067E\u0630\u06CC\u0631 \u0646\u06CC\u0633\u062A." };
    if (action === "read" && user.level > 1) return { allowed: false, reason: "\u0645\u0634\u0627\u0647\u062F\u0647 \u0644\u0627\u06AF\u200C\u0647\u0627\u06CC \u0627\u0645\u0646\u06CC\u062A\u06CC \u0645\u0646\u062D\u0635\u0631\u0627\u064B \u062F\u0631 \u0627\u062E\u062A\u06CC\u0627\u0631 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0627\u0633\u062A." };
  }
  if (user.role === "grade_mentor" && user.gradeLabel) {
    return { allowed: true };
  }
  if (user.role === "education_manager" || user.role === "education_officer") {
    return { allowed: true };
  }
  return { allowed: true };
}
function prepareRecordForDedicatedTable(collection, data) {
  const dedicatedTable = COLLECTION_TABLE_MAP[collection] || null;
  if (!dedicatedTable || !data) return { row: data, dedicatedTable: null };
  const id = data.id || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let row = {
    id,
    data,
    updated_at: now
  };
  switch (dedicatedTable) {
    case "students":
      row.national_id = data.nationalId || data.national_id || null;
      row.student_code = data.studentCode || data.student_code || null;
      row.name = data.name || "\u0646\u0627\u0645\u0634\u062E\u0635";
      row.grade = data.grade || "\u0646\u0627\u0645\u0634\u062E\u0635";
      row.phone = data.phone || null;
      row.father_name = data.fatherName || data.father_name || null;
      row.is_active = data.isActive !== void 0 ? Boolean(data.isActive) : true;
      break;
    case "teachers":
      row.name = data.name || "\u0646\u0627\u0645\u0634\u062E\u0635";
      row.phone = data.phone || null;
      row.specialty = data.specialty || null;
      row.is_active = data.isActive !== void 0 ? Boolean(data.isActive) : true;
      break;
    case "classrooms":
      row.title = data.title || "\u06A9\u0644\u0627\u0633 \u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646";
      row.grade = data.grade || null;
      row.capacity = Number(data.capacity) || 20;
      break;
    case "programs":
      row.title = data.title || "\u0628\u0631\u0646\u0627\u0645\u0647 \u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646";
      row.grade = data.grade || "\u0646\u0627\u0645\u0634\u062E\u0635";
      row.teacher_id = data.teacherId || data.teacher_id || null;
      row.teacher_name = data.teacherName || data.teacher_name || null;
      row.term = data.term || null;
      break;
    case "attendance":
      row.date = data.date || now.split("T")[0];
      row.grade = data.grade || "\u0646\u0627\u0645\u0634\u062E\u0635";
      row.program_id = data.programId || data.program_id || null;
      row.present_count = Number(data.presentCount) || 0;
      row.absent_count = Number(data.absentCount) || 0;
      break;
    case "received_articles":
      row.student_id = data.studentId || data.student_id || "unknown";
      row.student_name = data.studentName || data.student_name || null;
      row.grade = data.grade || null;
      row.title = data.title || "\u0645\u0642\u0627\u0644\u0647 \u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646";
      row.field = data.field || null;
      row.word_count = Number(data.wordCount) || 0;
      row.status = data.status || "submitted";
      break;
    case "article_evaluations":
      row.article_id = data.articleId || data.article_id || id;
      row.title = data.title || "\u062C\u0644\u0633\u0647 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC";
      row.student_id = data.studentId || data.student_id || "unknown";
      row.student_name = data.studentName || data.student_name || null;
      row.grade = data.grade || null;
      row.session_date = data.sessionDate || data.session_date || null;
      row.status = data.status || "scheduled";
      break;
    case "evaluation_requests":
      row.evaluation_id = data.evaluationId || data.evaluation_id || "none";
      row.article_id = data.articleId || data.article_id || null;
      row.student_id = data.studentId || data.student_id || "unknown";
      row.student_name = data.studentName || data.student_name || null;
      row.grade = data.grade || null;
      row.request_type = data.requestType || data.request_type || "article_evaluation";
      row.status = data.status || "pending";
      break;
    case "personal_todos":
      row.user_id = data.userId || data.user_id || "unknown";
      row.user_name = data.userName || data.user_name || null;
      row.title = data.title || "\u06A9\u0627\u0631 \u062C\u062F\u06CC\u062F";
      row.description = data.description || null;
      row.category = data.category || "\u0639\u0645\u0648\u0645\u06CC";
      row.completed = Boolean(data.completed);
      row.archived = Boolean(data.archived);
      row.priority = data.priority || "medium";
      row.due_date = data.dueDate || data.due_date || null;
      break;
    case "assigned_todos":
      row.sender_user_id = data.senderUserId || data.sender_user_id || "unknown";
      row.sender_name = data.senderName || data.sender_name || null;
      row.recipient_user_id = data.recipientUserId || data.recipient_user_id || "unknown";
      row.recipient_name = data.recipientName || data.recipient_name || null;
      row.title = data.title || "\u0627\u0631\u062C\u0627\u0639 \u062C\u062F\u06CC\u062F";
      row.status = data.status || "pending";
      break;
    case "student_lockers":
      row.locker_number = Number(data.lockerNumber || data.locker_number) || 0;
      row.status = data.status || "empty";
      row.student_id = data.studentId || data.student_id || null;
      row.student_name = data.studentName || data.student_name || null;
      row.student_grade = data.studentGrade || data.student_grade || null;
      row.assigned_at = data.assignedAt || data.assigned_at || null;
      row.inactive_reason = data.inactiveReason || data.inactive_reason || null;
      row.notes = data.notes || null;
      row.history = Array.isArray(data.history) ? data.history : [];
      break;
    case "student_requests":
      row.student_id = data.studentId || data.student_id || "unknown";
      row.student_name = data.studentName || data.student_name || null;
      row.title = data.title || "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646";
      row.category = data.category || "educational";
      row.status = data.status || "pending";
      row.description = data.description || null;
      break;
    default:
      break;
  }
  return { row, dedicatedTable };
}
async function serverSaveDoc(collection, idOrData, dataOrCallerUser) {
  if (!idOrData) return { success: false, id: "", error: "\u062F\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u0627\u0631\u0633\u0627\u0644\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A." };
  let record;
  let callerUser = null;
  if (typeof idOrData === "string") {
    const recordId = idOrData;
    if (dataOrCallerUser && typeof dataOrCallerUser === "object") {
      record = { ...dataOrCallerUser, id: recordId };
    } else {
      record = { id: recordId };
    }
  } else {
    record = { ...idOrData };
    callerUser = dataOrCallerUser;
  }
  const id = String(record.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
  record.id = id;
  if (isMysqlConfigured) {
    try {
      const saveRes = await MysqlRepository.saveDocument(collection, id, record);
      const affectedRows = saveRes?.affectedRows || 0;
      const { row, dedicatedTable } = prepareRecordForDedicatedTable(collection, record);
      if (dedicatedTable) {
        try {
          await MysqlRepository.saveToDedicatedTable(dedicatedTable, row);
        } catch (dErr) {
        }
      }
      const readDoc = await MysqlRepository.getDocument(collection, id);
      const finalDoc = readDoc || record;
      console.log(`[Write-Then-Read Success] Collection: "${collection}", ID: "${id}", AffectedRows: ${affectedRows}`);
      await logAudit({
        action: affectedRows > 1 ? "update" : "insert",
        collectionName: collection,
        recordId: id,
        userId: callerUser?.id || callerUser?.userId,
        userName: callerUser?.username || callerUser?.name,
        userRole: callerUser?.role,
        details: finalDoc,
        status: "success"
      });
      notifyRealtimeChange(collection, id, "upsert");
      return { success: true, id, item: finalDoc };
    } catch (mErr) {
      console.error(`[MySQL Save Fatal Error] Collection: "${collection}", ID: "${id}"`);
      console.error(`[MySQL Error Details]:`, mErr?.message || mErr);
      if (mErr?.stack) console.error(`[MySQL Stack Trace]:`, mErr.stack);
      await logAudit({
        action: "insert",
        collectionName: collection,
        recordId: id,
        userId: callerUser?.id || callerUser?.userId,
        userName: callerUser?.username || callerUser?.name,
        userRole: callerUser?.role,
        status: "error",
        errorMessage: mErr?.message || "\u0645\u0634\u06A9\u0644 \u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647"
      });
      return {
        success: false,
        id: "",
        error: `\u062E\u0637\u0627 \u062F\u0631 \u0630\u062E\u06CC\u0631\u0647\u200C\u0633\u0627\u0632\u06CC \u062F\u0631 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633: ${mErr?.message || "\u0645\u0634\u06A9\u0644 \u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647"}`
      };
    }
  }
  if (isServerSupabaseConfigured) {
    try {
      const { row, dedicatedTable } = prepareRecordForDedicatedTable(collection, record);
      if (dedicatedTable) {
        try {
          const { error: dedicatedError } = await serverSupabase.from(dedicatedTable).upsert(row, { onConflict: "id" });
          if (dedicatedError) {
            console.warn(`[Supabase Dedicated Table Notice] ${dedicatedTable}:`, dedicatedError.message);
          }
        } catch (dErr) {
          console.warn(`[Supabase Dedicated Table Bypass] ${dedicatedTable}:`, dErr?.message || dErr);
        }
      }
      const { error: appErr } = await serverSupabase.from("app_collections").upsert({
        collection_name: collection,
        id,
        data: record,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }, { onConflict: "collection_name,id" });
      if (appErr) {
        console.error(`[Supabase Save Error] Collection: "${collection}", ID: "${id}":`, appErr.message);
        return { success: false, id: "", error: "\u062E\u0637\u0627 \u062F\u0631 \u0630\u062E\u06CC\u0631\u0647\u200C\u0633\u0627\u0632\u06CC. \u0644\u0637\u0641\u0627\u064B \u0628\u0627 \u0645\u062F\u06CC\u0631 \u0633\u06CC\u0633\u062A\u0645 \u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F." };
      }
      notifyRealtimeChange(collection, id, "upsert");
      return { success: true, id };
    } catch (err) {
      console.error(`[Supabase Save Fatal Exception] Collection: "${collection}", ID: "${id}":`, err?.message || err, err?.stack);
      return { success: false, id: "", error: "\u062E\u0637\u0627 \u062F\u0631 \u0630\u062E\u06CC\u0631\u0647\u200C\u0633\u0627\u0632\u06CC. \u0644\u0637\u0641\u0627\u064B \u0628\u0627 \u0645\u062F\u06CC\u0631 \u0633\u06CC\u0633\u062A\u0645 \u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F." };
    }
  }
  console.error(`[Database Error] No database configured for saving collection: "${collection}"`);
  return {
    success: false,
    id: "",
    error: "\u0647\u06CC\u0686 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633\u06CC \u062A\u0646\u0638\u06CC\u0645 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627\u064B Environment Variables \u0631\u0627 \u0686\u06A9 \u06A9\u0646\u06CC\u062F."
  };
}
async function serverDeleteDoc(collection, id, callerUser) {
  if (!id) return { success: false, error: "\u0634\u0646\u0627\u0633\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." };
  if (isMysqlConfigured) {
    try {
      const delRes = await MysqlRepository.deleteDocument(collection, id);
      const affectedRows = delRes?.affectedRows || 0;
      await logAudit({
        action: "delete",
        collectionName: collection,
        recordId: id,
        userId: callerUser?.id || callerUser?.userId,
        userName: callerUser?.username || callerUser?.name,
        userRole: callerUser?.role,
        details: { deletedId: id, affectedRows },
        status: "success"
      });
      notifyRealtimeChange(collection, id, "delete");
      return { success: true };
    } catch (mErr) {
      console.error(`[MySQL Delete Fatal Error] Collection: "${collection}", ID: "${id}"`);
      console.error(`[MySQL Error Details]:`, mErr?.message || mErr);
      if (mErr?.stack) console.error(`[MySQL Stack Trace]:`, mErr.stack);
      await logAudit({
        action: "delete",
        collectionName: collection,
        recordId: id,
        userId: callerUser?.id || callerUser?.userId,
        userName: callerUser?.username || callerUser?.name,
        userRole: callerUser?.role,
        status: "error",
        errorMessage: mErr?.message || "\u062E\u0637\u0627 \u062F\u0631 \u062D\u0630\u0641 \u062F\u0627\u062F\u0647"
      });
      return {
        success: false,
        error: "\u062E\u0637\u0627 \u062F\u0631 \u062D\u0630\u0641 \u062F\u0627\u062F\u0647. \u0644\u0637\u0641\u0627\u064B \u0628\u0627 \u0645\u062F\u06CC\u0631 \u0633\u06CC\u0633\u062A\u0645 \u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F."
      };
    }
  }
  if (isServerSupabaseConfigured) {
    try {
      const dedicatedTable = COLLECTION_TABLE_MAP[collection];
      if (dedicatedTable) {
        try {
          await serverSupabase.from(dedicatedTable).delete().eq("id", id);
        } catch (dErr) {
          console.warn(`[Supabase Dedicated Table Delete Bypass] ${dedicatedTable}:`, dErr);
        }
      }
      const { error: appErr } = await serverSupabase.from("app_collections").delete().eq("collection_name", collection).eq("id", id);
      if (appErr) {
        console.error(`[Supabase Delete Error] Collection: "${collection}", ID: "${id}":`, appErr.message);
        return { success: false, error: "\u062E\u0637\u0627 \u062F\u0631 \u062D\u0630\u0641 \u062F\u0627\u062F\u0647. \u0644\u0637\u0641\u0627\u064B \u0628\u0627 \u0645\u062F\u06CC\u0631 \u0633\u06CC\u0633\u062A\u0645 \u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F." };
      }
      notifyRealtimeChange(collection, id, "delete");
      return { success: true };
    } catch (err) {
      console.error(`[Supabase Delete Fatal Exception] Collection: "${collection}", ID: "${id}":`, err?.message || err, err?.stack);
      return { success: false, error: "\u062E\u0637\u0627 \u062F\u0631 \u062D\u0630\u0641 \u062F\u0627\u062F\u0647. \u0644\u0637\u0641\u0627\u064B \u0628\u0627 \u0645\u062F\u06CC\u0631 \u0633\u06CC\u0633\u062A\u0645 \u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F." };
    }
  }
  console.error(`[Database Error] No database configured for deleting from collection: "${collection}"`);
  return {
    success: false,
    error: "\u0647\u06CC\u0686 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633\u06CC \u062A\u0646\u0638\u06CC\u0645 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627\u064B Environment Variables \u0631\u0627 \u0686\u06A9 \u06A9\u0646\u06CC\u062F."
  };
}
async function fetchRawCollectionData(collection) {
  if (isMysqlConfigured) {
    try {
      const mysqlItems = await MysqlRepository.queryCollection(collection);
      return mysqlItems || [];
    } catch (mErr) {
      console.error(`[MySQL Raw Query Error for ${collection}]:`, mErr?.message || mErr);
      if (mErr?.stack) console.error(`[MySQL Stack Trace]:`, mErr.stack);
      return [];
    }
  }
  if (isServerSupabaseConfigured) {
    try {
      const dedicatedTable = COLLECTION_TABLE_MAP[collection];
      if (dedicatedTable) {
        const { data: data2, error: error2 } = await serverSupabase.from(dedicatedTable).select("*");
        if (!error2 && data2 && data2.length > 0) {
          return data2.map((item) => {
            if (item.data && typeof item.data === "object") {
              return { ...item.data, id: item.id };
            }
            return item;
          });
        }
      }
      const { data, error } = await serverSupabase.from("app_collections").select("id, data").eq("collection_name", collection);
      if (!error && data && data.length > 0) {
        return (data || []).map((r) => ({ ...r.data || {}, id: r.id }));
      }
    } catch (err) {
      console.error(`Query raw collection exception ${collection}:`, err);
    }
  }
  return [];
}
function canUserReadDoc(user, collection, doc, context) {
  if (!user) {
    return PUBLIC_READ_COLLECTIONS.has(collection);
  }
  if (user.level === 1 || user.role === "super_admin" || user.role === "school_manager") {
    return true;
  }
  if (collection === "students") {
    if (user.role === "education_manager" || user.role === "education_officer") {
      return true;
    }
    if (user.role === "grade_mentor") {
      const mentorGrade = user.gradeLabel || user.grade;
      return mentorGrade ? String(doc.grade || "").trim() === String(mentorGrade).trim() : false;
    }
    if (user.role === "teacher") {
      if (context?.enrolledStudentIds && context?.teacherGrades) {
        const sId = String(doc.id || "");
        const sGrade = String(doc.grade || "").trim();
        return context.enrolledStudentIds.has(sId) || context.teacherGrades.size > 0 && context.teacherGrades.has(sGrade);
      }
      return false;
    }
    if (user.role === "student" || user.level === 3) {
      const uUsername = String(user.username || "").trim().toUpperCase();
      const uStudentId = String(user.studentId || user.id || "").trim();
      const sId = String(doc.id || "").trim();
      const sCode = String(doc.studentCode || "").trim().toUpperCase();
      const sNat = String(doc.nationalId || doc.nationalCode || "").trim();
      return uStudentId && sId === uStudentId || uUsername && (sCode === uUsername || sNat === uUsername);
    }
    if (user.role === "class_representative") {
      const repGrade = user.gradeLabel || user.grade;
      return repGrade ? String(doc.grade || "").trim() === String(repGrade).trim() : false;
    }
    return false;
  }
  if (collection === "periodic_study_logs") {
    if (user.role === "student" || user.level === 3) {
      const uStudentId = String(user.studentId || user.linkedStudentId || user.id || "").trim();
      const docStudentId = String(doc.studentId || doc.student_id || "").trim();
      if (!uStudentId || !docStudentId) {
        return false;
      }
      return uStudentId === docStudentId;
    }
    return true;
  }
  if (FINANCIAL_COLLECTIONS.has(collection)) {
    const isFinanceStaff = user.role === "finance_manager" || user.role === "financial_officer" || user.username?.toUpperCase() === "MALI";
    if (isFinanceStaff) {
      return true;
    }
    if (collection === "tuition_records" && (user.role === "student" || user.level === 3)) {
      const uUsername = String(user.username || "").trim().toUpperCase();
      const uStudentId = String(user.studentId || user.id || "").trim();
      const rStudentId = String(doc.studentId || doc.student_id || "").trim();
      const rStudentCode = String(doc.studentCode || doc.student_code || "").trim().toUpperCase();
      return uStudentId && rStudentId === uStudentId || uUsername && rStudentCode === uUsername;
    }
    return false;
  }
  if (collection === "system_users") {
    return user.level === 1 || user.role === "education_manager";
  }
  if (collection === "personal_todos") {
    return doc.userId === user.id || doc.user_id === user.id;
  }
  if (collection === "counseling_session_grades") {
    if (user.role === "teacher") {
      const teacherName = (user.name || user.fullName || "").trim();
      const cleanTeacher = cleanTeacherName(teacherName);
      const csTeacher = doc.teacherName || doc.counselorName || doc.teacher || "";
      return cleanTeacher && cleanTeacherName(csTeacher) === cleanTeacher;
    }
    if (user.role === "student" || user.level === 3) {
      const uId = user.studentId || user.id;
      return doc.studentId === uId || doc.student_id === uId;
    }
  }
  if (collection === "student_requests") {
    if (user.level === 1 || user.role === "super_admin" || user.role === "school_manager" || user.role === "education_manager" || user.role === "education_officer" || user.role === "finance_manager" || user.role === "financial_officer" || user.role === "cultural_officer" || user.role === "grade_mentor") {
      return true;
    }
    if (user.role === "student" || user.level === 3) {
      const uStudentId = String(user.studentId || user.linkedStudentId || user.id || "").trim();
      const uUsername = String(user.username || "").trim().toUpperCase();
      const uName = String(user.name || user.fullName || "").trim();
      const docStudentId = String(doc.studentId || doc.student_id || "").trim();
      const docNat = String(doc.nationalCode || doc.national_id || "").trim().toUpperCase();
      const docName = String(doc.studentName || doc.student_name || "").trim();
      return uStudentId && docStudentId === uStudentId || uUsername && (docNat === uUsername || docStudentId === uUsername) || uName && docName === uName;
    }
  }
  return true;
}
async function fetchRawDocumentsByIds(collection, ids) {
  if (!ids || ids.length === 0) return [];
  if (isMysqlConfigured) {
    try {
      const mysqlDocs = await MysqlRepository.getDocumentsByIds(collection, ids);
      return mysqlDocs || [];
    } catch (mErr) {
      console.error(`[MySQL Get Docs Fatal Error for ${collection}]:`, mErr?.message || mErr);
      if (mErr?.stack) console.error(`[MySQL Stack Trace]:`, mErr.stack);
      return [];
    }
  }
  if (isServerSupabaseConfigured) {
    try {
      const { data, error } = await serverSupabase.from("app_collections").select("id, data").eq("collection_name", collection).in("id", ids);
      if (!error && data) {
        return data.map((r) => ({ ...r.data || {}, id: r.id }));
      }
    } catch (err) {
      console.error(`Get raw documents exception ${collection}:`, err);
    }
  }
  return [];
}
async function serverGetDocByCandidateIds(collection, candidateIds, user) {
  if (!candidateIds || candidateIds.length === 0) return null;
  if (!user) {
    if (PUBLIC_READ_COLLECTIONS.has(collection)) {
      const rawDocs = await fetchRawDocumentsByIds(collection, candidateIds);
      return rawDocs[0] || null;
    }
    return null;
  }
  const authCheck = authorizeCollectionAccess(user, collection, "read");
  if (!authCheck.allowed) {
    return null;
  }
  const docs = await fetchRawDocumentsByIds(collection, candidateIds);
  if (!docs || docs.length === 0) return null;
  const allowedDocs = docs.filter((doc) => canUserReadDoc(user, collection, doc));
  if (allowedDocs.length === 0) return null;
  if (allowedDocs.length > 1) {
    const logDoc = allowedDocs.find((d) => String(d.id).startsWith("log_"));
    if (logDoc) return logDoc;
  }
  return allowedDocs[0];
}
async function serverQueryCollection(collection, user) {
  if (!user) {
    if (PUBLIC_READ_COLLECTIONS.has(collection)) {
      return fetchRawCollectionData(collection);
    }
    return [];
  }
  const rawItems = await fetchRawCollectionData(collection);
  if (!rawItems || rawItems.length === 0) return [];
  if (user.level === 1 || user.role === "super_admin" || user.role === "school_manager") {
    return rawItems;
  }
  let context = {};
  if (collection === "students" && user.role === "teacher") {
    const teacherId = user.teacherId || user.id || user.linkedTeacherId;
    const teacherName = (user.name || user.fullName || "").trim();
    const cleanTeacher = cleanTeacherName(teacherName);
    const programs = await fetchRawCollectionData("programs");
    const teacherPrograms = programs.filter((p) => {
      const pTeacherId = p.teacherId || p.teacher_id;
      const pTeacherName = p.teacher || p.teacherName || p.teacher_name || "";
      if (teacherId && pTeacherId && (pTeacherId === teacherId || pTeacherId === user.id)) return true;
      if (cleanTeacher && pTeacherName && cleanTeacherName(pTeacherName) === cleanTeacher) return true;
      return false;
    });
    const teacherProgramIds = new Set(teacherPrograms.map((p) => String(p.id)));
    const teacherGrades = /* @__PURE__ */ new Set();
    teacherPrograms.forEach((p) => {
      if (p.grade) teacherGrades.add(String(p.grade).trim());
    });
    const schedules = await fetchRawCollectionData("teacher_schedules");
    schedules.forEach((sch) => {
      const schTeacherId = sch.teacherId || sch.teacher_id;
      const schTeacherName = sch.teacher_name || sch.teacherName || "";
      if (teacherId && schTeacherId === teacherId || cleanTeacher && schTeacherName && cleanTeacherName(schTeacherName) === cleanTeacher) {
        if (sch.grade) teacherGrades.add(String(sch.grade).trim());
      }
    });
    const enrollments = await fetchRawCollectionData("enrollments");
    const enrolledStudentIds = /* @__PURE__ */ new Set();
    enrollments.forEach((enr) => {
      if (teacherProgramIds.has(String(enr.programId || enr.program_id))) {
        enrolledStudentIds.add(String(enr.studentId || enr.student_id));
      }
    });
    context = { enrolledStudentIds, teacherGrades };
  }
  return rawItems.filter((item) => canUserReadDoc(user, collection, item, context));
}
async function fetchBootstrapData(userLevel, userRole) {
  const collections = [
    "students",
    "teachers",
    "programs",
    "enrollments",
    "study_periods",
    "classrooms",
    "attendance",
    "finance_expenses",
    "finance_loans",
    "tuition_periods",
    "tuition_records",
    "student_requests",
    "workflow_items",
    "system_users",
    "academic_calendar_periods",
    "academic_holidays",
    "article_evaluations",
    "received_articles",
    "student_lockers",
    "personal_todos",
    "assigned_todos",
    "evaluation_requests",
    "research",
    "study_stats",
    "periodic_study_logs",
    "discussion_groups",
    "academic_sub_periods"
  ];
  const result = {};
  for (const col of collections) {
    try {
      result[col] = await serverQueryCollection(col, userLevel, userRole);
    } catch (e) {
      result[col] = [];
    }
  }
  return result;
}
var realtimeListeners, COLLECTION_TABLE_MAP, FINANCIAL_COLLECTIONS, USER_SPECIFIC_COLLECTIONS, PUBLIC_READ_COLLECTIONS;
var init_serverDataApi = __esm({
  "src/lib/serverDataApi.ts"() {
    init_serverAuth();
    init_databaseAbstraction();
    init_auditLogger();
    realtimeListeners = /* @__PURE__ */ new Set();
    COLLECTION_TABLE_MAP = {
      system_users: "system_users",
      users: "system_users",
      students: "students",
      teachers: "teachers",
      classrooms: "classrooms",
      classes: "classrooms",
      programs: "programs",
      enrollments: "enrollments",
      attendance: "attendance",
      study_periods: "study_periods",
      study_stats: "study_stats",
      periodic_study_logs: "periodic_study_logs",
      discussion_groups: "discussion_groups",
      research: "research",
      research_records: "research",
      received_articles: "received_articles",
      article_evaluations: "article_evaluations",
      evaluation_requests: "evaluation_requests",
      tuition_periods: "tuition_periods",
      tuition_records: "tuition_records",
      finance_loans: "finance_loans",
      finance_expenses: "finance_expenses",
      finance_operational_expenses: "finance_expenses",
      personal_todos: "personal_todos",
      assigned_todos: "assigned_todos",
      user_todo_categories: "user_todo_categories",
      course_selection_periods: "course_selection_periods",
      course_selection_requests: "course_selection_requests",
      student_requests: "student_requests",
      global_requests_config: "global_requests_config",
      unit_request_settings: "unit_request_settings",
      student_lockers: "student_lockers",
      lockers: "student_lockers",
      audit_logs: "audit_logs"
    };
    FINANCIAL_COLLECTIONS = /* @__PURE__ */ new Set([
      "tuition_records",
      "tuition_periods",
      "finance_loans",
      "finance_expenses",
      "finance_operational_expenses",
      "finance_budget_rows",
      "finance_student_claims"
    ]);
    USER_SPECIFIC_COLLECTIONS = /* @__PURE__ */ new Set([
      "personal_todos",
      "user_todo_categories"
    ]);
    PUBLIC_READ_COLLECTIONS = /* @__PURE__ */ new Set([
      "academic_holidays",
      "academic_calendar_periods",
      "school_events"
    ]);
  }
});

// src/lib/serverAuth.ts
var serverAuth_exports = {};
__export(serverAuth_exports, {
  DEFAULT_SERVER_USERS: () => DEFAULT_SERVER_USERS,
  checkEndpointRateLimit: () => checkEndpointRateLimit,
  checkIdleTimeout: () => checkIdleTimeout,
  checkRateLimit: () => checkRateLimit,
  comparePassword: () => comparePassword,
  deleteUserFromStorage: () => deleteUserFromStorage,
  dummyPasswordCheck: () => dummyPasswordCheck,
  fetchAllUsersFromStorage: () => fetchAllUsersFromStorage,
  generateTokens: () => generateTokens,
  hashPassword: () => hashPassword,
  isServerSupabaseConfigured: () => isServerSupabaseConfigured,
  logServerAudit: () => logServerAudit2,
  migrateAllPlainPasswords: () => migrateAllPlainPasswords,
  normalizeDigits: () => normalizeDigits,
  querySupabaseWithTimeout: () => querySupabaseWithTimeout,
  recordFailedAttempt: () => recordFailedAttempt,
  resetFailedAttempts: () => resetFailedAttempts,
  revokeAllUserSessions: () => revokeAllUserSessions,
  revokeToken: () => revokeToken,
  sanitizeUser: () => sanitizeUser,
  saveUserToStorage: () => saveUserToStorage,
  serverSupabase: () => serverSupabase,
  trackSecurityIncident: () => trackSecurityIncident,
  triggerSecurityAlert: () => triggerSecurityAlert,
  updateLastActivity: () => updateLastActivity,
  validatePasswordStrength: () => validatePasswordStrength,
  validateRole: () => validateRole,
  validateUsername: () => validateUsername,
  verifyAccessToken: () => verifyAccessToken2,
  verifyRefreshToken: () => verifyRefreshToken
});
function loadUsersFromFile() {
  try {
    if (import_fs2.default.existsSync(USERS_FILE_PATH)) {
      const content = import_fs2.default.readFileSync(USERS_FILE_PATH, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Could not read users from file:", e);
  }
  return [];
}
function saveUsersToFile(users) {
  try {
    const dir = import_path2.default.dirname(USERS_FILE_PATH);
    if (!import_fs2.default.existsSync(dir)) {
      import_fs2.default.mkdirSync(dir, { recursive: true });
    }
    import_fs2.default.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not write users to file:", e);
  }
}
async function querySupabaseWithTimeout(promise, timeoutMs = 1200) {
  let timer;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const res = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    return null;
  }
}
function validateUsername(username) {
  if (!username) return { valid: false, message: "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." };
  const clean = username.trim();
  if (clean.length < 2 || clean.length > 50) {
    return { valid: false, message: "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0628\u0627\u06CC\u062F \u0628\u06CC\u0646 \u06F2 \u062A\u0627 \u06F5\u06F0 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F." };
  }
  if (!/^[a-zA-Z0-9_\u0600-\u06FF\s-]+$/.test(clean)) {
    return { valid: false, message: "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0641\u0642\u0637 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0634\u0627\u0645\u0644 \u062D\u0631\u0648\u0641\u060C \u0627\u0639\u062F\u0627\u062F \u0648 \u062E\u0637 \u062A\u06CC\u0631\u0647 \u0628\u0627\u0634\u062F." };
  }
  return { valid: true };
}
function validateRole(role, level) {
  const allowedRoles = [
    "super_admin",
    "school_manager",
    "education_manager",
    "education_officer",
    "grade_mentor",
    "research_manager",
    "finance_manager",
    "financial_officer",
    "class_representative",
    "student",
    "teacher",
    "custom"
  ];
  if (!allowedRoles.includes(role)) {
    return { valid: false, message: "\u0646\u0642\u0634 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A." };
  }
  if (![1, 2, 3].includes(Number(level))) {
    return { valid: false, message: "\u0633\u0637\u062D \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0627\u06CC\u062F \u06F1\u060C \u06F2 \u06CC\u0627 \u06F3 \u0628\u0627\u0634\u062F." };
  }
  return { valid: true };
}
function updateLastActivity(userId) {
  if (userId) {
    userLastActivity.set(userId, Date.now());
  }
}
function checkIdleTimeout(userId) {
  if (!userId) return true;
  const lastActive = userLastActivity.get(userId);
  if (!lastActive) {
    userLastActivity.set(userId, Date.now());
    return true;
  }
  if (Date.now() - lastActive > IDLE_TIMEOUT_MS) {
    userLastActivity.delete(userId);
    return false;
  }
  userLastActivity.set(userId, Date.now());
  return true;
}
async function dummyPasswordCheck(password) {
  try {
    await import_bcryptjs2.default.compare(password || "dummy", DUMMY_HASH);
  } catch (e) {
  }
}
function checkEndpointRateLimit(key, maxRequests, windowMs) {
  const now = Date.now();
  let tracker = endpointLimits.get(key);
  if (!tracker || now > tracker.resetAt) {
    tracker = { count: 1, resetAt: now + windowMs };
    endpointLimits.set(key, tracker);
    return { allowed: true, remaining: maxRequests - 1 };
  }
  tracker.count += 1;
  if (tracker.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: maxRequests - tracker.count };
}
function triggerSecurityAlert(type, details) {
  const now = Date.now();
  const alertPayload = {
    severity: "HIGH",
    type,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    details
  };
  console.warn(`[\u{1F6A8} SECURITY ALERT] ${type}:`, JSON.stringify(alertPayload));
  logServerAudit2({
    userId: details.userId || "system",
    username: details.username || "unknown",
    action: `ALERT_${type}`,
    entityType: "security_alert",
    entityId: details.ip || "system",
    description: `\u0647\u0634\u062F\u0627\u0631 \u0627\u0645\u0646\u06CC\u062A\u06CC: ${type} - ${JSON.stringify(details)}`,
    ipAddress: details.ip || "0.0.0.0"
  }).catch(() => {
  });
}
function trackSecurityIncident(ip, userId, eventType) {
  const now = Date.now();
  const key = ip || userId || "unknown";
  let tracker = incidentCounters.get(key);
  if (!tracker) {
    tracker = {
      failedLogins: { count: 0, windowStart: now },
      forbiddenRequests: { count: 0, windowStart: now }
    };
    incidentCounters.set(key, tracker);
  }
  if (eventType === "LOGIN_FAILED") {
    if (now - tracker.failedLogins.windowStart > 60 * 60 * 1e3) {
      tracker.failedLogins = { count: 1, windowStart: now };
    } else {
      tracker.failedLogins.count += 1;
      if (tracker.failedLogins.count >= 10) {
        triggerSecurityAlert("EXCESSIVE_FAILED_LOGINS", { ip, count: tracker.failedLogins.count });
      }
    }
  }
  if (eventType === "FORBIDDEN") {
    if (now - tracker.forbiddenRequests.windowStart > 10 * 60 * 1e3) {
      tracker.forbiddenRequests = { count: 1, windowStart: now };
    } else {
      tracker.forbiddenRequests.count += 1;
      if (tracker.forbiddenRequests.count >= 5) {
        triggerSecurityAlert("EXCESSIVE_FORBIDDEN_ATTEMPTS", { ip, userId, count: tracker.forbiddenRequests.count });
      }
    }
  }
}
function checkRateLimit(ip, username) {
  const cleanUser = (username || "").trim().toUpperCase();
  if (cleanUser === "SADEGH") {
    return { allowed: true };
  }
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1e3;
  const MAX_IP_ATTEMPTS = 15;
  const MAX_USER_ATTEMPTS = 5;
  let ipTrack = ipAttempts.get(ip);
  if (!ipTrack || now - ipTrack.firstAttempt > WINDOW_MS) {
    ipTrack = { count: 0, firstAttempt: now };
    ipAttempts.set(ip, ipTrack);
  }
  if (ipTrack.lockedUntil && now < ipTrack.lockedUntil) {
    const waitMinutes = Math.ceil((ipTrack.lockedUntil - now) / 6e4);
    return { allowed: false, waitMinutes };
  }
  let userTrack = usernameAttempts.get(cleanUser);
  if (!userTrack || now - userTrack.firstAttempt > WINDOW_MS) {
    userTrack = { count: 0, firstAttempt: now };
    usernameAttempts.set(cleanUser, userTrack);
  }
  if (userTrack.lockedUntil && now < userTrack.lockedUntil) {
    const waitMinutes = Math.ceil((userTrack.lockedUntil - now) / 6e4);
    return { allowed: false, waitMinutes };
  }
  if (ipTrack.count >= MAX_IP_ATTEMPTS) {
    ipTrack.lockedUntil = now + WINDOW_MS;
    return { allowed: false, waitMinutes: 15 };
  }
  if (userTrack.count >= MAX_USER_ATTEMPTS) {
    userTrack.lockedUntil = now + WINDOW_MS;
    return { allowed: false, waitMinutes: 15 };
  }
  return { allowed: true };
}
function recordFailedAttempt(ip, username) {
  const cleanUser = (username || "").trim().toUpperCase();
  if (cleanUser === "SADEGH") return;
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1e3;
  const ipTrack = ipAttempts.get(ip) || { count: 0, firstAttempt: now };
  ipTrack.count += 1;
  ipAttempts.set(ip, ipTrack);
  const userTrack = usernameAttempts.get(cleanUser) || { count: 0, firstAttempt: now };
  userTrack.count += 1;
  if (userTrack.count >= 5) {
    userTrack.lockedUntil = now + WINDOW_MS;
  }
  usernameAttempts.set(cleanUser, userTrack);
}
function resetFailedAttempts(ip, username) {
  ipAttempts.delete(ip);
  usernameAttempts.delete(username.trim().toUpperCase());
}
function normalizeDigits(input) {
  if (input === void 0 || input === null) return "";
  const str = String(input);
  return str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728)).replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
}
async function hashPassword(plainText) {
  const normalized = normalizeDigits(plainText);
  const salt = await import_bcryptjs2.default.genSalt(10);
  return import_bcryptjs2.default.hash(normalized, salt);
}
async function comparePassword(plainText, hash) {
  if (!plainText) return false;
  if (!hash) return false;
  const normalizedPlain = normalizeDigits(plainText);
  if (!hash.startsWith("$2a$") && !hash.startsWith("$2b$")) {
    return normalizedPlain === hash || plainText === hash;
  }
  return import_bcryptjs2.default.compare(normalizedPlain, hash);
}
function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F8 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F." };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase().trim())) {
    return { valid: false, message: "\u0627\u06CC\u0646 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0628\u0633\u06CC\u0627\u0631 \u0631\u0627\u06CC\u062C \u0648 \u0636\u0639\u06CC\u0641 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627\u064B \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0642\u0648\u06CC\u200C\u062A\u0631\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F." };
  }
  const hasLetter = /[a-zA-Z\u0600-\u06FF]/.test(password);
  const hasNumber = /[0-9\u06F0-\u06F9]/.test(password);
  if (!hasLetter || !hasNumber) {
    return { valid: false, message: "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0628\u0627\u06CC\u062F \u0634\u0627\u0645\u0644 \u062D\u062F\u0627\u0642\u0644 \u06CC\u06A9 \u062D\u0631\u0641 \u0648 \u06CC\u06A9 \u0639\u062F\u062F \u0628\u0627\u0634\u062F." };
  }
  return { valid: true };
}
function generateTokens(user) {
  const now = Math.floor(Date.now() / 1e3);
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    level: user.level,
    scope: user.scope,
    iat: now
  };
  const token = import_jsonwebtoken.default.sign(payload, JWT_SECRET, { expiresIn: "15m" });
  const refreshToken = import_jsonwebtoken.default.sign({ userId: user.id, username: user.username, iat: now }, JWT_REFRESH_SECRET, { expiresIn: "7d" });
  return { token, refreshToken };
}
function verifyAccessToken2(token) {
  try {
    if (revokedTokens.has(token)) {
      return { valid: false, error: "\u0627\u06CC\u0646 \u0646\u0634\u0633\u062A \u0628\u0627\u0637\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A." };
    }
    const decoded = import_jsonwebtoken.default.verify(token, JWT_SECRET);
    if (!checkIdleTimeout(decoded.userId)) {
      return { valid: false, error: "\u0646\u0634\u0633\u062A \u06A9\u0627\u0631\u0628\u0631\u06CC \u0628\u0647 \u062F\u0644\u06CC\u0644 \u0639\u062F\u0645 \u0641\u0639\u0627\u0644\u06CC\u062A \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A (Idle Timeout)." };
    }
    const revokedAt = userRevocationTimestamp.get(decoded.userId);
    if (revokedAt && decoded.iat && decoded.iat * 1e3 < revokedAt) {
      return { valid: false, error: "\u0646\u0634\u0633\u062A\u200C\u0647\u0627\u06CC \u0627\u06CC\u0646 \u062D\u0633\u0627\u0628 \u062A\u0648\u0633\u0637 \u06A9\u0627\u0631\u0628\u0631 \u06CC\u0627 \u0645\u062F\u06CC\u0631 \u0628\u0627\u0637\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A." };
    }
    return { valid: true, decoded };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "\u062A\u0648\u06A9\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
    return { valid: false, error: errMsg };
  }
}
function verifyRefreshToken(refreshToken) {
  try {
    if (revokedTokens.has(refreshToken)) {
      return { valid: false, error: "\u0627\u06CC\u0646 \u0631\u06CC\u0641\u0631\u0634\u200C\u062A\u0648\u06A9\u0646 \u0628\u0627\u0637\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A." };
    }
    const decoded = import_jsonwebtoken.default.verify(refreshToken, JWT_REFRESH_SECRET);
    const revokedAt = userRevocationTimestamp.get(decoded.userId);
    if (revokedAt && decoded.iat && decoded.iat * 1e3 < revokedAt) {
      return { valid: false, error: "\u0646\u0634\u0633\u062A \u0627\u06CC\u0646 \u062D\u0633\u0627\u0628 \u0628\u0627\u0637\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A." };
    }
    return { valid: true, decoded };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "\u0631\u06CC\u0641\u0631\u0634\u200C\u062A\u0648\u06A9\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
    return { valid: false, error: errMsg };
  }
}
function revokeToken(token) {
  if (token) {
    revokedTokens.add(token);
  }
}
function revokeAllUserSessions(userId) {
  if (userId) {
    userRevocationTimestamp.set(userId, Date.now());
  }
}
function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    roleTitle: user.roleTitle,
    level: user.level,
    isActive: user.isActive,
    avatarBg: user.avatarBg
  };
}
async function fetchAllUsersFromStorage() {
  const usersMap = /* @__PURE__ */ new Map();
  DEFAULT_SERVER_USERS.forEach((u) => usersMap.set(u.username.toUpperCase(), { ...u }));
  serverMemoryUsers.forEach((u, uname) => usersMap.set(uname, { ...u }));
  loadUsersFromFile().forEach((u) => {
    if (u && u.username) {
      const uname = u.username.toUpperCase();
      usersMap.set(uname, { ...usersMap.get(uname), ...u, username: uname });
      serverMemoryUsers.set(uname, { ...usersMap.get(uname), ...u, username: uname });
    }
  });
  if (isMysqlConfigured) {
    try {
      const mysqlUsers = await MysqlRepository.getAllUsers();
      if (mysqlUsers && mysqlUsers.length > 0) {
        mysqlUsers.forEach((u) => {
          const cleanName = u.username.toUpperCase();
          usersMap.set(cleanName, {
            ...usersMap.get(cleanName),
            ...u,
            username: cleanName
          });
        });
        return Array.from(usersMap.values());
      }
    } catch (mErr) {
      console.warn("[MySQL fetchAllUsers notice]:", mErr);
    }
  }
  if (!isServerSupabaseConfigured || Date.now() < supabaseUserFailureBackoffUntil) {
    return Array.from(usersMap.values());
  }
  try {
    const dedicatedPromise = serverSupabase.from("system_users").select("*");
    const dedicatedRes = await querySupabaseWithTimeout(dedicatedPromise, 1200);
    if (dedicatedRes && !dedicatedRes.error && Array.isArray(dedicatedRes.data) && dedicatedRes.data.length > 0) {
      dedicatedRes.data.forEach((row) => {
        const cleanName = (row.username || "").toUpperCase();
        if (cleanName) {
          const rowData = row.data || {};
          usersMap.set(cleanName, {
            id: row.id || cleanName,
            username: cleanName,
            name: row.name || cleanName,
            role: row.role || "student",
            level: row.level || 3,
            roleTitle: row.role_title,
            allowedTabs: Array.isArray(row.allowed_tabs) ? row.allowed_tabs : rowData.allowedTabs || usersMap.get(cleanName)?.allowedTabs || [],
            editableTabs: Array.isArray(row.editable_tabs) ? row.editable_tabs : rowData.editableTabs || usersMap.get(cleanName)?.editableTabs || [],
            modulePermissions: row.module_permissions || rowData.modulePermissions || usersMap.get(cleanName)?.modulePermissions || {},
            isReadOnly: row.is_read_only !== void 0 ? row.is_read_only : rowData.isReadOnly !== void 0 ? row.data.isReadOnly : usersMap.get(cleanName)?.isReadOnly,
            canEdit: row.can_edit !== void 0 ? row.can_edit : rowData.canEdit !== void 0 ? row.data.canEdit : usersMap.get(cleanName)?.canEdit,
            passwordHash: row.password_hash || usersMap.get(cleanName)?.passwordHash,
            password: row.password || usersMap.get(cleanName)?.password,
            mustChangePassword: !!row.must_change_password,
            failedLoginAttempts: row.failed_login_attempts || 0,
            accountLockedUntil: row.account_locked_until,
            lastLogin: row.last_login,
            ...rowData
          });
        }
      });
      return Array.from(usersMap.values());
    }
    const appColPromise = serverSupabase.from("app_collections").select("id, data").eq("collection_name", "system_users");
    const appColRes = await querySupabaseWithTimeout(appColPromise, 1200);
    if (appColRes && !appColRes.error && Array.isArray(appColRes.data) && appColRes.data.length > 0) {
      const allUsersRow = appColRes.data.find((r) => r.id === "all_users");
      if (allUsersRow && Array.isArray(allUsersRow.data?.users)) {
        allUsersRow.data.users.forEach((u) => {
          if (u && u.username) {
            usersMap.set(u.username.toUpperCase(), { ...usersMap.get(u.username.toUpperCase()), ...u });
          }
        });
      }
      for (const row of appColRes.data) {
        if (row.id !== "all_users" && row.data) {
          const u = row.data;
          if (u && u.username) {
            const uname = u.username.toUpperCase();
            usersMap.set(uname, { ...usersMap.get(uname), ...u, username: uname });
          }
        }
      }
    }
  } catch (err) {
    supabaseUserFailureBackoffUntil = Date.now() + 6e4;
  }
  if (!usersMap.has("SADEGH")) {
    const defaultSadegh = DEFAULT_SERVER_USERS.find((u) => u.username === "SADEGH");
    if (defaultSadegh) {
      usersMap.set("SADEGH", { ...defaultSadegh });
    }
  } else {
    const cur = usersMap.get("SADEGH");
    usersMap.set("SADEGH", {
      ...cur,
      username: "SADEGH",
      role: "super_admin",
      level: 1,
      isActive: true,
      canEdit: true,
      canManageUsers: true,
      canBackup: true,
      accountLockedUntil: void 0,
      failedLoginAttempts: 0
    });
  }
  return Array.from(usersMap.values());
}
async function saveUserToStorage(user) {
  const cleanId = (user.username || "").trim().toUpperCase();
  if (cleanId) {
    serverMemoryUsers.set(cleanId, { ...user, username: cleanId });
    saveUsersToFile(Array.from(serverMemoryUsers.values()));
  }
  if (isMysqlConfigured) {
    try {
      await MysqlRepository.saveUser(user);
    } catch (mErr) {
      console.warn("[MySQL saveUser notice]:", mErr);
    }
  }
  if (!isServerSupabaseConfigured) {
    return;
  }
  try {
    try {
      await querySupabaseWithTimeout(
        serverSupabase.from("system_users").upsert({
          id: user.id || cleanId,
          username: cleanId,
          password_hash: user.passwordHash || "",
          name: user.name || "",
          role: user.role || "student",
          level: user.level || 3,
          role_title: user.roleTitle || "",
          allowed_tabs: user.allowedTabs || [],
          editable_tabs: user.editableTabs || [],
          module_permissions: user.modulePermissions || {},
          is_read_only: user.isReadOnly || false,
          can_edit: user.canEdit !== void 0 ? user.canEdit : true,
          must_change_password: !!user.mustChangePassword,
          failed_login_attempts: user.failedLoginAttempts || 0,
          account_locked_until: user.accountLockedUntil || null,
          last_login: user.lastLogin || null,
          data: user,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, { onConflict: "username" }),
        1200
      );
    } catch {
    }
    try {
      await querySupabaseWithTimeout(
        serverSupabase.from("app_collections").upsert({
          collection_name: "system_users",
          id: cleanId,
          data: user,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, { onConflict: "collection_name,id" }),
        1200
      );
    } catch {
    }
    try {
      const currentList = Array.from(serverMemoryUsers.values());
      await querySupabaseWithTimeout(
        serverSupabase.from("app_collections").upsert({
          collection_name: "system_users",
          id: "all_users",
          data: { users: currentList },
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }, { onConflict: "collection_name,id" }),
        1200
      );
    } catch {
    }
  } catch (e) {
    console.error("Error saving user to storage:", e);
  }
}
async function deleteUserFromStorage(userIdOrUsername) {
  const clean = userIdOrUsername.trim().toUpperCase();
  serverMemoryUsers.delete(clean);
  for (const [uname, u] of serverMemoryUsers.entries()) {
    if (u.id === userIdOrUsername) {
      serverMemoryUsers.delete(uname);
    }
  }
  saveUsersToFile(Array.from(serverMemoryUsers.values()));
  if (isMysqlConfigured) {
    try {
      await MysqlRepository.deleteUser(clean);
    } catch (e) {
    }
  }
  if (!isServerSupabaseConfigured) return;
  try {
    await serverSupabase.from("system_users").delete().match({ username: clean });
    await serverSupabase.from("app_collections").delete().match({ collection_name: "system_users", id: clean });
  } catch (e) {
  }
}
async function migrateAllPlainPasswords() {
  const users = await fetchAllUsersFromStorage();
  let migratedCount = 0;
  for (const user of users) {
    let modified = false;
    const plain = user.password;
    const currentHash = user.passwordHash;
    if (plain && (!currentHash || !currentHash.startsWith("$2a$") && !currentHash.startsWith("$2b$"))) {
      user.passwordHash = await hashPassword(plain);
      delete user.password;
      modified = true;
      migratedCount += 1;
    } else if (currentHash && !currentHash.startsWith("$2a$") && !currentHash.startsWith("$2b$")) {
      user.passwordHash = await hashPassword(currentHash);
      delete user.password;
      modified = true;
      migratedCount += 1;
    } else if (user.password) {
      delete user.password;
      modified = true;
    }
    if (modified) {
      await saveUserToStorage(user);
    }
  }
  return { totalUsers: users.length, migratedCount };
}
async function logServerAudit2(params) {
  try {
    const { computeRecordHash: computeRecordHash2 } = await Promise.resolve().then(() => (init_serverAuditChain(), serverAuditChain_exports));
    const nowStr = (/* @__PURE__ */ new Date()).toISOString();
    const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const prevHash = lastKnownAuditHash;
    const currentHash = computeRecordHash2({
      id: logId,
      previous_hash: prevHash,
      user_id: params.userId || "system",
      user_name: params.username || "system",
      role: params.userRole || "system",
      action: params.action,
      module: params.entityType,
      target_id: params.entityId,
      target_type: params.entityType,
      old_values: params.previousState || null,
      new_values: params.newState || null,
      ip_address: params.ipAddress || "",
      created_at: nowStr
    });
    lastKnownAuditHash = currentHash;
    const logEntry = {
      id: logId,
      timestamp: nowStr,
      user_id: params.userId || "system",
      user_name: params.username || "system",
      role: params.userRole || "system",
      action: params.action,
      module: params.entityType,
      target_id: params.entityId,
      target_type: params.entityType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      description: params.description,
      ip_address: params.ipAddress || "",
      previous_hash: prevHash,
      current_hash: currentHash,
      old_values: params.previousState || null,
      new_values: params.newState || null,
      created_at: nowStr
    };
    if (isMysqlConfigured) {
      try {
        await MysqlRepository.recordAuditLog({
          id: logEntry.id,
          userId: params.userId,
          username: params.username,
          userRole: params.userRole,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          description: params.description,
          ipAddress: params.ipAddress
        });
      } catch (mErr) {
      }
    }
    const { serverSaveDoc: serverSaveDoc2 } = await Promise.resolve().then(() => (init_serverDataApi(), serverDataApi_exports));
    await serverSaveDoc2("audit_logs", logId, logEntry);
    if (isServerSupabaseConfigured) {
      await serverSupabase.from("app_collections").upsert({
        collection_name: "audit_logs",
        id: logEntry.id,
        data: logEntry,
        updated_at: nowStr
      });
    }
  } catch (e) {
    console.error("Server audit log error:", e instanceof Error ? e.message : e);
  }
}
var import_bcryptjs2, import_jsonwebtoken, import_supabase_js, import_dotenv2, import_fs2, import_path2, USERS_FILE_PATH, JWT_REFRESH_SECRET, JWT_SECRET, SUPABASE_URL, SUPABASE_KEY, isServerSupabaseConfigured, serverSupabase, supabaseUserFailureBackoffUntil, revokedTokens, userRevocationTimestamp, COMMON_PASSWORDS, userLastActivity, IDLE_TIMEOUT_MS, DUMMY_HASH, endpointLimits, incidentCounters, ipAttempts, usernameAttempts, INITIAL_ADMIN_PASSWORD, DEFAULT_SERVER_USERS, serverMemoryUsers, lastKnownAuditHash;
var init_serverAuth = __esm({
  "src/lib/serverAuth.ts"() {
    import_bcryptjs2 = __toESM(require("bcryptjs"), 1);
    import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
    import_supabase_js = require("@supabase/supabase-js");
    import_dotenv2 = __toESM(require("dotenv"), 1);
    import_fs2 = __toESM(require("fs"), 1);
    import_path2 = __toESM(require("path"), 1);
    init_databaseAbstraction();
    import_dotenv2.default.config();
    USERS_FILE_PATH = import_path2.default.join(process.cwd(), "data", "system_users.json");
    JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.trim().length > 0 ? process.env.JWT_REFRESH_SECRET.trim() : "hosoon_super_secure_refresh_token_secret_key_2026_default_fallback_node_app";
    JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0 ? process.env.JWT_SECRET.trim() : JWT_REFRESH_SECRET + "_access_token_secret";
    SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
    SUPABASE_KEY = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
    isServerSupabaseConfigured = Boolean(
      SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes("your-project-id") && !SUPABASE_KEY.includes("your-supabase") && !SUPABASE_URL.includes("placeholder")
    );
    serverSupabase = (0, import_supabase_js.createClient)(
      SUPABASE_URL || "https://none.supabase.co",
      SUPABASE_KEY || "none_key",
      { auth: { persistSession: false } }
    );
    supabaseUserFailureBackoffUntil = 0;
    revokedTokens = /* @__PURE__ */ new Set();
    userRevocationTimestamp = /* @__PURE__ */ new Map();
    COMMON_PASSWORDS = /* @__PURE__ */ new Set([
      "123456",
      "12345678",
      "123456789",
      "password",
      "1234567890",
      "qwerty",
      "admin",
      "admin123",
      "pass123",
      "iloveyou",
      "welcome"
    ]);
    userLastActivity = /* @__PURE__ */ new Map();
    IDLE_TIMEOUT_MS = 30 * 60 * 1e3;
    DUMMY_HASH = "$2a$10$7EqJtq98hPqEX7fNZaFWoOimwYV351i9tC8O.008u.a4xYqC7z0mG";
    endpointLimits = /* @__PURE__ */ new Map();
    incidentCounters = /* @__PURE__ */ new Map();
    ipAttempts = /* @__PURE__ */ new Map();
    usernameAttempts = /* @__PURE__ */ new Map();
    INITIAL_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || "8411924As";
    DEFAULT_SERVER_USERS = INITIAL_ADMIN_PASSWORD && INITIAL_ADMIN_PASSWORD.length >= 6 ? [
      {
        id: "user_sadegh",
        username: "SADEGH",
        password: INITIAL_ADMIN_PASSWORD,
        name: "\u0635\u0627\u062F\u0642 (\u0633\u0648\u067E\u0631 \u0627\u062F\u0645\u06CC\u0646)",
        level: 1,
        role: "super_admin",
        mustChangePassword: false,
        // Super admin can log straight in
        roleTitle: "\u0633\u0648\u067E\u0631 \u0627\u062F\u0645\u06CC\u0646 (\u0645\u062F\u06CC\u0631 \u06A9\u0644 \u0633\u06CC\u0633\u062A\u0645)",
        scope: "all",
        gradeLabel: "\u06A9\u0644 \u0633\u06CC\u0633\u062A\u0645",
        mentorId: "shahpoori",
        isReadOnly: false,
        canEdit: true,
        canManageUsers: true,
        canBackup: true,
        avatarBg: "bg-indigo-700",
        allowedTabs: [
          "todos",
          "workflow",
          "academic-calendar",
          "presence-hours",
          "finance",
          "students",
          "active-students",
          "discussion",
          "programs",
          "classrooms",
          "student-schedule",
          "teachers-schedule",
          "stats",
          "research",
          "attendance",
          "course-selection",
          "comments",
          "summary",
          "teachers-bank",
          "backup",
          "user-management",
          "user-credentials",
          "audit-logs"
        ]
      },
      {
        id: "user_rahnama",
        username: "RAHNAMA",
        password: INITIAL_ADMIN_PASSWORD,
        name: "\u0627\u0633\u062A\u0627\u062F \u0631\u0647\u0646\u0645\u0627 (\u0645\u062F\u06CC\u0631 \u0645\u062F\u0631\u0633\u0647 / \u0645\u0639\u0627\u0648\u0646)",
        level: 1,
        role: "school_manager",
        roleTitle: "\u0645\u062F\u06CC\u0631 \u0645\u062F\u0631\u0633\u0647 / \u0645\u0639\u0627\u0648\u0646",
        scope: "all",
        gradeLabel: "\u06A9\u0644 \u0633\u06CC\u0633\u062A\u0645 (\u0645\u0634\u0627\u0647\u062F\u0647)",
        mentorId: "shahpoori",
        isReadOnly: true,
        canEdit: false,
        canManageUsers: false,
        canBackup: true,
        avatarBg: "bg-slate-700",
        allowedTabs: [
          "todos",
          "workflow",
          "academic-calendar",
          "presence-hours",
          "finance",
          "students",
          "active-students",
          "discussion",
          "programs",
          "classrooms",
          "student-schedule",
          "teachers-schedule",
          "stats",
          "research",
          "attendance",
          "course-selection",
          "comments",
          "summary",
          "teachers-bank",
          "backup",
          "user-credentials",
          "audit-logs"
        ]
      },
      {
        id: "user_shah",
        username: "SHAH",
        password: INITIAL_ADMIN_PASSWORD,
        name: "\u0627\u0633\u062A\u0627\u062F \u0634\u0627\u0647\u067E\u0648\u0631\u06CC (\u0645\u0633\u0626\u0648\u0644 \u0622\u0645\u0648\u0632\u0634)",
        level: 2,
        role: "education_manager",
        mustChangePassword: true,
        roleTitle: "\u0645\u0633\u0626\u0648\u0644 \u0622\u0645\u0648\u0632\u0634",
        scope: "all",
        gradeLabel: "\u06A9\u0644 \u067E\u0627\u06CC\u0647\u200C\u0647\u0627",
        mentorId: "shahpoori",
        isReadOnly: false,
        canEdit: true,
        canManageUsers: false,
        canBackup: true,
        avatarBg: "bg-amber-600",
        allowedTabs: [
          "todos",
          "workflow",
          "academic-calendar",
          "students",
          "active-students",
          "programs",
          "classrooms",
          "student-schedule",
          "teachers-schedule",
          "consultation-advisor",
          "counseling-classes",
          "discussion",
          "stats",
          "attendance",
          "course-selection",
          "comments",
          "summary",
          "teachers-bank",
          "backup",
          "user-credentials",
          "audit-logs"
        ]
      },
      {
        id: "user_isj",
        username: "ISJ",
        password: INITIAL_ADMIN_PASSWORD,
        name: "\u0627\u0633\u062A\u0627\u062F \u062D\u06CC\u0627\u062A\u06CC (\u0645\u0633\u0626\u0648\u0644 \u067E\u0627\u06CC\u0647 \u06F7)",
        level: 2,
        role: "grade_mentor",
        mustChangePassword: true,
        roleTitle: "\u0645\u0633\u0626\u0648\u0644 \u067E\u0627\u06CC\u0647 \u06F7",
        scope: "grade_7",
        gradeLabel: "\u067E\u0627\u06CC\u0647 \u06F7",
        mentorId: "hayati",
        isReadOnly: false,
        canEdit: true,
        canManageUsers: false,
        canBackup: false,
        avatarBg: "bg-emerald-600",
        allowedTabs: [
          "todos",
          "workflow",
          "academic-calendar",
          "students",
          "active-students",
          "programs",
          "classrooms",
          "student-schedule",
          "teachers-schedule",
          "consultation-advisor",
          "counseling-classes",
          "discussion",
          "stats",
          "attendance",
          "comments",
          "summary",
          "teachers-bank",
          "user-credentials"
        ]
      },
      {
        id: "user_ho",
        username: "HO",
        password: INITIAL_ADMIN_PASSWORD,
        name: "\u0627\u0633\u062A\u0627\u062F \u062D\u0633\u06CC\u0646\u06CC (\u0645\u0633\u0626\u0648\u0644 \u067E\u0627\u06CC\u0647 \u06F8)",
        level: 2,
        role: "grade_mentor",
        mustChangePassword: true,
        roleTitle: "\u0645\u0633\u0626\u0648\u0644 \u067E\u0627\u06CC\u0647 \u06F8",
        scope: "grade_8",
        gradeLabel: "\u067E\u0627\u06CC\u0647 \u06F8",
        mentorId: "hosseini",
        isReadOnly: false,
        canEdit: true,
        canManageUsers: false,
        canBackup: false,
        avatarBg: "bg-sky-600",
        allowedTabs: [
          "todos",
          "workflow",
          "academic-calendar",
          "students",
          "active-students",
          "programs",
          "classrooms",
          "student-schedule",
          "teachers-schedule",
          "consultation-advisor",
          "counseling-classes",
          "discussion",
          "stats",
          "attendance",
          "comments",
          "summary",
          "teachers-bank",
          "user-credentials"
        ]
      },
      {
        id: "user_sol",
        username: "SOL",
        password: INITIAL_ADMIN_PASSWORD,
        name: "\u0627\u0633\u062A\u0627\u062F \u0633\u0644\u06CC\u0645\u0627\u0646\u06CC (\u0645\u0633\u0626\u0648\u0644 \u067E\u0627\u06CC\u0647 \u06F9)",
        level: 2,
        role: "grade_mentor",
        mustChangePassword: true,
        roleTitle: "\u0645\u0633\u0626\u0648\u0644 \u067E\u0627\u06CC\u0647 \u06F9",
        scope: "grade_9",
        gradeLabel: "\u067E\u0627\u06CC\u0647 \u06F9",
        mentorId: "soleimani",
        isReadOnly: false,
        canEdit: true,
        canManageUsers: false,
        canBackup: false,
        avatarBg: "bg-purple-600",
        allowedTabs: [
          "todos",
          "workflow",
          "academic-calendar",
          "students",
          "active-students",
          "programs",
          "classrooms",
          "student-schedule",
          "teachers-schedule",
          "consultation-advisor",
          "counseling-classes",
          "discussion",
          "stats",
          "attendance",
          "comments",
          "summary",
          "teachers-bank",
          "user-credentials"
        ]
      },
      {
        id: "user_asadi",
        username: "ASADI",
        password: INITIAL_ADMIN_PASSWORD,
        name: "\u0627\u0633\u062A\u0627\u062F \u0627\u0633\u062F\u06CC (\u0645\u0633\u0626\u0648\u0644 \u067E\u0627\u06CC\u0647 \u06F1\u06F0)",
        level: 2,
        role: "grade_mentor",
        mustChangePassword: true,
        roleTitle: "\u0645\u0633\u0626\u0648\u0644 \u067E\u0627\u06CC\u0647 \u06F1\u06F0",
        scope: "grade_10",
        gradeLabel: "\u067E\u0627\u06CC\u0647 \u06F1\u06F0",
        mentorId: "asadi",
        isReadOnly: false,
        canEdit: true,
        canManageUsers: false,
        canBackup: false,
        avatarBg: "bg-rose-600",
        allowedTabs: [
          "todos",
          "workflow",
          "academic-calendar",
          "students",
          "active-students",
          "programs",
          "classrooms",
          "student-schedule",
          "teachers-schedule",
          "consultation-advisor",
          "counseling-classes",
          "discussion",
          "stats",
          "attendance",
          "comments",
          "summary",
          "teachers-bank",
          "user-credentials"
        ]
      },
      {
        id: "user_yazdani",
        username: "YAZDANI",
        password: INITIAL_ADMIN_PASSWORD,
        name: "\u0627\u0633\u062A\u0627\u062F \u06CC\u0632\u062F\u0627\u0646\u06CC (\u0645\u0633\u0626\u0648\u0644 \u067E\u0698\u0648\u0647\u0634)",
        level: 2,
        role: "research_manager",
        mustChangePassword: true,
        roleTitle: "\u0645\u0633\u0626\u0648\u0644 \u067E\u0698\u0648\u0647\u0634",
        scope: "all",
        gradeLabel: "\u0628\u062E\u0634 \u067E\u0698\u0648\u0647\u0634",
        mentorId: "shahpoori",
        isReadOnly: false,
        canEdit: true,
        canManageUsers: false,
        canBackup: false,
        avatarBg: "bg-teal-600",
        allowedTabs: [
          "active-students",
          "research",
          "article-evaluations",
          "counseling-classes",
          "todos",
          "workflow",
          "programs",
          "classrooms",
          "teachers-schedule",
          "user-credentials"
        ]
      },
      {
        id: "user_mali",
        username: "MALI",
        password: INITIAL_ADMIN_PASSWORD,
        name: "\u0645\u0633\u0626\u0648\u0644 \u0645\u0627\u0644\u06CC \u0648 \u0627\u062F\u0627\u0631\u06CC",
        level: 2,
        role: "finance_manager",
        mustChangePassword: true,
        roleTitle: "\u0645\u0633\u0626\u0648\u0644 \u0645\u0627\u0644\u06CC \u0648 \u06A9\u0627\u0631\u06A9\u0631\u062F",
        scope: "all",
        gradeLabel: "\u0627\u0645\u0648\u0631 \u0645\u0627\u0644\u06CC",
        mentorId: "shahpoori",
        isReadOnly: false,
        canEdit: true,
        canManageUsers: false,
        canBackup: false,
        avatarBg: "bg-cyan-700",
        allowedTabs: [
          "finance-tuition",
          "finance-grade-mentors",
          "finance-teachers",
          "finance-lunch",
          "finance-loans-fund",
          "finance-expenses-reports",
          "workflow",
          "todos",
          "academic-calendar",
          "students",
          "teachers-bank",
          "finance",
          "user-credentials"
        ]
      }
    ] : [];
    serverMemoryUsers = /* @__PURE__ */ new Map();
    DEFAULT_SERVER_USERS.forEach((u) => serverMemoryUsers.set(u.username.toUpperCase(), { ...u }));
    loadUsersFromFile().forEach((u) => {
      if (u && u.username) {
        serverMemoryUsers.set(u.username.toUpperCase(), { ...u });
      }
    });
    lastKnownAuditHash = "0000000000000000000000000000000000000000000000000000000000000000";
  }
});

// src/lib/serverBackupEngine.ts
var serverBackupEngine_exports = {};
__export(serverBackupEngine_exports, {
  applyBackupRetentionPolicy: () => applyBackupRetentionPolicy,
  computeDataChecksum: () => computeDataChecksum,
  createFullDatabaseSnapshot: () => createFullDatabaseSnapshot,
  initScheduledBackupService: () => initScheduledBackupService,
  listOnDiskBackups: () => listOnDiskBackups,
  restoreDatabaseSnapshot: () => restoreDatabaseSnapshot
});
function computeDataChecksum(data) {
  const jsonString = JSON.stringify(data);
  return import_crypto2.default.createHash("sha256").update(jsonString, "utf8").digest("hex");
}
async function createFullDatabaseSnapshot(operatorName = "system", isAutomated = false) {
  const databaseData = {};
  let totalRecords = 0;
  for (const collName of ALL_SYSTEM_COLLECTIONS) {
    try {
      const records = await serverQueryCollection(collName);
      databaseData[collName] = Array.isArray(records) ? records : [];
      totalRecords += databaseData[collName].length;
    } catch (err) {
      databaseData[collName] = [];
    }
  }
  const checksum = computeDataChecksum(databaseData);
  const nowStr = (/* @__PURE__ */ new Date()).toISOString();
  const metadata = {
    version: "5.2.0",
    timestamp: nowStr,
    collectionsCount: ALL_SYSTEM_COLLECTIONS.length,
    totalRecordsCount: totalRecords,
    checksum,
    createdBy: operatorName,
    isAutomated
  };
  const payload = {
    metadata,
    data: databaseData
  };
  try {
    const fileName = `madrasah_backup_${nowStr.replace(/[:.]/g, "-").substring(0, 19)}.json`;
    const filePath = import_path3.default.join(BACKUP_DIR, fileName);
    import_fs3.default.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    applyBackupRetentionPolicy();
  } catch (err) {
    console.warn("Could not save snapshot file to disk:", err);
  }
  return payload;
}
async function restoreDatabaseSnapshot(payload, operatorName = "super_admin", ipAddress = "0.0.0.0") {
  if (!payload || !payload.data || !payload.metadata) {
    return { success: false, message: "\u0633\u0627\u062E\u062A\u0627\u0631 \u0641\u0627\u06CC\u0644 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A." };
  }
  const expectedChecksum = payload.metadata.checksum;
  const actualChecksum = computeDataChecksum(payload.data);
  if (expectedChecksum && actualChecksum !== expectedChecksum) {
    return {
      success: false,
      message: "\u062E\u0637\u0627\u06CC \u0627\u0639\u062A\u0628\u0627\u0631\u0633\u0646\u062C\u06CC \u0686\u06A9\u0633\u0627\u0645 (Integrity Checksum Mismatch): \u0645\u062D\u062A\u0648\u0627\u06CC \u0641\u0627\u06CC\u0644 \u0645\u062E\u062F\u0648\u0634 \u06CC\u0627 \u062F\u0633\u062A\u06A9\u0627\u0631\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A."
    };
  }
  let restoredCollections = 0;
  let restoredRecords = 0;
  try {
    for (const [collName, records] of Object.entries(payload.data)) {
      if (Array.isArray(records)) {
        for (const item of records) {
          if (item && item.id) {
            await serverSaveDoc(collName, item.id, item);
            restoredRecords++;
          }
        }
        restoredCollections++;
      }
    }
    await logServerAudit2({
      userId: "admin",
      username: operatorName,
      action: "DATABASE_FULL_RESTORE_EXECUTED",
      entityType: "database",
      entityId: "snapshot_" + payload.metadata.timestamp,
      description: `\u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC \u06A9\u0627\u0645\u0644 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0627\u0632 \u0641\u0627\u06CC\u0644 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 (${restoredCollections} \u062C\u062F\u0648\u0644\u060C ${restoredRecords} \u0631\u06A9\u0648\u0631\u062F) \u062A\u0648\u0633\u0637 ${operatorName}`,
      ipAddress
    });
    return {
      success: true,
      message: `\u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC \u0634\u062F (${restoredCollections} \u062C\u062F\u0648\u0644\u060C ${restoredRecords} \u0631\u06A9\u0648\u0631\u062F).`,
      restoredCollections,
      restoredRecords
    };
  } catch (err) {
    console.error("Snapshot restore error:", err);
    return { success: false, message: err?.message || "\u062E\u0637\u0627 \u062F\u0631 \u0641\u0631\u0622\u06CC\u0646\u062F \u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC \u067E\u0634\u062A\u06CC\u0628\u0627\u0646." };
  }
}
function applyBackupRetentionPolicy() {
  try {
    if (!import_fs3.default.existsSync(BACKUP_DIR)) return;
    const files = import_fs3.default.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".json"));
    const fileStats = files.map((f) => {
      const fullPath = import_path3.default.join(BACKUP_DIR, f);
      const stat = import_fs3.default.statSync(fullPath);
      return { name: f, path: fullPath, time: stat.mtimeMs };
    }).sort((a, b) => b.time - a.time);
    if (fileStats.length > 25) {
      const filesToDelete = fileStats.slice(25);
      for (const item of filesToDelete) {
        try {
          import_fs3.default.unlinkSync(item.path);
          console.info(`[Backup Retention] Deleted old backup: ${item.name}`);
        } catch (e) {
        }
      }
    }
  } catch (e) {
    console.warn("Error applying backup retention:", e);
  }
}
function listOnDiskBackups() {
  try {
    if (!import_fs3.default.existsSync(BACKUP_DIR)) return [];
    const files = import_fs3.default.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".json"));
    return files.map((fileName) => {
      const fullPath = import_path3.default.join(BACKUP_DIR, fileName);
      const stat = import_fs3.default.statSync(fullPath);
      let isAutomated = false;
      try {
        const content = import_fs3.default.readFileSync(fullPath, "utf8");
        const parsed = JSON.parse(content);
        isAutomated = !!parsed.metadata?.isAutomated;
      } catch (e) {
      }
      return {
        name: fileName,
        sizeBytes: stat.size,
        createdAt: new Date(stat.mtimeMs).toISOString(),
        isAutomated
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (e) {
    return [];
  }
}
function initScheduledBackupService() {
  if (scheduledBackupTimer) clearInterval(scheduledBackupTimer);
  scheduledBackupTimer = setInterval(async () => {
    const currentHour = (/* @__PURE__ */ new Date()).getHours();
    if (currentHour === 2) {
      console.info("[\u23F0 Automated Backup] Executing scheduled 02:00 AM database snapshot...");
      try {
        await createFullDatabaseSnapshot("scheduler_service", true);
        console.info("[\u23F0 Automated Backup] Completed successfully.");
      } catch (err) {
        console.error("[\u23F0 Automated Backup] Failed:", err);
      }
    }
  }, 30 * 60 * 1e3);
}
var import_fs3, import_path3, import_crypto2, BACKUP_DIR, ALL_SYSTEM_COLLECTIONS, scheduledBackupTimer;
var init_serverBackupEngine = __esm({
  "src/lib/serverBackupEngine.ts"() {
    import_fs3 = __toESM(require("fs"), 1);
    import_path3 = __toESM(require("path"), 1);
    import_crypto2 = __toESM(require("crypto"), 1);
    init_serverDataApi();
    init_serverAuth();
    BACKUP_DIR = import_path3.default.join(process.cwd(), "data", "backups");
    if (!import_fs3.default.existsSync(BACKUP_DIR)) {
      try {
        import_fs3.default.mkdirSync(BACKUP_DIR, { recursive: true });
      } catch (e) {
      }
    }
    ALL_SYSTEM_COLLECTIONS = [
      "students",
      "teachers",
      "staff",
      "system_users",
      "programs",
      "classes",
      "attendance",
      "counseling_sessions",
      "counseling_grades",
      "lockers",
      "locker_history",
      "student_requests",
      "unit_request_settings",
      "finance_tuition",
      "finance_compensation",
      "finance_loans",
      "finance_claims",
      "finance_expenses",
      "student_meals",
      "comments",
      "todos",
      "workflow",
      "article_evaluations",
      "audit_logs",
      "anomaly_logs"
    ];
    scheduledBackupTimer = null;
  }
});

// server.ts
var import_express23 = __toESM(require("express"), 1);
var import_path5 = __toESM(require("path"), 1);
var import_fs5 = __toESM(require("fs"), 1);
var import_cookie_parser = __toESM(require("cookie-parser"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_compression = __toESM(require("compression"), 1);
var import_helmet = __toESM(require("helmet"), 1);
var import_dotenv3 = __toESM(require("dotenv"), 1);

// src/routes/authRoutes.ts
var import_express = require("express");
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);

// src/services/AuthService.ts
init_serverAuth();

// src/lib/errorHandler.ts
init_logger();
var import_zod = require("zod");
var AppError = class extends Error {
  constructor(message, options) {
    super(message);
    this.name = "AppError";
    this.statusCode = options?.statusCode || 500;
    this.code = options?.code || "INTERNAL_SERVER_ERROR";
    this.details = options?.details;
    Error.captureStackTrace(this, this.constructor);
  }
};
function globalErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  const isProd = process.env.NODE_ENV === "production";
  const ipAddress = typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",")[0].trim() : req.socket.remoteAddress || "0.0.0.0";
  const user = req.user;
  const userId = user?.id || user?.userId;
  if (err instanceof import_zod.ZodError) {
    const formattedErrors = err.issues.map((e) => ({
      field: e.path.join("."),
      message: e.message
    }));
    logger.warn(`[Validation Error] on ${req.method} ${req.originalUrl}`, {
      errors: formattedErrors,
      userId,
      ip: ipAddress
    });
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "\u062F\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u0627\u0631\u0633\u0627\u0644\u06CC \u0628\u0627 \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F \u0627\u0639\u062A\u0628\u0627\u0631\u0633\u0646\u062C\u06CC \u0647\u0645\u062E\u0648\u0627\u0646\u06CC \u0646\u062F\u0627\u0631\u062F.",
      errors: formattedErrors
    });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      code: "TOKEN_EXPIRED",
      message: "\u0627\u0639\u062A\u0628\u0627\u0631 \u0646\u0634\u0633\u062A \u0634\u0645\u0627 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627\u064B \u0645\u062C\u062F\u062F\u0627\u064B \u0648\u0627\u0631\u062F \u0634\u0648\u06CC\u062F."
    });
  }
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      code: "INVALID_TOKEN",
      message: "\u062A\u0648\u06A9\u0646 \u062F\u0633\u062A\u0631\u0633\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A."
    });
  }
  if (err.code === "ECONNREFUSED" || err.code === "PROTOCOL_CONNECTION_LOST") {
    logger.error(`[Database Connection Lost] ${err.message}`, { stack: err.stack });
    return res.status(503).json({
      success: false,
      code: "DATABASE_UNAVAILABLE",
      message: "\u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647 \u0645\u0648\u0642\u062A\u0627\u064B \u0628\u0627 \u0648\u0642\u0641\u0647 \u0645\u0648\u0627\u062C\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A. \u0633\u0627\u0645\u0627\u0646\u0647 \u0627\u0632 \u06A9\u0634 \u0645\u062D\u0644\u06CC \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F."
    });
  }
  logger.error(`[Unhandled Error] ${req.method} ${req.originalUrl}: ${err.message}`, {
    stack: err.stack,
    statusCode,
    userId,
    ip: ipAddress
  });
  persistErrorLog({
    endpoint: `${req.method} ${req.originalUrl}`,
    method: req.method,
    userId,
    errorMessage: err.message || "\u062E\u0637\u0627\u06CC \u0646\u0627\u0634\u0646\u0627\u062E\u062A\u0647 \u062F\u0631 \u0633\u0631\u0648\u0631",
    stackTrace: err.stack,
    ipAddress
  }).catch(() => {
  });
  return res.status(statusCode).json({
    success: false,
    code: err.code || "SERVER_ERROR",
    message: err.message || "\u062E\u0637\u0627\u06CC\u06CC \u062F\u0631 \u067E\u0631\u062F\u0627\u0632\u0634 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0634\u0645\u0627 \u0631\u062E \u062F\u0627\u062F.",
    ...isProd ? {} : { stack: err.stack }
  });
}

// src/services/AuthService.ts
var AuthService = class {
  /**
   * Authenticate user with password / master password, rate limiting, and bcrypt verification
   */
  static async login(usernameInput, passwordInput, clientIp) {
    const cleanUser = normalizeDigits(usernameInput).trim().toUpperCase();
    const cleanPass = normalizeDigits(passwordInput).trim();
    const userVal = validateUsername(cleanUser);
    if (!userVal.valid) {
      throw new AppError(userVal.message || "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.", { statusCode: 400 });
    }
    const rateCheck = checkRateLimit(clientIp, cleanUser);
    if (!rateCheck.allowed) {
      throw new AppError(
        `\u062A\u0639\u062F\u0627\u062F \u062F\u0641\u0639\u0627\u062A \u062A\u0644\u0627\u0634 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u06CC\u0634 \u0627\u0632 \u062D\u062F \u0645\u062C\u0627\u0632 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627\u064B ${rateCheck.waitMinutes} \u062F\u0642\u06CC\u0642\u0647 \u062F\u06CC\u06AF\u0631 \u0645\u062C\u062F\u062F\u0627\u064B \u062A\u0644\u0627\u0634 \u06A9\u0646\u06CC\u062F.`,
        { statusCode: 429 }
      );
    } else {
      resetFailedAttempts(clientIp, cleanUser);
    }
    const users = await fetchAllUsersFromStorage();
    let user = users.find((u) => u.username?.toUpperCase() === cleanUser);
    if (!user) {
      const { DEFAULT_SERVER_USERS: DEFAULT_SERVER_USERS2 } = await Promise.resolve().then(() => (init_serverAuth(), serverAuth_exports));
      const defaultMatch = DEFAULT_SERVER_USERS2.find((u) => u.username.toUpperCase() === cleanUser);
      if (defaultMatch) {
        user = { ...defaultMatch };
        await saveUserToStorage(user);
      }
    }
    if (!user) {
      await dummyPasswordCheck(cleanPass);
      recordFailedAttempt(clientIp, cleanUser);
      trackSecurityIncident(clientIp, void 0, "LOGIN_FAILED");
      await logServerAudit2({
        username: cleanUser,
        action: "LOGIN_FAILED",
        entityType: "auth",
        entityId: cleanUser,
        description: "\u062A\u0644\u0627\u0634 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0631\u0627\u06CC \u0648\u0631\u0648\u062F: \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u06CC\u0627 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.",
        ipAddress: clientIp
      });
      throw new AppError("\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u06CC\u0627 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0627\u0634\u062A\u0628\u0627\u0647 \u0627\u0633\u062A.", { statusCode: 401 });
    }
    if (cleanUser !== "SADEGH" && user.accountLockedUntil && new Date(user.accountLockedUntil) > /* @__PURE__ */ new Date()) {
      throw new AppError("\u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0645\u0648\u0642\u062A\u0627\u064B \u0645\u0633\u062F\u0648\u062F \u0634\u062F\u0647 \u0627\u0633\u062A. \u0628\u0627 \u0645\u062F\u06CC\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const storedHashOrPlain = user.passwordHash || user.password || "";
    const isMatch = await comparePassword(cleanPass, storedHashOrPlain);
    if (!isMatch) {
      recordFailedAttempt(clientIp, cleanUser);
      trackSecurityIncident(clientIp, user.id, "LOGIN_FAILED");
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
      }
      await saveUserToStorage(user);
      await logServerAudit2({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: "LOGIN_FAILED",
        entityType: "auth",
        entityId: user.id,
        description: `\u062A\u0644\u0627\u0634 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0631\u0627\u06CC \u0648\u0631\u0648\u062F: \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0646\u0627\u062F\u0631\u0633\u062A \u0628\u0631\u0627\u06CC ${user.username}`,
        ipAddress: clientIp
      });
      throw new AppError("\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u06CC\u0627 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0627\u0634\u062A\u0628\u0627\u0647 \u0627\u0633\u062A.", { statusCode: 401 });
    }
    if (!user.passwordHash || !user.passwordHash.startsWith("$2a$") && !user.passwordHash.startsWith("$2b$")) {
      user.passwordHash = await hashPassword(cleanPass);
      delete user.password;
    }
    resetFailedAttempts(clientIp, cleanUser);
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = void 0;
    user.lastLogin = (/* @__PURE__ */ new Date()).toISOString();
    await saveUserToStorage(user);
    updateLastActivity(user.id);
    const safeUser = sanitizeUser(user);
    const { token, refreshToken } = generateTokens(safeUser);
    await logServerAudit2({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: "LOGIN_SUCCESS",
      entityType: "auth",
      entityId: user.id,
      description: `\u0648\u0631\u0648\u062F \u0645\u0648\u0641\u0642 \u0628\u0647 \u0633\u0627\u0645\u0627\u0646\u0647 \u0628\u0627 \u0646\u0642\u0634 ${user.roleTitle || user.role}`,
      ipAddress: clientIp
    });
    return { user: safeUser, token, refreshToken };
  }
  /**
   * Verify and refresh tokens
   */
  static async refreshToken(tokenFromHeaderOrCookie, clientIp) {
    const verified = verifyRefreshToken(tokenFromHeaderOrCookie);
    if (!verified.valid || !verified.decoded) {
      throw new AppError(verified.error || "\u0646\u0634\u0633\u062A \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A.", { statusCode: 401 });
    }
    const userId = verified.decoded.userId || verified.decoded.id;
    const users = await fetchAllUsersFromStorage();
    const user = users.find((u) => u.id === userId && u.isActive !== false);
    if (!user) {
      throw new AppError("\u06A9\u0627\u0631\u0628\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F \u06CC\u0627 \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A.", { statusCode: 401 });
    }
    const safeUser = sanitizeUser(user);
    const { token, refreshToken: newRefreshToken } = generateTokens(safeUser);
    return { user: safeUser, token, refreshToken: newRefreshToken };
  }
  /**
   * Verify user security PIN
   */
  static async verifyPin(user, enteredPin) {
    if (!user.securityPinEnabled || !user.specialSecurityPinHash) {
      return { verified: true, message: "\u067E\u06CC\u0646 \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A." };
    }
    const cleanPin = String(enteredPin).trim();
    const isMatch = await comparePassword(cleanPin, user.specialSecurityPinHash);
    if (!isMatch) {
      throw new AppError("\u06A9\u062F \u067E\u06CC\u0646 \u0627\u0645\u0646\u06CC\u062A\u06CC \u0646\u0627\u062F\u0631\u0633\u062A \u0627\u0633\u062A.", { statusCode: 400 });
    }
    return { verified: true };
  }
};

// src/lib/validationSchemas.ts
var import_zod2 = require("zod");
function isValidIranianNationalCode(code) {
  if (!code) return false;
  const cleanCode = String(code).trim();
  if (!/^\d{10}$/.test(cleanCode)) return false;
  if (/^(\d)\1{9}$/.test(cleanCode)) return false;
  const digits = cleanCode.split("").map(Number);
  const checkDigit = digits[9];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  const remainder = sum % 11;
  return remainder < 2 && checkDigit === remainder || remainder >= 2 && checkDigit === 11 - remainder;
}
function isValidIranianMobile(phone) {
  if (!phone) return false;
  const cleanPhone = String(phone).trim();
  return /^09\d{9}$/.test(cleanPhone);
}
var LoginInputSchema = import_zod2.z.object({
  username: import_zod2.z.string().trim().min(2, "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F2 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F").max(50, "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u062D\u062F\u0627\u06A9\u062B\u0631 \u06F5\u06F0 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0627\u0633\u062A").regex(/^[a-zA-Z0-9_\u0600-\u06FF\s-]+$/, "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0634\u0627\u0645\u0644 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631\u0647\u0627\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A"),
  password: import_zod2.z.string().min(4, "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F4 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F").max(100, "\u0637\u0648\u0644 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A")
});
var SystemRoleEnum = import_zod2.z.enum([
  "super_admin",
  "school_manager",
  "education_manager",
  "education_officer",
  "grade_mentor",
  "finance_manager",
  "financial_officer",
  "teacher",
  "student",
  "class_representative",
  "custom"
]);
var UserManagementSchema = import_zod2.z.object({
  username: import_zod2.z.string().trim().min(2, "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F2 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F").max(50, "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u062D\u062F\u0627\u06A9\u062B\u0631 \u06F5\u06F0 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0627\u0633\u062A"),
  name: import_zod2.z.string().trim().min(2, "\u0646\u0627\u0645 \u0648 \u0646\u0627\u0645 \u062E\u0627\u0646\u0648\u0627\u062F\u06AF\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A").max(100).optional(),
  password: import_zod2.z.string().min(4, "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F4 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F").max(100).optional(),
  role: SystemRoleEnum.default("custom"),
  level: import_zod2.z.number().int().min(1).max(3).default(2),
  roleTitle: import_zod2.z.string().max(100).optional(),
  nationalCode: import_zod2.z.string().optional().refine((val) => !val || isValidIranianNationalCode(val), {
    message: "\u06A9\u062F \u0645\u0644\u06CC \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0628\u0627 \u0627\u0644\u06AF\u0648\u0631\u06CC\u062A\u0645 \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F \u06F1\u06F0 \u0631\u0642\u0645\u06CC \u0645\u0637\u0627\u0628\u0642\u062A \u0646\u062F\u0627\u0631\u062F"
  }),
  phone: import_zod2.z.string().optional().refine((val) => !val || isValidIranianMobile(val), {
    message: "\u0634\u0645\u0627\u0631\u0647 \u062A\u0644\u0641\u0646 \u0647\u0645\u0631\u0627\u0647 \u0628\u0627\u06CC\u062F \u0628\u0627 \u06F0\u06F9 \u0634\u0631\u0648\u0639 \u0634\u062F\u0647 \u0648 \u06F1\u06F1 \u0631\u0642\u0645 \u0628\u0627\u0634\u062F"
  }),
  allowedTabs: import_zod2.z.array(import_zod2.z.string()).optional(),
  editableTabs: import_zod2.z.array(import_zod2.z.string()).optional(),
  modulePermissions: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.any()).optional(),
  isActive: import_zod2.z.boolean().default(true)
});
var StudentInputSchema = import_zod2.z.object({
  name: import_zod2.z.string().trim().min(2, "\u0646\u0627\u0645 \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F2 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F"),
  nationalId: import_zod2.z.string().optional().refine((val) => !val || isValidIranianNationalCode(val), {
    message: "\u06A9\u062F \u0645\u0644\u06CC \u0637\u0644\u0628\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A"
  }),
  studentCode: import_zod2.z.string().trim().max(30).optional(),
  grade: import_zod2.z.string().trim().optional(),
  phoneNumber: import_zod2.z.string().optional().refine((val) => !val || isValidIranianMobile(val), {
    message: "\u0634\u0645\u0627\u0631\u0647 \u0645\u0648\u0628\u0627\u06CC\u0644 \u0637\u0644\u0628\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A"
  }),
  isActive: import_zod2.z.boolean().default(true),
  birthDate: import_zod2.z.string().optional(),
  birthPlace: import_zod2.z.string().optional(),
  fatherName: import_zod2.z.string().optional(),
  maritalStatus: import_zod2.z.enum(["\u0645\u062C\u0631\u062F", "\u0645\u062A\u0627\u0647\u0644"]).optional(),
  tammomStatus: import_zod2.z.enum(["\u0645\u0639\u0645\u0645", "\u063A\u06CC\u0631 \u0645\u0639\u0645\u0645"]).optional()
});
var DocumentMutationSchema = import_zod2.z.object({
  collection: import_zod2.z.string().regex(/^[a-zA-Z0-9_-]+$/, "\u0646\u0627\u0645 \u0645\u062C\u0645\u0648\u0639\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A"),
  id: import_zod2.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u062E\u0627\u0644\u06CC \u0628\u0627\u0634\u062F"),
  record: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.any())
});

// src/controllers/AuthController.ts
init_serverDataApi();
init_auditLogger();
init_databaseAbstraction();
init_serverAuth();
var AuthController = class _AuthController {
  static getClientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    return req.socket.remoteAddress || "127.0.0.1";
  }
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async login(req, res, next) {
    const ip = _AuthController.getClientIp(req);
    try {
      const parsedLogin = LoginInputSchema.safeParse(req.body);
      if (!parsedLogin.success) {
        const errorMsg = parsedLogin.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
        await logAudit({
          action: "login_failed",
          userName: req.body?.username || "unknown",
          ipAddress: ip,
          status: "failed",
          errorMessage: errorMsg
        });
        return res.status(400).json({ success: false, message: errorMsg });
      }
      const result = await AuthService.login(parsedLogin.data.username, parsedLogin.data.password, ip);
      if (result.user && result.user.mustChangePassword) {
        return res.status(200).json({
          success: true,
          mustChangePassword: true,
          message: "\u062C\u0647\u062A \u062D\u0641\u0638 \u0627\u0645\u0646\u06CC\u062A \u0633\u0627\u0645\u0627\u0646\u0647\u060C \u062A\u063A\u06CC\u06CC\u0631 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u062F\u0631 \u0627\u0648\u0644\u06CC\u0646 \u0648\u0631\u0648\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.",
          user: { id: result.user.id, username: result.user.username }
        });
      }
      const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
      res.cookie("auth_access_token", result.token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: "strict",
        maxAge: 15 * 60 * 1e3,
        path: "/"
      });
      res.cookie("auth_refresh_token", result.refreshToken, {
        httpOnly: true,
        secure: isHttps,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1e3,
        path: "/"
      });
      await logAudit({
        action: "login",
        userId: result.user.id,
        userName: result.user.username,
        userRole: result.user.role,
        ipAddress: ip,
        status: "success",
        details: { userLevel: result.user.level, name: result.user.name }
      });
      await recordLoginAuditInDb({
        username: result.user.username,
        success: true,
        ipAddress: ip,
        userAgent: req.headers["user-agent"]
      });
      return res.status(200).json({
        success: true,
        message: "\u0648\u0631\u0648\u062F \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0646\u062C\u0627\u0645 \u0634\u062F.",
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken
      });
    } catch (error) {
      const statusCode = error?.statusCode || (error?.status ? Number(error.status) : 401);
      const message = error?.message || "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u06CC\u0627 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0627\u0634\u062A\u0628\u0627\u0647 \u0627\u0633\u062A.";
      await logAudit({
        action: "login_failed",
        userName: req.body?.username || "unknown",
        ipAddress: ip,
        status: "failed",
        errorMessage: message
      }).catch(() => {
      });
      await recordLoginAuditInDb({
        username: req.body?.username || "unknown",
        success: false,
        ipAddress: ip,
        userAgent: req.headers["user-agent"]
      }).catch(() => {
      });
      return res.status(statusCode).json({
        success: false,
        message
      });
    }
  }
  static async me(req, res, next) {
    try {
      let token = req.cookies?.auth_access_token;
      if (!token && req.headers.authorization?.startsWith("Bearer ")) {
        token = req.headers.authorization.substring(7);
      }
      if (!token) {
        return res.status(401).json({ authenticated: false, message: "\u062A\u0648\u06A9\u0646 \u062F\u0633\u062A\u0631\u0633\u06CC \u0645\u0648\u062C\u0648\u062F \u0646\u06CC\u0633\u062A." });
      }
      const verified = verifyAccessToken2(token);
      if (!verified.valid || !verified.decoded) {
        return res.status(401).json({ authenticated: false, message: "\u062A\u0648\u06A9\u0646 \u0645\u0646\u0642\u0636\u06CC \u06CC\u0627 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A." });
      }
      const userId = verified.decoded.userId || verified.decoded.id;
      const users = await fetchAllUsersFromStorage();
      const user = users.find((u) => u.id === userId || u.username.toUpperCase() === (verified.decoded?.username || "").toUpperCase());
      if (!user || user.isActive === false) {
        return res.status(401).json({ authenticated: false, message: "\u06A9\u0627\u0631\u0628\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F \u06CC\u0627 \u0645\u0633\u062F\u0648\u062F \u0627\u0633\u062A." });
      }
      return res.status(200).json({
        authenticated: true,
        user: sanitizeUser(user)
      });
    } catch (error) {
      next(error);
    }
  }
  static async publicUsers(req, res, next) {
    try {
      const isQuickLoginEnabled = process.env.ENABLE_QUICK_LOGIN === "true";
      if (!isQuickLoginEnabled) {
        return res.status(200).json({
          success: false,
          enabled: false,
          message: "\u0648\u0631\u0648\u062F \u0633\u0631\u06CC\u0639 \u062F\u0631 \u0627\u06CC\u0646 \u0645\u062D\u06CC\u0637 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A.",
          users: []
        });
      }
      const users = await fetchAllUsersFromStorage();
      const sanitized = users.map((u) => sanitizeUser(u));
      return res.status(200).json({
        success: true,
        enabled: true,
        count: sanitized.length,
        users: sanitized
      });
    } catch (error) {
      next(error);
    }
  }
  static async addUser(req, res, next) {
    try {
      const { user } = req.body;
      if (!user || !user.username) {
        return res.status(400).json({ success: false, message: "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u06A9\u0627\u0631\u0628\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A." });
      }
      const cleanUsername = String(user.username).trim().toUpperCase();
      const plainPassword = user.password;
      if (!plainPassword) {
        return res.status(400).json({ success: false, message: "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
      }
      const passwordHash = await hashPassword(plainPassword);
      const userToStore = {
        ...user,
        id: user.id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        username: cleanUsername,
        name: user.name || user.fullName || cleanUsername,
        fullName: user.fullName || user.name || cleanUsername,
        role: user.role || "custom",
        level: user.level || (user.role === "teacher" ? 3 : 2),
        roleTitle: user.roleTitle || (user.role === "teacher" ? "\u0627\u0633\u062A\u0627\u062F \u0645\u062F\u0631\u0633\u0647" : "\u06A9\u0627\u0631\u0628\u0631 \u0633\u06CC\u0633\u062A\u0645"),
        scope: user.scope || (user.level === 3 ? "self" : "all"),
        gradeLabel: user.gradeLabel || "",
        avatarBg: user.avatarBg || (user.level === 1 ? "bg-indigo-700" : "bg-emerald-600"),
        allowedTabs: Array.isArray(user.allowedTabs) ? user.allowedTabs : ["todos", "students"],
        editableTabs: Array.isArray(user.editableTabs) ? user.editableTabs : [],
        modulePermissions: user.modulePermissions || {},
        isActive: user.isActive !== false,
        passwordHash,
        password: plainPassword
      };
      await saveUserToStorage(userToStore);
      notifyRealtimeChange("system_users", userToStore.id, "upsert");
      const caller = _AuthController.extractCaller(req);
      logServerAudit2({
        userId: caller?.userId || "system",
        username: caller?.username || "system",
        action: "USER_CREATED",
        entityType: "system_users",
        entityId: userToStore.id,
        description: `\u0627\u06CC\u062C\u0627\u062F \u06A9\u0627\u0631\u0628\u0631 \u062C\u062F\u06CC\u062F ${cleanUsername} (${userToStore.name}) \u0628\u0627 \u0646\u0642\u0634 ${userToStore.roleTitle || userToStore.role}`,
        ipAddress: _AuthController.getClientIp(req)
      }).catch(() => {
      });
      return res.status(200).json({
        success: true,
        message: "\u06A9\u0627\u0631\u0628\u0631 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062F\u0631 \u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.",
        user: sanitizeUser(userToStore)
      });
    } catch (error) {
      next(error);
    }
  }
  static async updateUser(req, res, next) {
    try {
      const { targetUserId, updates } = req.body;
      const target = targetUserId || updates?.id || updates?.username;
      if (!target) {
        return res.status(400).json({ success: false, message: "\u0634\u0646\u0627\u0633\u0647 \u06A9\u0627\u0631\u0628\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
      }
      const users = await fetchAllUsersFromStorage();
      const existing = users.find((u) => u.id === target || u.username.toUpperCase() === String(target).toUpperCase());
      if (!existing) {
        return res.status(404).json({ success: false, message: "\u06A9\u0627\u0631\u0628\u0631 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
      }
      let passwordHash = existing.passwordHash;
      let plainPassword = existing.password;
      if (updates.password && updates.password.trim() !== "") {
        plainPassword = updates.password.trim();
        passwordHash = await hashPassword(plainPassword);
      }
      const updatedUser = {
        ...existing,
        ...updates,
        username: existing.username.toUpperCase(),
        passwordHash,
        password: plainPassword
      };
      await saveUserToStorage(updatedUser);
      notifyRealtimeChange("system_users", updatedUser.id, "upsert");
      const caller = _AuthController.extractCaller(req);
      logServerAudit2({
        userId: caller?.userId || "system",
        username: caller?.username || "system",
        action: "USER_UPDATED",
        entityType: "system_users",
        entityId: updatedUser.id,
        description: `\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u06A9\u0627\u0631\u0628\u0631 ${updatedUser.username}`,
        ipAddress: _AuthController.getClientIp(req)
      }).catch(() => {
      });
      return res.status(200).json({
        success: true,
        message: "\u06A9\u0627\u0631\u0628\u0631 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F.",
        user: sanitizeUser(updatedUser)
      });
    } catch (error) {
      next(error);
    }
  }
  static async deleteUser(req, res, next) {
    try {
      const { userId, username } = req.body;
      const target = userId || username || req.params.id;
      if (!target) {
        return res.status(400).json({ success: false, message: "\u0634\u0646\u0627\u0633\u0647 \u06A9\u0627\u0631\u0628\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
      }
      await deleteUserFromStorage(target);
      notifyRealtimeChange("system_users", String(target), "delete");
      const caller = _AuthController.extractCaller(req);
      logServerAudit2({
        userId: caller?.userId || "system",
        username: caller?.username || "system",
        action: "USER_DELETED",
        entityType: "system_users",
        entityId: target,
        description: `\u062D\u0630\u0641 \u06A9\u0627\u0631\u0628\u0631 ${target} \u0627\u0632 \u0633\u06CC\u0633\u062A\u0645`,
        ipAddress: _AuthController.getClientIp(req)
      }).catch(() => {
      });
      return res.status(200).json({
        success: true,
        message: "\u06A9\u0627\u0631\u0628\u0631 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0632 \u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647 \u062D\u0630\u0641 \u06AF\u0631\u062F\u06CC\u062F."
      });
    } catch (error) {
      next(error);
    }
  }
  static async adminResetPassword(req, res, next) {
    try {
      const { targetUserId, newPassword } = req.body;
      if (!targetUserId || !newPassword) {
        return res.status(400).json({ success: false, message: "\u0634\u0646\u0627\u0633\u0647 \u06A9\u0627\u0631\u0628\u0631 \u0648 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u062C\u062F\u06CC\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
      }
      const users = await fetchAllUsersFromStorage();
      const existing = users.find((u) => u.id === targetUserId || u.username.toUpperCase() === String(targetUserId).toUpperCase());
      if (!existing) {
        return res.status(404).json({ success: false, message: "\u06A9\u0627\u0631\u0628\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
      }
      const passwordHash = await hashPassword(newPassword.trim());
      existing.passwordHash = passwordHash;
      existing.password = newPassword.trim();
      existing.mustChangePassword = false;
      existing.failedLoginAttempts = 0;
      existing.accountLockedUntil = void 0;
      await saveUserToStorage(existing);
      notifyRealtimeChange("system_users", existing.id, "upsert");
      return res.status(200).json({
        success: true,
        message: `\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u06A9\u0627\u0631\u0628\u0631 ${existing.username} \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0627\u0632\u0646\u0634\u0627\u0646\u06CC \u0634\u062F.`
      });
    } catch (error) {
      next(error);
    }
  }
  static async changePassword(req, res, next) {
    try {
      const caller = _AuthController.extractCaller(req);
      if (!caller) {
        return res.status(401).json({ success: false, message: "\u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
      }
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0641\u0639\u0644\u06CC \u0648 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u062C\u062F\u06CC\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
      }
      const users = await fetchAllUsersFromStorage();
      const existing = users.find((u) => u.id === caller.userId || u.username.toUpperCase() === caller.username.toUpperCase());
      if (!existing) {
        return res.status(404).json({ success: false, message: "\u06A9\u0627\u0631\u0628\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
      }
      const isCurrentMatch = await comparePassword(currentPassword, existing.passwordHash || existing.password || "");
      if (!isCurrentMatch) {
        return res.status(400).json({ success: false, message: "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0641\u0639\u0644\u06CC \u0646\u0627\u062F\u0631\u0633\u062A \u0627\u0633\u062A." });
      }
      existing.passwordHash = await hashPassword(newPassword.trim());
      existing.password = newPassword.trim();
      existing.mustChangePassword = false;
      await saveUserToStorage(existing);
      return res.status(200).json({
        success: true,
        message: "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F."
      });
    } catch (error) {
      next(error);
    }
  }
  static async logout(req, res, next) {
    try {
      const caller = _AuthController.extractCaller(req);
      const ip = _AuthController.getClientIp(req);
      const accessToken = req.cookies?.auth_access_token;
      if (accessToken) revokeToken(accessToken);
      res.clearCookie("auth_access_token", { path: "/" });
      res.clearCookie("auth_refresh_token", { path: "/" });
      if (caller) {
        await logAudit({
          action: "logout",
          userId: String(caller.userId || caller.id || ""),
          userName: String(caller.username || caller.name || ""),
          userRole: caller.role,
          ipAddress: ip,
          status: "success"
        });
      }
      return res.status(200).json({ success: true, message: "\u062E\u0631\u0648\u062C \u0627\u0632 \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0627\u0646\u062C\u0627\u0645 \u0634\u062F." });
    } catch (error) {
      next(error);
    }
  }
  static async logoutAll(req, res, next) {
    try {
      const caller = _AuthController.extractCaller(req);
      if (caller?.userId) {
        revokeAllUserSessions(caller.userId);
      }
      res.clearCookie("auth_access_token", { path: "/" });
      res.clearCookie("auth_refresh_token", { path: "/" });
      return res.status(200).json({ success: true, message: "\u062A\u0645\u0627\u0645 \u0646\u0634\u0633\u062A\u200C\u0647\u0627\u06CC \u0627\u06CC\u0646 \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0628\u0627\u0637\u0644 \u0634\u062F\u0646\u062F." });
    } catch (error) {
      next(error);
    }
  }
  static async refresh(req, res, next) {
    try {
      const token = req.body?.refreshToken || req.cookies?.auth_refresh_token;
      if (!token) {
        return res.status(401).json({ success: false, message: "\u0631\u0641\u0631\u0634 \u062A\u0648\u06A9\u0646 \u0645\u0648\u062C\u0648\u062F \u0646\u06CC\u0633\u062A." });
      }
      const ip = _AuthController.getClientIp(req);
      const result = await AuthService.refreshToken(token, ip);
      const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
      res.cookie("auth_access_token", result.token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? "none" : "lax",
        maxAge: 15 * 60 * 1e3,
        path: "/"
      });
      return res.status(200).json({
        success: true,
        token: result.token,
        refreshToken: result.refreshToken,
        user: result.user
      });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/authRoutes.ts
var router = (0, import_express.Router)();
var loginLimiter = (0, import_express_rate_limit.default)({
  windowMs: 3 * 60 * 1e3,
  // 3 minutes
  max: 5,
  // 5 failed attempts per IP/username combination
  skipSuccessfulRequests: true,
  // Reset counter on successful login
  keyGenerator: (req) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const username = req.body?.username ? String(req.body.username).trim().toUpperCase() : "";
    return `${ip}_${username}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "\u062A\u0639\u062F\u0627\u062F \u062F\u0641\u0639\u0627\u062A \u062A\u0644\u0627\u0634 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0631\u0627\u06CC \u0648\u0631\u0648\u062F \u0628\u06CC\u0634 \u0627\u0632 \u062D\u062F \u0645\u062C\u0627\u0632 \u0627\u0633\u062A (\u062D\u062F\u0627\u06A9\u062B\u0631 \u06F5 \u0628\u0627\u0631 \u062F\u0631 \u06F3 \u062F\u0642\u06CC\u0642\u0647). \u0644\u0637\u0641\u0627\u064B \u06F3 \u062F\u0642\u06CC\u0642\u0647 \u062F\u06CC\u06AF\u0631 \u0645\u062C\u062F\u062F\u0627\u064B \u062A\u0644\u0627\u0634 \u0641\u0631\u0645\u0627\u06CC\u06CC\u062F."
  }
});
router.post("/login", loginLimiter, AuthController.login);
router.get("/me", AuthController.me);
router.get("/public-users", AuthController.publicUsers);
router.get("/users", AuthController.publicUsers);
router.post("/add-user", AuthController.addUser);
router.post("/update-user", AuthController.updateUser);
router.post("/delete-user", AuthController.deleteUser);
router.post("/admin-reset-password", AuthController.adminResetPassword);
router.post("/change-password", AuthController.changePassword);
router.post("/logout", AuthController.logout);
router.post("/logout-all", AuthController.logoutAll);
router.post("/refresh", AuthController.refresh);
var authRoutes_default = router;

// src/routes/studentRoutes.ts
var import_express2 = require("express");

// src/services/StudentService.ts
init_serverDataApi();
init_serverAuth();
init_logger();
var StudentService = class {
  /**
   * Fetch all students with role-based scoping (Level 1: all, Level 2: grade-scoped, Level 3: self only)
   */
  static async getAllStudents(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "students", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0645\u0634\u0627\u0647\u062F\u0647 \u067E\u0631\u0648\u0646\u062F\u0647 \u0637\u0644\u0627\u0628 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("students", callerUser);
    return Array.isArray(items) ? items : [];
  }
  /**
   * Fetch single student by ID
   */
  static async getStudentById(id, callerUser) {
    const students = await this.getAllStudents(callerUser);
    const student = students.find((s) => s.id === id || s.studentCode === id);
    if (!student) {
      throw new AppError("\u067E\u0631\u0648\u0646\u062F\u0647 \u0637\u0644\u0628\u0647 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.", { statusCode: 404 });
    }
    return student;
  }
  /**
   * Create or update student record
   */
  static async saveStudent(studentData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "students", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u067E\u0631\u0648\u0646\u062F\u0647 \u0637\u0644\u0627\u0628 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    if (!studentData.name || !studentData.grade) {
      throw new AppError("\u0646\u0627\u0645 \u0648 \u067E\u0627\u06CC\u0647 \u062A\u062D\u0635\u06CC\u0644\u06CC \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.", { statusCode: 400 });
    }
    const id = studentData.id || `stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullRecord = {
      ...studentData,
      id,
      name: String(studentData.name).trim(),
      grade: String(studentData.grade).trim(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await serverSaveDoc("students", fullRecord, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: studentData.id ? "UPDATE_STUDENT" : "CREATE_STUDENT",
      entityType: "student",
      entityId: id,
      description: `\u062B\u0628\u062A \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0637\u0644\u0628\u0647: ${fullRecord.name} (${fullRecord.grade})`,
      newState: fullRecord
    });
    logger.info(`[StudentService] Saved student ${id} (${fullRecord.name}) by ${callerUser?.username || "system"}`);
    return fullRecord;
  }
  /**
   * Delete or archive a student
   */
  static async deleteStudent(id, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "students", "delete");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u062A\u0646\u0647\u0627 \u0645\u062F\u06CC\u0631\u0627\u0646 \u0627\u0631\u0634\u062F \u0645\u062C\u0627\u0632 \u0628\u0647 \u062D\u0630\u0641 \u067E\u0631\u0648\u0646\u062F\u0647 \u0637\u0644\u0627\u0628 \u0647\u0633\u062A\u0646\u062F.", { statusCode: 403 });
    }
    await serverDeleteDoc("students", id, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "DELETE_STUDENT",
      entityType: "student",
      entityId: id,
      description: `\u062D\u0630\u0641 \u067E\u0631\u0648\u0646\u062F\u0647 \u0637\u0644\u0628\u0647 \u0628\u0627 \u0634\u0646\u0627\u0633\u0647 ${id}`
    });
    logger.warn(`[StudentService] Deleted student ${id} by ${callerUser?.username || "system"}`);
    return true;
  }
};

// src/controllers/StudentController.ts
init_serverAuth();
var StudentController = class _StudentController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAll(req, res, next) {
    try {
      const caller = _StudentController.extractCaller(req);
      const items = await StudentService.getAllStudents(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _StudentController.extractCaller(req);
      const student = await StudentService.getStudentById(id, caller);
      return res.status(200).json({ success: true, student });
    } catch (error) {
      next(error);
    }
  }
  static async save(req, res, next) {
    try {
      const caller = _StudentController.extractCaller(req);
      const student = await StudentService.saveStudent(req.body, caller);
      return res.status(200).json({ success: true, message: "\u067E\u0631\u0648\u0646\u062F\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", student });
    } catch (error) {
      next(error);
    }
  }
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _StudentController.extractCaller(req);
      await StudentService.deleteStudent(id, caller);
      return res.status(200).json({ success: true, message: "\u067E\u0631\u0648\u0646\u062F\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u06AF\u0631\u062F\u06CC\u062F." });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/studentRoutes.ts
var router2 = (0, import_express2.Router)();
router2.get("/", StudentController.getAll);
router2.get("/:id", StudentController.getById);
router2.post("/", StudentController.save);
router2.put("/:id", StudentController.save);
router2.delete("/:id", StudentController.delete);
var studentRoutes_default = router2;

// src/routes/teacherRoutes.ts
var import_express3 = require("express");

// src/services/TeacherService.ts
var import_zod3 = require("zod");
init_serverDataApi();
init_serverAuth();
init_logger();
var TeacherInputSchema = import_zod3.z.object({
  id: import_zod3.z.string().optional(),
  fullName: import_zod3.z.string().min(2, "\u0646\u0627\u0645 \u0648 \u0646\u0627\u0645 \u062E\u0627\u0646\u0648\u0627\u062F\u06AF\u06CC \u0627\u0633\u062A\u0627\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  name: import_zod3.z.string().optional(),
  nationalId: import_zod3.z.string().optional(),
  teacherCode: import_zod3.z.string().optional(),
  phoneNumber: import_zod3.z.string().optional(),
  phone: import_zod3.z.string().optional(),
  subjectSpecialty: import_zod3.z.string().optional(),
  courses: import_zod3.z.array(import_zod3.z.string()).optional(),
  managedGrades: import_zod3.z.array(import_zod3.z.string()).optional(),
  categories: import_zod3.z.array(import_zod3.z.string()).optional(),
  priority: import_zod3.z.union([import_zod3.z.number(), import_zod3.z.string()]).optional(),
  isActive: import_zod3.z.boolean().optional(),
  bankName: import_zod3.z.string().optional(),
  bankAccount: import_zod3.z.string().optional(),
  bankSheba: import_zod3.z.string().optional(),
  notes: import_zod3.z.string().optional(),
  experienceHistory: import_zod3.z.string().optional(),
  isExternal: import_zod3.z.boolean().optional()
});
var TeacherService = class {
  /**
   * Fetch all teachers with role-based scoping:
   * Level 1 & 2 managers see all teachers; Teachers (level 3) see only their own record.
   */
  static async getAllTeachers(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "teachers", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0628\u0627\u0646\u06A9 \u0627\u0633\u0627\u062A\u06CC\u062F \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("teachers", callerUser);
    const teachersList = Array.isArray(items) ? items : [];
    if (callerUser && (callerUser.role === "teacher" || callerUser.level === 3 && callerUser.teacherId)) {
      const targetTeacherId = callerUser.teacherId || callerUser.linkedTeacherId || callerUser.id;
      const filtered = teachersList.filter(
        (t) => t.id === targetTeacherId || t.fullName?.trim() === callerUser.name?.trim() || t.name?.trim() === callerUser.name?.trim()
      );
      return filtered;
    }
    return teachersList;
  }
  /**
   * Fetch single teacher by ID with scoping check
   */
  static async getTeacherById(id, callerUser) {
    const teachers = await this.getAllTeachers(callerUser);
    const teacher = teachers.find((t) => t.id === id || t.teacherCode === id);
    if (!teacher) {
      throw new AppError("\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0627\u0633\u062A\u0627\u062F \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F \u06CC\u0627 \u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0645\u0634\u0627\u0647\u062F\u0647 \u0622\u0646 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 404 });
    }
    return teacher;
  }
  /**
   * Create or update a teacher with strict Zod validation
   */
  static async saveTeacher(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "teachers", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0627\u0633\u0627\u062A\u06CC\u062F \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const validationResult = TeacherInputSchema.safeParse(rawData);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(firstError, { statusCode: 400 });
    }
    const validData = validationResult.data;
    const id = validData.id || `tea_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const teacherRecord = {
      id,
      fullName: validData.fullName.trim(),
      name: validData.name?.trim() || validData.fullName.trim(),
      nationalId: validData.nationalId?.trim() || "",
      teacherCode: validData.teacherCode?.trim() || "",
      phoneNumber: validData.phoneNumber || validData.phone || "",
      phone: validData.phoneNumber || validData.phone || "",
      subjectSpecialty: validData.subjectSpecialty || "",
      courses: validData.courses || [],
      managedGrades: validData.managedGrades || [],
      categories: validData.categories || ["\u0641\u0642\u0647"],
      priority: validData.priority || 1,
      isActive: validData.isActive !== false,
      bankName: validData.bankName || "",
      bankAccount: validData.bankAccount || "",
      bankSheba: validData.bankSheba || "",
      notes: validData.notes || "",
      experienceHistory: validData.experienceHistory || "",
      isExternal: Boolean(validData.isExternal),
      createdAt: rawData?.createdAt || nowIso,
      updatedAt: nowIso
    };
    await serverSaveDoc("teachers", teacherRecord, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: validData.id ? "UPDATE_TEACHER" : "CREATE_TEACHER",
      entityType: "teacher",
      entityId: id,
      description: `\u062B\u0628\u062A \u06CC\u0627 \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u067E\u0631\u0648\u0646\u062F\u0647 \u0627\u0633\u062A\u0627\u062F: ${teacherRecord.fullName}`,
      newState: teacherRecord
    });
    logger.info(`[TeacherService] Saved teacher ${id} (${teacherRecord.fullName}) by ${callerUser?.username || "system"}`);
    return teacherRecord;
  }
  /**
   * Delete or archive a teacher
   */
  static async deleteTeacher(id, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "teachers", "delete");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u062A\u0646\u0647\u0627 \u0645\u062F\u06CC\u0631\u0627\u0646 \u0627\u0631\u0634\u062F \u0645\u062C\u0627\u0632 \u0628\u0647 \u062D\u0630\u0641 \u067E\u0631\u0648\u0646\u062F\u0647 \u0627\u0633\u0627\u062A\u06CC\u062F \u0647\u0633\u062A\u0646\u062F.", { statusCode: 403 });
    }
    await serverDeleteDoc("teachers", id, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "DELETE_TEACHER",
      entityType: "teacher",
      entityId: id,
      description: `\u062D\u0630\u0641 \u067E\u0631\u0648\u0646\u062F\u0647 \u0627\u0633\u062A\u0627\u062F \u0628\u0627 \u0634\u0646\u0627\u0633\u0647 ${id}`
    });
    logger.warn(`[TeacherService] Deleted teacher ${id} by ${callerUser?.username || "system"}`);
    return true;
  }
  /**
   * Calculate and fetch weekly teaching schedule for a teacher
   */
  static async getTeacherSchedule(teacherId, callerUser) {
    const teacher = await this.getTeacherById(teacherId, callerUser);
    const allPrograms = await serverQueryCollection("programs", callerUser);
    const programsList = Array.isArray(allPrograms) ? allPrograms : [];
    const teacherPrograms = programsList.filter(
      (p) => p.teacherId === teacher.id || p.teacherName?.trim() === teacher.fullName.trim() || p.teacherName?.trim() === teacher.name?.trim()
    );
    const daysOrder = ["\u0634\u0646\u0628\u0647", "\u06CC\u06A9\u0634\u0646\u0628\u0647", "\u062F\u0648\u0634\u0646\u0628\u0647", "\u0633\u0647\u200C\u0634\u0646\u0628\u0647", "\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647", "\u067E\u0646\u062C\u200C\u0634\u0646\u0628\u0647", "\u062C\u0645\u0639\u0647"];
    const scheduleByDay = {};
    daysOrder.forEach((d) => {
      scheduleByDay[d] = [];
    });
    teacherPrograms.forEach((prog) => {
      const day = prog.dayOfWeek || prog.day || "\u0646\u0627\u0645\u0634\u062E\u0635";
      if (!scheduleByDay[day]) scheduleByDay[day] = [];
      scheduleByDay[day].push({
        id: prog.id,
        title: prog.title || prog.courseTitle || "\u062F\u0631\u0633 \u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646",
        grade: prog.grade || "\u0639\u0645\u0648\u0645\u06CC",
        startTime: prog.startTime || "",
        endTime: prog.endTime || "",
        classroom: prog.classroomTitle || prog.classroomName || prog.room || "\u06A9\u0644\u0627\u0633 \u0646\u0627\u0645\u0634\u062E\u0635",
        type: prog.programType || prog.type || "\u0627\u0635\u0644\u06CC"
      });
    });
    return {
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      totalCourses: teacherPrograms.length,
      scheduleByDay,
      rawPrograms: teacherPrograms
    };
  }
};

// src/controllers/TeacherController.ts
init_serverAuth();
var TeacherController = class _TeacherController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAll(req, res, next) {
    try {
      const caller = _TeacherController.extractCaller(req);
      const items = await TeacherService.getAllTeachers(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _TeacherController.extractCaller(req);
      const teacher = await TeacherService.getTeacherById(id, caller);
      return res.status(200).json({ success: true, teacher });
    } catch (error) {
      next(error);
    }
  }
  static async save(req, res, next) {
    try {
      const caller = _TeacherController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) {
        payload.id = req.params.id;
      }
      const teacher = await TeacherService.saveTeacher(payload, caller);
      return res.status(200).json({ success: true, message: "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0627\u0633\u062A\u0627\u062F \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", teacher });
    } catch (error) {
      next(error);
    }
  }
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _TeacherController.extractCaller(req);
      await TeacherService.deleteTeacher(id, caller);
      return res.status(200).json({ success: true, message: "\u067E\u0631\u0648\u0646\u062F\u0647 \u0627\u0633\u062A\u0627\u062F \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u06AF\u0631\u062F\u06CC\u062F." });
    } catch (error) {
      next(error);
    }
  }
  static async getSchedule(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _TeacherController.extractCaller(req);
      const schedule = await TeacherService.getTeacherSchedule(id, caller);
      return res.status(200).json({ success: true, schedule });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/teacherRoutes.ts
var router3 = (0, import_express3.Router)();
router3.get("/", TeacherController.getAll);
router3.get("/:id", TeacherController.getById);
router3.post("/", TeacherController.save);
router3.put("/:id", TeacherController.save);
router3.delete("/:id", TeacherController.delete);
router3.get("/:id/schedule", TeacherController.getSchedule);
var teacherRoutes_default = router3;

// src/routes/programRoutes.ts
var import_express4 = require("express");

// src/services/ProgramService.ts
var import_zod4 = require("zod");
init_serverDataApi();
init_serverAuth();
init_logger();
var ProgramInputSchema = import_zod4.z.object({
  id: import_zod4.z.string().optional(),
  title: import_zod4.z.string().min(2, "\u0639\u0646\u0648\u0627\u0646 \u0628\u0631\u0646\u0627\u0645\u0647 \u06CC\u0627 \u062F\u0631\u0633 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  type: import_zod4.z.enum(["\u0627\u0635\u0644\u06CC", "\u0645\u0634\u0627\u0648\u0631\u0647", "\u067E\u0698\u0648\u0647\u0634", "\u062F\u0631\u0648\u0633 5 \u0634\u0646\u0628\u0647", "\u0633\u0627\u06CC\u0631"]).default("\u0627\u0635\u0644\u06CC"),
  day: import_zod4.z.string().optional(),
  days: import_zod4.z.array(import_zod4.z.string()).optional(),
  time: import_zod4.z.string().optional(),
  startTime: import_zod4.z.string().optional(),
  endTime: import_zod4.z.string().optional(),
  teacher: import_zod4.z.string().optional(),
  teacherId: import_zod4.z.string().optional(),
  madrasRoom: import_zod4.z.string().optional(),
  classroom: import_zod4.z.string().optional(),
  grade: import_zod4.z.string().optional(),
  capacity: import_zod4.z.number().optional(),
  notes: import_zod4.z.string().optional(),
  mentorId: import_zod4.z.string().optional(),
  parentProgramId: import_zod4.z.string().optional(),
  representativeStudentIds: import_zod4.z.array(import_zod4.z.string()).optional(),
  representativeNames: import_zod4.z.array(import_zod4.z.string()).optional(),
  customRepresentative: import_zod4.z.string().optional(),
  subjectCategory: import_zod4.z.enum(["\u0627\u0635\u0648\u0644", "\u0641\u0642\u0647", "\u0641\u0644\u0633\u0641\u0647", "\u0633\u0627\u06CC\u0631"]).optional(),
  subjectBook: import_zod4.z.string().optional()
});
function normalizeTimeStr(timeStr) {
  if (!timeStr) return "";
  const eng = timeStr.replace(/[۰-۹]/g, (d) => "0123456789"["\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9".indexOf(d)]).trim();
  const parts = eng.split(":");
  if (parts.length === 2) {
    const hh = parts[0].padStart(2, "0");
    const mm = parts[1].padStart(2, "0");
    return `${hh}:${mm}`;
  }
  return eng;
}
function extractProgramTimeRange(prog) {
  if (prog.startTime && prog.endTime) {
    const s = normalizeTimeStr(prog.startTime);
    const e = normalizeTimeStr(prog.endTime);
    if (s && e) return { startTime: s, endTime: e };
  }
  if (!prog.time) return null;
  const eng = prog.time.replace(/[۰-۹]/g, (d) => "0123456789"["\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9".indexOf(d)]);
  const match = eng.match(/(\d{1,2}:\d{2})\s*(?:الی|تا|-|to)\s*(\d{1,2}:\d{2})/i);
  if (match) {
    return {
      startTime: normalizeTimeStr(match[1]),
      endTime: normalizeTimeStr(match[2])
    };
  }
  return null;
}
function isTimeOverlapping(start1, end1, start2, end2) {
  if (!start1 || !end1 || !start2 || !end2) return false;
  return start1 < end2 && start2 < end1;
}
var ProgramService = class {
  /**
   * Fetch all programs with scoping based on user level and assigned grade
   */
  static async getAllPrograms(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "programs", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0645\u0634\u0627\u0647\u062F\u0647 \u0628\u0631\u0646\u0627\u0645\u0647 \u0622\u0645\u0648\u0632\u0634\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("programs", callerUser);
    const programs = Array.isArray(items) ? items : [];
    if (callerUser && callerUser.level === 2 && callerUser.scope && callerUser.scope.startsWith("grade_")) {
      const gradeMap = {
        "grade_7": "\u067E\u0627\u06CC\u0647 \u06F7",
        "grade_8": "\u067E\u0627\u06CC\u0647 \u06F8",
        "grade_9": "\u067E\u0627\u06CC\u0647 \u06F9",
        "grade_10": "\u067E\u0627\u06CC\u0647 \u06F1\u06F0"
      };
      const assignedGrade = gradeMap[callerUser.scope];
      if (assignedGrade) {
        return programs.filter((p) => !p.grade || p.grade === assignedGrade || p.grade === "\u0639\u0645\u0648\u0645\u06CC");
      }
    }
    if (callerUser && callerUser.role === "teacher") {
      const uName = callerUser.name?.trim();
      return programs.filter(
        (p) => p.teacher && uName && p.teacher.trim() === uName || callerUser.teacherId && p.teacherId === callerUser.teacherId
      );
    }
    return programs;
  }
  /**
   * Fetch single program by ID
   */
  static async getProgramById(id, callerUser) {
    const programs = await this.getAllPrograms(callerUser);
    const program = programs.find((p) => p.id === id);
    if (!program) {
      throw new AppError("\u0628\u0631\u0646\u0627\u0645\u0647 \u06CC\u0627 \u06A9\u0644\u0627\u0633 \u062F\u0631\u0633\u06CC \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.", { statusCode: 404 });
    }
    return program;
  }
  /**
   * Create or update a program with Zod validation, collision detection, and audit logging
   */
  static async saveProgram(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "programs", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0647\u0627\u06CC \u0622\u0645\u0648\u0632\u0634\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = ProgramInputSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0628\u0631\u0646\u0627\u0645\u0647 \u062F\u0631\u0633\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const targetRoom = validData.madrasRoom || validData.classroom;
    const targetTeacher = validData.teacher?.trim();
    const targetDays = validData.days && validData.days.length > 0 ? validData.days : validData.day ? [validData.day] : [];
    const id = validData.id || `prog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const targetTimeRange = extractProgramTimeRange(validData);
    if (targetTimeRange && targetDays.length > 0) {
      const allPrograms = await serverQueryCollection("programs", callerUser);
      if (Array.isArray(allPrograms)) {
        for (const existing of allPrograms) {
          if (existing.id === id) continue;
          const existingDays = existing.days && existing.days.length > 0 ? existing.days : existing.day ? [existing.day] : [];
          const sharedDays = targetDays.filter((d) => existingDays.includes(d));
          if (sharedDays.length === 0) continue;
          const existingTimeRange = extractProgramTimeRange(existing);
          if (!existingTimeRange) continue;
          const hasTimeConflict = isTimeOverlapping(
            targetTimeRange.startTime,
            targetTimeRange.endTime,
            existingTimeRange.startTime,
            existingTimeRange.endTime
          );
          if (!hasTimeConflict) continue;
          if (targetTeacher) {
            const existingTeacher = (existing.teacher || "").trim();
            if (existingTeacher && (existingTeacher.toLowerCase() === targetTeacher.toLowerCase() || existingTeacher.includes(targetTeacher) || targetTeacher.includes(existingTeacher))) {
              throw new AppError(
                `\u062A\u0632\u0627\u062D\u0645 \u0632\u0645\u0627\u0646 \u062A\u062F\u0631\u06CC\u0633: \u0627\u0633\u062A\u0627\u062F \xAB${targetTeacher}\xBB \u062F\u0631 \u0631\u0648\u0632 ${sharedDays.join(" \u0648 ")} \u0633\u0627\u0639\u062A ${existingTimeRange.startTime} \u062A\u0627 ${existingTimeRange.endTime} \u0642\u0628\u0644\u0627\u064B \u0628\u0631\u0627\u06CC \u06A9\u0644\u0627\u0633 \xAB${existing.title}\xBB (${existing.grade || "\u0639\u0645\u0648\u0645\u06CC"}) \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC \u0634\u062F\u0647\u200C\u0627\u0646\u062F \u0648 \u0627\u0645\u06A9\u0627\u0646 \u062A\u062F\u0627\u062E\u0644 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.`,
                { statusCode: 409 }
              );
            }
          }
          if (targetRoom) {
            const existingRoom = existing.madrasRoom || existing.classroom;
            if (existingRoom && existingRoom.trim().toLowerCase() === targetRoom.trim().toLowerCase()) {
              throw new AppError(
                `\u062A\u0632\u0627\u062D\u0645 \u0645\u06A9\u0627\u0646 \u0648 \u0645\u062F\u0631\u064E\u0633: \u0645\u062F\u0631\u064E\u0633 \xAB${targetRoom}\xBB \u062F\u0631 \u0631\u0648\u0632 ${sharedDays.join(" \u0648 ")} \u0633\u0627\u0639\u062A ${existingTimeRange.startTime} \u062A\u0627 ${existingTimeRange.endTime} \u0642\u0628\u0644\u0627\u064B \u0628\u0631\u0627\u06CC \u062F\u0631\u0633 \xAB${existing.title}\xBB \u062A\u062E\u0635\u06CC\u0635 \u062F\u0627\u062F\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A.`,
                { statusCode: 409 }
              );
            }
          }
        }
      }
    }
    const programRecord = {
      id,
      title: validData.title.trim(),
      type: validData.type,
      day: validData.day,
      days: validData.days,
      time: validData.time || (targetTimeRange ? `${targetTimeRange.startTime} \u0627\u0644\u06CC ${targetTimeRange.endTime}` : void 0),
      startTime: validData.startTime || targetTimeRange?.startTime,
      endTime: validData.endTime || targetTimeRange?.endTime,
      teacher: targetTeacher,
      madrasRoom: targetRoom?.trim(),
      classroom: targetRoom?.trim(),
      grade: validData.grade?.trim(),
      capacity: validData.capacity,
      notes: validData.notes?.trim(),
      mentorId: validData.mentorId,
      parentProgramId: validData.parentProgramId,
      representativeStudentIds: validData.representativeStudentIds,
      representativeNames: validData.representativeNames,
      customRepresentative: validData.customRepresentative,
      subjectCategory: validData.subjectCategory,
      subjectBook: validData.subjectBook?.trim()
    };
    await serverSaveDoc("programs", programRecord, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: validData.id ? "UPDATE_PROGRAM" : "CREATE_PROGRAM",
      entityType: "program",
      entityId: id,
      description: `\u062B\u0628\u062A \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0628\u0631\u0646\u0627\u0645\u0647 \u062F\u0631\u0633\u06CC: ${programRecord.title} (${programRecord.grade || "\u0639\u0645\u0648\u0645\u06CC"})`,
      newState: programRecord
    });
    logger.info(`[ProgramService] Program saved: ${id} (${programRecord.title}) by ${callerUser?.username || "system"}`);
    return programRecord;
  }
  /**
   * Delete a program
   */
  static async deleteProgram(id, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "programs", "delete");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062D\u0630\u0641 \u0628\u0631\u0646\u0627\u0645\u0647 \u062F\u0631\u0633\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    await serverDeleteDoc("programs", id, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "DELETE_PROGRAM",
      entityType: "program",
      entityId: id,
      description: `\u062D\u0630\u0641 \u0628\u0631\u0646\u0627\u0645\u0647 \u062F\u0631\u0633\u06CC \u0628\u0627 \u0634\u0646\u0627\u0633\u0647 ${id}`
    });
    logger.warn(`[ProgramService] Deleted program ${id} by ${callerUser?.username || "system"}`);
    return true;
  }
  /**
   * Get weekly school schedule grouped by days of the week
   */
  static async getWeeklySchedule(callerUser) {
    const programs = await this.getAllPrograms(callerUser);
    const daysOrder = ["\u0634\u0646\u0628\u0647", "\u06CC\u06A9\u0634\u0646\u0628\u0647", "\u062F\u0648\u0634\u0646\u0628\u0647", "\u0633\u0647\u200C\u0634\u0646\u0628\u0647", "\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647", "\u067E\u0646\u062C\u200C\u0634\u0646\u0628\u0647", "\u062C\u0645\u0639\u0647"];
    const schedule = {};
    daysOrder.forEach((d) => {
      schedule[d] = [];
    });
    programs.forEach((prog) => {
      const days = prog.days && prog.days.length > 0 ? prog.days : prog.day ? [prog.day] : [];
      days.forEach((d) => {
        if (schedule[d]) {
          schedule[d].push(prog);
        } else {
          schedule[d] = [prog];
        }
      });
    });
    daysOrder.forEach((d) => {
      schedule[d].sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    });
    return {
      totalPrograms: programs.length,
      schedule
    };
  }
  /**
   * Get programs filtered by grade
   */
  static async getProgramsByGrade(grade, callerUser) {
    const all = await this.getAllPrograms(callerUser);
    const decodedGrade = decodeURIComponent(grade).trim();
    return all.filter((p) => p.grade && p.grade.trim() === decodedGrade);
  }
  /**
   * Get programs filtered by teacher ID or teacher Name
   */
  static async getProgramsByTeacher(teacherIdOrName, callerUser) {
    const all = await this.getAllPrograms(callerUser);
    const target = decodeURIComponent(teacherIdOrName).trim();
    return all.filter(
      (p) => p.teacherId && p.teacherId === target || p.teacher && p.teacher.trim() === target
    );
  }
};

// src/controllers/ProgramController.ts
init_serverAuth();
var ProgramController = class _ProgramController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAll(req, res, next) {
    try {
      const caller = _ProgramController.extractCaller(req);
      const items = await ProgramService.getAllPrograms(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _ProgramController.extractCaller(req);
      const program = await ProgramService.getProgramById(id, caller);
      return res.status(200).json({ success: true, program });
    } catch (error) {
      next(error);
    }
  }
  static async save(req, res, next) {
    try {
      const caller = _ProgramController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) {
        payload.id = req.params.id;
      }
      const program = await ProgramService.saveProgram(payload, caller);
      return res.status(200).json({ success: true, message: "\u0628\u0631\u0646\u0627\u0645\u0647 \u062F\u0631\u0633\u06CC \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", program });
    } catch (error) {
      next(error);
    }
  }
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _ProgramController.extractCaller(req);
      await ProgramService.deleteProgram(id, caller);
      return res.status(200).json({ success: true, message: "\u0628\u0631\u0646\u0627\u0645\u0647 \u062F\u0631\u0633\u06CC \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u06AF\u0631\u062F\u06CC\u062F." });
    } catch (error) {
      next(error);
    }
  }
  static async getWeeklySchedule(req, res, next) {
    try {
      const caller = _ProgramController.extractCaller(req);
      const schedule = await ProgramService.getWeeklySchedule(caller);
      return res.status(200).json({ success: true, ...schedule });
    } catch (error) {
      next(error);
    }
  }
  static async getByGrade(req, res, next) {
    try {
      const { grade } = req.params;
      const caller = _ProgramController.extractCaller(req);
      const items = await ProgramService.getProgramsByGrade(grade, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getByTeacher(req, res, next) {
    try {
      const { teacherId } = req.params;
      const caller = _ProgramController.extractCaller(req);
      const items = await ProgramService.getProgramsByTeacher(teacherId, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/programRoutes.ts
var router4 = (0, import_express4.Router)();
router4.get("/schedule/weekly", ProgramController.getWeeklySchedule);
router4.get("/grade/:grade", ProgramController.getByGrade);
router4.get("/teacher/:teacherId", ProgramController.getByTeacher);
router4.get("/", ProgramController.getAll);
router4.get("/:id", ProgramController.getById);
router4.post("/", ProgramController.save);
router4.put("/:id", ProgramController.save);
router4.delete("/:id", ProgramController.delete);
var programRoutes_default = router4;

// src/routes/classroomRoutes.ts
var import_express5 = require("express");

// src/services/ClassroomService.ts
var import_zod5 = require("zod");
init_serverDataApi();
init_serverAuth();
init_logger();
var ClassroomInputSchema = import_zod5.z.object({
  id: import_zod5.z.string().optional(),
  name: import_zod5.z.string().min(2, "\u0646\u0627\u0645 \u0645\u064E\u062F\u0631\u064E\u0633 \u06CC\u0627 \u06A9\u0644\u0627\u0633 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  code: import_zod5.z.string().optional(),
  capacity: import_zod5.z.number().min(1, "\u0638\u0631\u0641\u06CC\u062A \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F1 \u0646\u0641\u0631 \u0628\u0627\u0634\u062F.").optional(),
  floor: import_zod5.z.string().optional(),
  facilities: import_zod5.z.array(import_zod5.z.string()).optional(),
  description: import_zod5.z.string().optional(),
  color: import_zod5.z.string().optional(),
  isActive: import_zod5.z.boolean().optional()
});
var ClassroomService = class {
  /**
   * Fetch all classrooms
   */
  static async getAllClassrooms(callerUser) {
    const items = await serverQueryCollection("classrooms", callerUser);
    return Array.isArray(items) ? items : [];
  }
  /**
   * Fetch single classroom by ID
   */
  static async getClassroomById(id, callerUser) {
    const classrooms = await this.getAllClassrooms(callerUser);
    const room = classrooms.find((r) => r.id === id || r.name === id);
    if (!room) {
      throw new AppError("\u0645\u064E\u062F\u0631\u064E\u0633 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.", { statusCode: 404 });
    }
    return room;
  }
  /**
   * Create or update a classroom
   */
  static async saveClassroom(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "classrooms", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u06A9\u0644\u0627\u0633\u200C\u0647\u0627 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = ClassroomInputSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const roomRecord = {
      id,
      name: validData.name.trim(),
      code: validData.code?.trim() || "",
      capacity: validData.capacity || 25,
      floor: validData.floor?.trim() || "",
      facilities: validData.facilities || [],
      description: validData.description?.trim() || "",
      color: validData.color || "blue",
      isActive: validData.isActive !== false,
      createdAt: rawData?.createdAt || nowIso
    };
    await serverSaveDoc("classrooms", roomRecord, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: validData.id ? "UPDATE_CLASSROOM" : "CREATE_CLASSROOM",
      entityType: "classroom",
      entityId: id,
      description: `\u062B\u0628\u062A \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0645\u064E\u062F\u0631\u064E\u0633: ${roomRecord.name} (\u0638\u0631\u0641\u06CC\u062A: ${roomRecord.capacity})`,
      newState: roomRecord
    });
    logger.info(`[ClassroomService] Saved classroom ${id} (${roomRecord.name}) by ${callerUser?.username || "system"}`);
    return roomRecord;
  }
  /**
   * Delete a classroom
   */
  static async deleteClassroom(id, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "classrooms", "delete");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062D\u0630\u0641 \u06A9\u0644\u0627\u0633 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    await serverDeleteDoc("classrooms", id, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "DELETE_CLASSROOM",
      entityType: "classroom",
      entityId: id,
      description: `\u062D\u0630\u0641 \u0645\u064E\u062F\u0631\u064E\u0633 \u0628\u0627 \u0634\u0646\u0627\u0633\u0647 ${id}`
    });
    logger.warn(`[ClassroomService] Deleted classroom ${id} by ${callerUser?.username || "system"}`);
    return true;
  }
  /**
   * Get capacity analysis and active programs hosted in this classroom
   */
  static async getClassroomCapacity(id, callerUser) {
    const room = await this.getClassroomById(id, callerUser);
    const allPrograms = await serverQueryCollection("programs", callerUser);
    const programsInRoom = Array.isArray(allPrograms) ? allPrograms.filter((p) => p.madrasRoom && p.madrasRoom === room.name || p.classroom && p.classroom === room.name) : [];
    return {
      classroomId: room.id,
      classroomName: room.name,
      definedCapacity: room.capacity || 25,
      activeProgramsCount: programsInRoom.length,
      assignedPrograms: programsInRoom.map((p) => ({
        id: p.id,
        title: p.title,
        grade: p.grade,
        teacher: p.teacher,
        days: p.days || (p.day ? [p.day] : []),
        time: p.time || `${p.startTime} - ${p.endTime}`
      }))
    };
  }
};

// src/controllers/ClassroomController.ts
init_serverAuth();
var ClassroomController = class _ClassroomController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAll(req, res, next) {
    try {
      const caller = _ClassroomController.extractCaller(req);
      const items = await ClassroomService.getAllClassrooms(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _ClassroomController.extractCaller(req);
      const classroom = await ClassroomService.getClassroomById(id, caller);
      return res.status(200).json({ success: true, classroom });
    } catch (error) {
      next(error);
    }
  }
  static async save(req, res, next) {
    try {
      const caller = _ClassroomController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) {
        payload.id = req.params.id;
      }
      const classroom = await ClassroomService.saveClassroom(payload, caller);
      return res.status(200).json({ success: true, message: "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u06A9\u0644\u0627\u0633 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", classroom });
    } catch (error) {
      next(error);
    }
  }
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _ClassroomController.extractCaller(req);
      await ClassroomService.deleteClassroom(id, caller);
      return res.status(200).json({ success: true, message: "\u06A9\u0644\u0627\u0633 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u06AF\u0631\u062F\u06CC\u062F." });
    } catch (error) {
      next(error);
    }
  }
  static async getCapacity(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _ClassroomController.extractCaller(req);
      const capacityInfo = await ClassroomService.getClassroomCapacity(id, caller);
      return res.status(200).json({ success: true, ...capacityInfo });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/classroomRoutes.ts
var router5 = (0, import_express5.Router)();
router5.get("/:id/capacity", ClassroomController.getCapacity);
router5.get("/", ClassroomController.getAll);
router5.get("/:id", ClassroomController.getById);
router5.post("/", ClassroomController.save);
router5.put("/:id", ClassroomController.save);
router5.delete("/:id", ClassroomController.delete);
var classroomRoutes_default = router5;

// src/routes/tuitionRoutes.ts
var import_express6 = require("express");

// src/services/TuitionService.ts
var import_zod6 = require("zod");
init_serverDataApi();
init_serverAuth();
init_logger();
var TuitionCalculationInputSchema = import_zod6.z.object({
  studentId: import_zod6.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentName: import_zod6.z.string().min(1, "\u0646\u0627\u0645 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  maritalStatus: import_zod6.z.enum(["\u0645\u062C\u0631\u062F", "\u0645\u062A\u0627\u0647\u0644"]).optional(),
  isMarried: import_zod6.z.boolean().optional(),
  childrenCount: import_zod6.z.number().nonnegative().optional(),
  livingStatus: import_zod6.z.string().optional(),
  isTammam: import_zod6.z.boolean().optional(),
  bankAccount: import_zod6.z.string().optional(),
  bankSheba: import_zod6.z.string().optional(),
  tuitionCode: import_zod6.z.string().optional(),
  // Custom manual overrides / additions
  manualAdjustmentAmount: import_zod6.z.number().optional(),
  manualAdjustmentReason: import_zod6.z.string().optional(),
  educationAdjustmentAmount: import_zod6.z.number().optional(),
  educationAdjustmentReason: import_zod6.z.string().optional()
});
var TuitionService = class {
  /**
   * Pure Business Logic: Calculate full tuition breakdown according to BUSINESS_RULES
   */
  static calculateTuition(profile, settings) {
    const isMarried = profile.maritalStatus === "\u0645\u062A\u0627\u0647\u0644" || Boolean(profile.isMarried);
    const baseTuition = isMarried ? settings?.marriedBaseTuition || settings?.baseMarriedTuition || 3e6 : settings?.singleBaseTuition || settings?.baseSingleTuition || 2e6;
    let maritalBonus = 0;
    if (isMarried && settings?.hasMarriageBonus) {
      if (settings.marriageBonusType === "percentage" && settings.marriageBonusPercent) {
        maritalBonus = Math.round(baseTuition * settings.marriageBonusPercent / 100);
      } else if (settings.marriageBonusAmount) {
        maritalBonus = settings.marriageBonusAmount;
      }
    }
    const children = profile.childrenCount || 0;
    const childRate = settings?.hasChildAllowance ? settings.childAllowance || settings.childAllowancePerChild || 3e5 : 0;
    const childAllowanceTotal = children * childRate;
    const turbanAllowance = (profile.isTammam || profile.isRobed) && settings?.hasTurbanAllowance ? settings.turbanAllowance || settings.clericalHabitBonus || 4e5 : 0;
    let housingAllowance = 0;
    if (settings?.hasHousingAllowance) {
      if (profile.livingStatus === "\u0627\u062C\u0627\u0631\u0647 \u0627\u06CC") {
        housingAllowance = settings.housingAllowanceRented || settings.housingSubsidy || 5e5;
      } else if (profile.livingStatus === "\u062E\u0648\u0627\u0628\u06AF\u0627\u0647") {
        housingAllowance = settings.housingAllowanceDorm || 2e5;
      }
    }
    let studyBonusAmount = 0;
    let studyPenaltyAmount = 0;
    const studyLogged = profile.studyHoursLogged || 0;
    const mandatoryHours = 40;
    if (studyLogged > mandatoryHours && settings?.studyBonusEnabled) {
      const extraHours = studyLogged - mandatoryHours;
      studyBonusAmount = Math.round(extraHours * (settings.studyBonusPerHour || settings.studyBonusRatePerHour || 2e4));
    } else if (studyLogged < mandatoryHours && settings?.studyPenaltyEnabled) {
      const shortageHours = mandatoryHours - studyLogged;
      studyPenaltyAmount = Math.round(shortageHours * (settings.studyPenaltyPerHour || settings.studyPenaltyRatePerHour || 15e3));
    }
    let absencePenaltyAmount = 0;
    const unexcused = profile.unexcusedAbsences || 0;
    if (unexcused > 0 && settings?.absenceDeductionEnabled) {
      absencePenaltyAmount = Math.round(unexcused * (settings.absencePenaltyPerSession || settings.absencePenaltyUnexcusedAmount || 5e4));
    }
    let generalIncentiveAmount = 0;
    if (settings?.enableGeneralIncentive) {
      if (settings.generalIncentiveType === "percentage" && settings.generalIncentivePercent) {
        generalIncentiveAmount = Math.round(baseTuition * settings.generalIncentivePercent / 100);
      } else if (settings.generalIncentiveAmount) {
        generalIncentiveAmount = settings.generalIncentiveAmount;
      }
    }
    const totalAdditions = maritalBonus + childAllowanceTotal + turbanAllowance + housingAllowance + studyBonusAmount + generalIncentiveAmount;
    const type1DeductionsTotal = absencePenaltyAmount + studyPenaltyAmount;
    const grossEarnedTuition = Math.max(0, baseTuition + totalAdditions - type1DeductionsTotal);
    const lunchDeductionAmount = Math.round((profile.lunchDaysCount || profile.monthlyLunchDays || 0) * (settings?.lunchCostPerDay || settings?.dailyLunchCost || 35e3));
    const dinnerDeductionAmount = Math.round((profile.dinnerDaysCount || profile.monthlyDinnerDays || 0) * (settings?.dinnerCostPerDay || settings?.dailyDinnerCost || 25e3));
    const totalMealDeduction = lunchDeductionAmount + dinnerDeductionAmount;
    const loanInstallmentDeduction = profile.monthlyLoanInstallment || profile.activeLoanInstallment || 0;
    const fundContributionDeduction = profile.fundContributionMonthly || profile.fundContribution || 0;
    const type2DeductionsTotal = totalMealDeduction + loanInstallmentDeduction + fundContributionDeduction;
    const netPayableTuition = Math.max(0, grossEarnedTuition - type2DeductionsTotal);
    return {
      studentId: profile.studentId,
      studentName: profile.studentName,
      nationalId: profile.nationalId,
      grade: profile.grade,
      maritalStatus: profile.maritalStatus || (isMarried ? "\u0645\u062A\u0627\u0647\u0644" : "\u0645\u062C\u0631\u062F"),
      livingStatus: profile.livingStatus,
      isTammam: profile.isTammam,
      bankAccount: profile.bankAccount,
      bankSheba: profile.bankSheba,
      tuitionCode: profile.tuitionCode || "",
      baseTuition,
      baseAmount: baseTuition,
      maritalBonus,
      childAllowanceTotal,
      childAllowance: childAllowanceTotal,
      turbanAllowance,
      housingAllowance,
      studyBonusAmount,
      studyBonus: studyBonusAmount,
      studyPenaltyAmount,
      unexcusedAbsenceCount: unexcused,
      absencePenaltyAmount,
      absenceDeduction: absencePenaltyAmount,
      lunchDaysCount: profile.lunchDaysCount || 0,
      lunchDeductionAmount,
      lunchDeduction: lunchDeductionAmount,
      dinnerDaysCount: profile.dinnerDaysCount || 0,
      dinnerDeductionAmount,
      dinnerDeduction: dinnerDeductionAmount,
      totalMealDeduction,
      loanInstallmentDeduction,
      loanDeduction: loanInstallmentDeduction,
      fundContributionDeduction,
      fundDeduction: fundContributionDeduction,
      generalIncentiveAmount,
      totalAdditions,
      totalEarnings: baseTuition + totalAdditions,
      type1DeductionsTotal,
      grossEarnedTuition,
      type2DeductionsTotal,
      netPayableTuition,
      netPayable: netPayableTuition
    };
  }
  /**
   * Fetch all tuition records or periods
   */
  static async getAllTuitionRecords(filters, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "tuition_records", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0627\u0645\u0648\u0631 \u0645\u0627\u0644\u06CC \u0648 \u0634\u0647\u0631\u06CC\u0647 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("tuition_records", callerUser);
    const records = Array.isArray(items) ? items : [];
    if (filters?.periodId) {
      return records.filter((r) => r.periodId === filters.periodId);
    }
    if (filters?.status) {
      return records.filter((r) => r.status === filters.status);
    }
    return records;
  }
  /**
   * Fetch tuition history for a single student
   */
  static async getTuitionByStudent(studentId, callerUser) {
    const records = await this.getAllTuitionRecords({}, callerUser);
    return records.filter((r) => r.studentId === studentId);
  }
  /**
   * Save / Issue a tuition calculation record
   */
  static async saveTuitionRecord(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "tuition_records", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0645\u062D\u0627\u0633\u0628\u0627\u062A \u0634\u0647\u0631\u06CC\u0647 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const id = rawData.id || `tui_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record = {
      ...rawData,
      id,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await serverSaveDoc("tuition_records", record, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "SAVE_TUITION_RECORD",
      entityType: "tuition_record",
      entityId: id,
      description: `\u062B\u0628\u062A \u0641\u0627\u06A9\u062A\u0648\u0631 \u0634\u0647\u0631\u06CC\u0647 \u0628\u0631\u0627\u06CC \u0637\u0644\u0628\u0647: ${rawData.studentName || id}`
    });
    logger.info(`[TuitionService] Saved tuition record ${id} by ${callerUser?.username || "system"}`);
    return record;
  }
  /**
   * Delete a tuition record
   */
  static async deleteTuitionRecord(id, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "tuition_records", "delete");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u062A\u0646\u0647\u0627 \u0645\u0633\u0626\u0648\u0644 \u0645\u0627\u0644\u06CC \u06CC\u0627 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0645\u062C\u0627\u0632 \u0628\u0647 \u062D\u0630\u0641 \u0633\u0646\u062F \u0634\u0647\u0631\u06CC\u0647 \u0627\u0633\u062A.", { statusCode: 403 });
    }
    await serverDeleteDoc("tuition_records", id, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "DELETE_TUITION_RECORD",
      entityType: "tuition_record",
      entityId: id,
      description: `\u062D\u0630\u0641 \u0641\u0627\u06A9\u062A\u0648\u0631 \u0634\u0647\u0631\u06CC\u0647 \u0628\u0627 \u0634\u0646\u0627\u0633\u0647 ${id}`
    });
    return true;
  }
  /**
   * Mark a tuition record as paid
   */
  static async markAsPaid(recordId, callerUser) {
    const records = await this.getAllTuitionRecords({}, callerUser);
    const target = records.find((r) => r.id === recordId);
    if (!target) {
      throw new AppError("\u0641\u0627\u06A9\u062A\u0648\u0631 \u0634\u0647\u0631\u06CC\u0647 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.", { statusCode: 404 });
    }
    const updated = {
      ...target,
      status: "paid",
      paidAt: (/* @__PURE__ */ new Date()).toISOString(),
      paidBy: callerUser?.username || "system"
    };
    await serverSaveDoc("tuition_records", updated, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "MARK_TUITION_PAID",
      entityType: "tuition_record",
      entityId: recordId,
      description: `\u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u0641\u0627\u06A9\u062A\u0648\u0631 \u0634\u0647\u0631\u06CC\u0647 \u0628\u0647 "\u067E\u0631\u062F\u0627\u062E\u062A \u0634\u062F\u0647" \u0628\u0631\u0627\u06CC \u0637\u0644\u0628\u0647: ${target.studentName}`
    });
    return updated;
  }
  /**
   * Generate comprehensive financial summary report
   */
  static async getTuitionReport(periodId, filters, callerUser) {
    const records = await this.getAllTuitionRecords({ periodId, ...filters }, callerUser);
    let totalGrossEarned = 0;
    let totalType2Deductions = 0;
    let totalNetPayable = 0;
    let paidCount = 0;
    let pendingCount = 0;
    records.forEach((r) => {
      totalGrossEarned += Number(r.grossEarnedTuition || r.totalEarnings || 0);
      totalType2Deductions += Number(r.type2DeductionsTotal || 0);
      totalNetPayable += Number(r.netPayableTuition || r.netPayable || 0);
      if (r.status === "paid") paidCount++;
      else pendingCount++;
    });
    return {
      periodId: periodId || "all",
      totalRecords: records.length,
      paidCount,
      pendingCount,
      totalGrossEarned,
      totalType2Deductions,
      totalNetPayable,
      records
    };
  }
};

// src/controllers/TuitionController.ts
init_serverAuth();
var TuitionController = class _TuitionController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAll(req, res, next) {
    try {
      const caller = _TuitionController.extractCaller(req);
      const items = await TuitionService.getAllTuitionRecords(req.query, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getByStudent(req, res, next) {
    try {
      const { studentId } = req.params;
      const caller = _TuitionController.extractCaller(req);
      const items = await TuitionService.getTuitionByStudent(studentId, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async calculate(req, res, next) {
    try {
      const { profile, settings } = req.body;
      const result = TuitionService.calculateTuition(profile || req.body, settings);
      return res.status(200).json({ success: true, breakdown: result });
    } catch (error) {
      next(error);
    }
  }
  static async save(req, res, next) {
    try {
      const caller = _TuitionController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const record = await TuitionService.saveTuitionRecord(payload, caller);
      return res.status(200).json({ success: true, message: "\u0641\u0627\u06A9\u062A\u0648\u0631 \u0634\u0647\u0631\u06CC\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.", record });
    } catch (error) {
      next(error);
    }
  }
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _TuitionController.extractCaller(req);
      await TuitionService.deleteTuitionRecord(id, caller);
      return res.status(200).json({ success: true, message: "\u0641\u0627\u06A9\u062A\u0648\u0631 \u0634\u0647\u0631\u06CC\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u06AF\u0631\u062F\u06CC\u062F." });
    } catch (error) {
      next(error);
    }
  }
  static async markPaid(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _TuitionController.extractCaller(req);
      const updated = await TuitionService.markAsPaid(id, caller);
      return res.status(200).json({ success: true, message: "\u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u062F\u0627\u062E\u062A \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.", record: updated });
    } catch (error) {
      next(error);
    }
  }
  static async getReport(req, res, next) {
    try {
      const caller = _TuitionController.extractCaller(req);
      const periodId = req.query.periodId;
      const report = await TuitionService.getTuitionReport(periodId, req.query, caller);
      return res.status(200).json({ success: true, ...report });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/tuitionRoutes.ts
var router6 = (0, import_express6.Router)();
router6.get("/report", TuitionController.getReport);
router6.get("/student/:studentId", TuitionController.getByStudent);
router6.post("/calculate", TuitionController.calculate);
router6.get("/", TuitionController.getAll);
router6.post("/", TuitionController.save);
router6.put("/:id", TuitionController.save);
router6.delete("/:id", TuitionController.delete);
router6.post("/:id/pay", TuitionController.markPaid);
var tuitionRoutes_default = router6;

// src/routes/loanRoutes.ts
var import_express7 = require("express");

// src/services/LoanService.ts
var import_zod7 = require("zod");
init_serverDataApi();
init_serverAuth();
init_logger();
var LoanInputSchema = import_zod7.z.object({
  id: import_zod7.z.string().optional(),
  studentId: import_zod7.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentName: import_zod7.z.string().min(1, "\u0646\u0627\u0645 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  claimTitle: import_zod7.z.string().min(2, "\u0639\u0646\u0648\u0627\u0646 \u0648\u0627\u0645 \u06CC\u0627 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.").default("\u0648\u0627\u0645 \u0642\u0631\u0636\u200C\u0627\u0644\u062D\u0633\u0646\u0647"),
  totalDebtAmount: import_zod7.z.number().positive("\u0645\u0628\u0644\u063A \u06A9\u0644 \u0648\u0627\u0645 \u0628\u0627\u06CC\u062F \u0645\u062B\u0628\u062A \u0628\u0627\u0634\u062F."),
  monthlyDeductionAmount: import_zod7.z.number().positive("\u0645\u0628\u0644\u063A \u0642\u0633\u0637 \u0645\u0627\u0647\u0627\u0646\u0647 \u0628\u0627\u06CC\u062F \u0645\u062B\u0628\u062A \u0628\u0627\u0634\u062F."),
  destinationAccountId: import_zod7.z.string().optional().default("account_qard_fund"),
  startDate: import_zod7.z.string().optional(),
  dueDate: import_zod7.z.string().optional(),
  notes: import_zod7.z.string().optional()
});
var LoanService = class {
  /**
   * Fetch all loans and claims records
   */
  static async getAllLoans(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "loans", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0635\u0646\u062F\u0648\u0642 \u0648\u0627\u0645 \u0648 \u0645\u0637\u0627\u0644\u0628\u0627\u062A \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("loans", callerUser);
    return Array.isArray(items) ? items : [];
  }
  /**
   * Fetch active loans for a student
   */
  static async getLoansByStudent(studentId, callerUser) {
    const loans = await this.getAllLoans(callerUser);
    return loans.filter((l) => l.studentId === studentId);
  }
  /**
   * Grant a new loan to a student with validation and audit log
   */
  static async createLoan(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "loans", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u067E\u0631\u062F\u0627\u062E\u062A \u06CC\u0627 \u062B\u0628\u062A \u0648\u0627\u0645 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = LoanInputSchema.safeParse(rawData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0628\u0631\u0627\u06CC \u0648\u0627\u0645 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(firstError, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `loan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const loanRecord = {
      id,
      claimCategoryId: "cat_qard_loan",
      claimTitle: validData.claimTitle,
      studentId: validData.studentId,
      studentName: validData.studentName,
      destinationAccountId: validData.destinationAccountId || "account_qard_fund",
      totalDebtAmount: validData.totalDebtAmount,
      monthlyDeductionAmount: validData.monthlyDeductionAmount,
      paidAmount: 0,
      remainingAmount: validData.totalDebtAmount,
      status: "active",
      startDate: validData.startDate || (/* @__PURE__ */ new Date()).toLocaleDateString("fa-IR"),
      notes: validData.notes || "",
      createdAt: nowIso,
      updatedAt: nowIso
    };
    await serverSaveDoc("loans", loanRecord, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "CREATE_LOAN",
      entityType: "loan",
      entityId: id,
      description: `\u0627\u0639\u0637\u0627\u06CC \u0648\u0627\u0645 \u0628\u0647 \u0645\u0628\u0644\u063A ${validData.totalDebtAmount.toLocaleString()} \u062A\u0648\u0645\u0627\u0646 \u0628\u0647 \u0637\u0644\u0628\u0647: ${validData.studentName}`,
      newState: loanRecord
    });
    logger.info(`[LoanService] Created loan ${id} for student ${validData.studentName}`);
    return loanRecord;
  }
  /**
   * Record installment repayment
   */
  static async recordInstallmentPayment(loanId, amount, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "loans", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u0642\u0633\u0637 \u0648\u0627\u0645 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    if (!amount || amount <= 0) {
      throw new AppError("\u0645\u0628\u0644\u063A \u0628\u0627\u0632\u067E\u0631\u062F\u0627\u062E\u062A \u0642\u0633\u0637 \u0628\u0627\u06CC\u062F \u0639\u062F\u062F \u0645\u062B\u0628\u062A \u0628\u0627\u0634\u062F.", { statusCode: 400 });
    }
    const loans = await this.getAllLoans(callerUser);
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) {
      throw new AppError("\u0648\u0627\u0645 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.", { statusCode: 404 });
    }
    const newPaidAmount = (loan.paidAmount || 0) + amount;
    const newRemainingAmount = Math.max(0, loan.totalDebtAmount - newPaidAmount);
    const isCompleted = newRemainingAmount <= 0;
    const updatedLoan = {
      ...loan,
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      status: isCompleted ? "completed" : loan.status,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await serverSaveDoc("loans", updatedLoan, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "RECORD_LOAN_INSTALLMENT",
      entityType: "loan",
      entityId: loanId,
      description: `\u062B\u0628\u062A \u0628\u0627\u0632\u067E\u0631\u062F\u0627\u062E\u062A \u0642\u0633\u0637 \u0648\u0627\u0645 \u0628\u0647 \u0645\u0628\u0644\u063A ${amount.toLocaleString()} \u062A\u0648\u0645\u0627\u0646 \u0628\u0631\u0627\u06CC \u0637\u0644\u0628\u0647: ${loan.studentName} (\u0645\u0627\u0646\u062F\u0647: ${newRemainingAmount.toLocaleString()})`
    });
    return updatedLoan;
  }
  /**
   * Get overdue loans (active loans with past due date or remaining balance exceeding threshold)
   */
  static async getOverdueLoans(callerUser) {
    const loans = await this.getAllLoans(callerUser);
    return loans.filter((l) => l.status === "active" && l.remainingAmount > 0 && l.isOverdue);
  }
  /**
   * Generate loan portfolio summary report
   */
  static async getLoanReport(callerUser) {
    const loans = await this.getAllLoans(callerUser);
    let totalLent = 0;
    let totalRepaid = 0;
    let totalRemaining = 0;
    let activeCount = 0;
    let completedCount = 0;
    loans.forEach((l) => {
      totalLent += Number(l.totalDebtAmount || 0);
      totalRepaid += Number(l.paidAmount || 0);
      totalRemaining += Number(l.remainingAmount || 0);
      if (l.status === "active") activeCount++;
      else if (l.status === "completed") completedCount++;
    });
    return {
      totalLoans: loans.length,
      activeCount,
      completedCount,
      totalLent,
      totalRepaid,
      totalRemaining,
      loans
    };
  }
};

// src/controllers/LoanController.ts
init_serverAuth();
var LoanController = class _LoanController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAll(req, res, next) {
    try {
      const caller = _LoanController.extractCaller(req);
      const items = await LoanService.getAllLoans(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getByStudent(req, res, next) {
    try {
      const { studentId } = req.params;
      const caller = _LoanController.extractCaller(req);
      const items = await LoanService.getLoansByStudent(studentId, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async create(req, res, next) {
    try {
      const caller = _LoanController.extractCaller(req);
      const loan = await LoanService.createLoan(req.body, caller);
      return res.status(200).json({ success: true, message: "\u0648\u0627\u0645 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0639\u0637\u0627 \u0648 \u062B\u0628\u062A \u06AF\u0631\u062F\u06CC\u062F.", loan });
    } catch (error) {
      next(error);
    }
  }
  static async recordPayment(req, res, next) {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      const caller = _LoanController.extractCaller(req);
      const updated = await LoanService.recordInstallmentPayment(id, Number(amount), caller);
      return res.status(200).json({ success: true, message: "\u067E\u0631\u062F\u0627\u062E\u062A \u0642\u0633\u0637 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u06AF\u0631\u062F\u06CC\u062F.", loan: updated });
    } catch (error) {
      next(error);
    }
  }
  static async getOverdue(req, res, next) {
    try {
      const caller = _LoanController.extractCaller(req);
      const items = await LoanService.getOverdueLoans(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getReport(req, res, next) {
    try {
      const caller = _LoanController.extractCaller(req);
      const report = await LoanService.getLoanReport(caller);
      return res.status(200).json({ success: true, ...report });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/loanRoutes.ts
var router7 = (0, import_express7.Router)();
router7.get("/overdue", LoanController.getOverdue);
router7.get("/report", LoanController.getReport);
router7.get("/student/:studentId", LoanController.getByStudent);
router7.get("/", LoanController.getAll);
router7.post("/", LoanController.create);
router7.post("/:id/payment", LoanController.recordPayment);
var loanRoutes_default = router7;

// src/routes/expenseRoutes.ts
var import_express8 = require("express");

// src/services/ExpenseService.ts
var import_zod8 = require("zod");
init_serverDataApi();
init_serverAuth();
init_logger();
var ExpenseInputSchema = import_zod8.z.object({
  id: import_zod8.z.string().optional(),
  title: import_zod8.z.string().min(2, "\u0639\u0646\u0648\u0627\u0646 \u0647\u0632\u06CC\u0646\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  date: import_zod8.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u0633\u0646\u062F \u0647\u0632\u06CC\u0646\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  amount: import_zod8.z.number().positive("\u0645\u0628\u0644\u063A \u0647\u0632\u06CC\u0646\u0647 \u0628\u0627\u06CC\u062F \u06CC\u06A9 \u0639\u062F\u062F \u0645\u062B\u0628\u062A \u0628\u0627\u0634\u062F."),
  payer: import_zod8.z.string().min(1, "\u067E\u0631\u062F\u0627\u062E\u062A\u200C\u06A9\u0646\u0646\u062F\u0647 \u06CC\u0627 \u062A\u0646\u062E\u0648\u0627\u0647\u200C\u062F\u0627\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  category: import_zod8.z.string().min(1, "\u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u06CC\u0627 \u0645\u0648\u0636\u0648\u0639 \u0647\u0632\u06CC\u0646\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  budgetRowId: import_zod8.z.string().optional(),
  budgetRowTitle: import_zod8.z.string().optional(),
  budgetCode: import_zod8.z.string().optional(),
  description: import_zod8.z.string().optional(),
  recipient: import_zod8.z.string().optional(),
  invoiceNumber: import_zod8.z.string().optional(),
  attachmentUrl: import_zod8.z.string().optional()
});
var ExpenseService = class {
  /**
   * Fetch all expense records
   */
  static async getAllExpenses(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "expenses", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u062B\u0628\u062A \u06CC\u0627 \u0645\u0634\u0627\u0647\u062F\u0647 \u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("expenses", callerUser);
    return Array.isArray(items) ? items : [];
  }
  /**
   * Create a new expense entry
   */
  static async createExpense(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "expenses", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u0633\u0646\u062F \u0647\u0632\u06CC\u0646\u0647 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = ExpenseInputSchema.safeParse(rawData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0647\u0632\u06CC\u0646\u0647 \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(firstError, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const expenseRecord = {
      id,
      title: validData.title.trim(),
      date: validData.date,
      amount: validData.amount,
      payer: validData.payer.trim(),
      category: validData.category.trim(),
      budgetRowId: validData.budgetRowId,
      budgetRowTitle: validData.budgetRowTitle,
      budgetCode: validData.budgetCode,
      description: validData.description?.trim() || "",
      recipient: validData.recipient?.trim() || "",
      invoiceNumber: validData.invoiceNumber?.trim() || "",
      attachmentUrl: validData.attachmentUrl || "",
      status: "approved",
      createdAt: nowIso,
      createdByName: callerUser?.username || "system"
    };
    await serverSaveDoc("expenses", expenseRecord, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "CREATE_EXPENSE",
      entityType: "expense",
      entityId: id,
      description: `\u062B\u0628\u062A \u0633\u0646\u062F \u0647\u0632\u06CC\u0646\u0647 \u0628\u0647 \u0645\u0628\u0644\u063A ${validData.amount.toLocaleString()} \u062A\u0648\u0645\u0627\u0646 \u0628\u0627 \u0639\u0646\u0648\u0627\u0646: ${validData.title}`,
      newState: expenseRecord
    });
    logger.info(`[ExpenseService] Created expense ${id} (${validData.title}) by ${callerUser?.username || "system"}`);
    return expenseRecord;
  }
  /**
   * Delete an expense record
   */
  static async deleteExpense(id, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "expenses", "delete");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u062A\u0646\u0647\u0627 \u0645\u0633\u0626\u0648\u0644 \u0645\u0627\u0644\u06CC \u06CC\u0627 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0645\u062C\u0627\u0632 \u0628\u0647 \u062D\u0630\u0641 \u0633\u0646\u062F \u0647\u0632\u06CC\u0646\u0647 \u0647\u0633\u062A\u0646\u062F.", { statusCode: 403 });
    }
    await serverDeleteDoc("expenses", id, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "DELETE_EXPENSE",
      entityType: "expense",
      entityId: id,
      description: `\u062D\u0630\u0641 \u0633\u0646\u062F \u0647\u0632\u06CC\u0646\u0647 \u0628\u0627 \u0634\u0646\u0627\u0633\u0647 ${id}`
    });
    logger.warn(`[ExpenseService] Deleted expense ${id} by ${callerUser?.username || "system"}`);
    return true;
  }
  /**
   * Get expense summary report grouped by category
   */
  static async getExpenseReport(filters, callerUser) {
    const expenses = await this.getAllExpenses(callerUser);
    let totalExpenseAmount = 0;
    const categoryTotals = {};
    expenses.forEach((e) => {
      const amt = Number(e.amount || 0);
      totalExpenseAmount += amt;
      const cat = e.category || "\u0645\u062A\u0641\u0631\u0642\u0647";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });
    return {
      totalRecords: expenses.length,
      totalExpenseAmount,
      categoryTotals,
      expenses
    };
  }
};

// src/controllers/ExpenseController.ts
init_serverAuth();
var ExpenseController = class _ExpenseController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAll(req, res, next) {
    try {
      const caller = _ExpenseController.extractCaller(req);
      const items = await ExpenseService.getAllExpenses(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async create(req, res, next) {
    try {
      const caller = _ExpenseController.extractCaller(req);
      const expense = await ExpenseService.createExpense(req.body, caller);
      return res.status(200).json({ success: true, message: "\u0633\u0646\u062F \u0647\u0632\u06CC\u0646\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.", expense });
    } catch (error) {
      next(error);
    }
  }
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _ExpenseController.extractCaller(req);
      await ExpenseService.deleteExpense(id, caller);
      return res.status(200).json({ success: true, message: "\u0633\u0646\u062F \u0647\u0632\u06CC\u0646\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u06AF\u0631\u062F\u06CC\u062F." });
    } catch (error) {
      next(error);
    }
  }
  static async getReport(req, res, next) {
    try {
      const caller = _ExpenseController.extractCaller(req);
      const report = await ExpenseService.getExpenseReport(req.query, caller);
      return res.status(200).json({ success: true, ...report });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/expenseRoutes.ts
var router8 = (0, import_express8.Router)();
router8.get("/report", ExpenseController.getReport);
router8.get("/", ExpenseController.getAll);
router8.post("/", ExpenseController.create);
router8.delete("/:id", ExpenseController.delete);
var expenseRoutes_default = router8;

// src/routes/attendanceRoutes.ts
var import_express9 = require("express");

// src/services/AttendanceService.ts
var import_zod9 = require("zod");
init_serverDataApi();
init_serverAuth();
init_logger();
var StudentAttendanceSchema = import_zod9.z.object({
  studentId: import_zod9.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentName: import_zod9.z.string().min(1, "\u0646\u0627\u0645 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  nationalId: import_zod9.z.string().optional(),
  status: import_zod9.z.enum(["present", "absent", "late", "excused", "unspecified"]).default("unspecified"),
  note: import_zod9.z.string().optional(),
  lateMinutes: import_zod9.z.number().nonnegative().optional(),
  isExcused: import_zod9.z.boolean().optional(),
  excuseReason: import_zod9.z.string().optional(),
  hasEducationalWarning: import_zod9.z.boolean().optional()
});
var AttendanceSessionSchema = import_zod9.z.object({
  id: import_zod9.z.string().optional(),
  programId: import_zod9.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0628\u0631\u0646\u0627\u0645\u0647 \u06CC\u0627 \u062F\u0631\u0633 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  programTitle: import_zod9.z.string().min(1, "\u0639\u0646\u0648\u0627\u0646 \u0628\u0631\u0646\u0627\u0645\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  grade: import_zod9.z.string().optional(),
  date: import_zod9.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u0628\u0631\u06AF\u0632\u0627\u0631\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  dayOfWeek: import_zod9.z.string().min(1, "\u0631\u0648\u0632 \u0647\u0641\u062A\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  isCancelled: import_zod9.z.boolean().default(false),
  cancellationReason: import_zod9.z.string().optional(),
  hasSubstituteTeacher: import_zod9.z.boolean().optional(),
  substituteTeacherId: import_zod9.z.string().optional(),
  substituteTeacherName: import_zod9.z.string().optional(),
  substituteTeacherNotes: import_zod9.z.string().optional(),
  notes: import_zod9.z.string().optional(),
  students: import_zod9.z.array(StudentAttendanceSchema).default([])
});
var AttendanceService = class {
  /**
   * Record or update an attendance session log
   */
  static async recordAttendanceSession(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "attendance", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u062D\u0636\u0648\u0631 \u0648 \u063A\u06CC\u0627\u0628 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = AttendanceSessionSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062D\u0636\u0648\u0631 \u0648 \u063A\u06CC\u0627\u0628 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const sessionId = validData.id || `${validData.programId}_${validData.date.replace(/\//g, "-")}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const sessionRecord = {
      id: sessionId,
      programId: validData.programId,
      programTitle: validData.programTitle,
      grade: validData.grade,
      date: validData.date,
      dayOfWeek: validData.dayOfWeek,
      isCancelled: validData.isCancelled,
      cancellationReason: validData.cancellationReason,
      hasSubstituteTeacher: validData.hasSubstituteTeacher,
      substituteTeacherId: validData.substituteTeacherId,
      substituteTeacherName: validData.substituteTeacherName,
      substituteTeacherNotes: validData.substituteTeacherNotes,
      notes: validData.notes,
      recordedByUserId: callerUser?.userId || callerUser?.id,
      recordedByName: callerUser?.fullName || callerUser?.username || "system",
      recordedAt: nowIso,
      students: validData.students
    };
    await serverSaveDoc("attendance", sessionRecord, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "RECORD_ATTENDANCE_SESSION",
      entityType: "attendance_session",
      entityId: sessionId,
      description: `\u062B\u0628\u062A \u062C\u0644\u0633\u0647 \u062D\u0636\u0648\u0631 \u0648 \u063A\u06CC\u0627\u0628 \u062F\u0631\u0633 \xAB${sessionRecord.programTitle}\xBB \u0645\u0648\u0631\u062E ${sessionRecord.date} (\u062A\u0639\u062F\u0627\u062F \u0637\u0644\u0627\u0628: ${sessionRecord.students.length})`,
      newState: sessionRecord
    });
    logger.info(`[AttendanceService] Recorded session ${sessionId} for ${sessionRecord.programTitle}`);
    return sessionRecord;
  }
  /**
   * Fetch all attendance sessions
   */
  static async getAllSessions(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "attendance", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0633\u0648\u0627\u0628\u0642 \u062D\u0636\u0648\u0631 \u0648 \u063A\u06CC\u0627\u0628 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("attendance", callerUser);
    return Array.isArray(items) ? items : [];
  }
  /**
   * Fetch attendance sessions for a specific program
   */
  static async getAttendanceByProgram(programId, callerUser) {
    const sessions = await this.getAllSessions(callerUser);
    return sessions.filter((s) => s.programId === programId);
  }
  /**
   * Fetch attendance history for a single student across all sessions
   */
  static async getAttendanceByStudent(studentId, callerUser) {
    const sessions = await this.getAllSessions(callerUser);
    const studentHistory = [];
    sessions.forEach((session) => {
      const studentRecord = session.students?.find((st) => st.studentId === studentId);
      if (studentRecord) {
        studentHistory.push({
          sessionId: session.id,
          programId: session.programId,
          programTitle: session.programTitle,
          date: session.date,
          dayOfWeek: session.dayOfWeek,
          status: studentRecord.status,
          note: studentRecord.note,
          lateMinutes: studentRecord.lateMinutes,
          isExcused: studentRecord.isExcused,
          excuseReason: studentRecord.excuseReason,
          hasEducationalWarning: studentRecord.hasEducationalWarning
        });
      }
    });
    const totalSessions = studentHistory.length;
    const presentCount = studentHistory.filter((h) => h.status === "present").length;
    const absentCount = studentHistory.filter((h) => h.status === "absent" && !h.isExcused).length;
    const excusedCount = studentHistory.filter((h) => h.status === "excused" || h.status === "absent" && h.isExcused).length;
    const lateCount = studentHistory.filter((h) => h.status === "late").length;
    return {
      studentId,
      totalSessions,
      presentCount,
      absentCount,
      excusedCount,
      lateCount,
      attendanceRate: totalSessions > 0 ? Math.round(presentCount / totalSessions * 100) : 100,
      history: studentHistory
    };
  }
  /**
   * Justify / Excuse a student absence
   */
  static async justifyAbsence(sessionId, studentId, reason, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "attendance", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u0645\u0648\u062C\u0647\u200C\u0633\u0627\u0632\u06CC \u063A\u06CC\u0628\u062A \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const sessions = await this.getAllSessions(callerUser);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new AppError("\u062C\u0644\u0633\u0647 \u062D\u0636\u0648\u0631 \u0648 \u063A\u06CC\u0627\u0628 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.", { statusCode: 404 });
    }
    const studentRecord = session.students?.find((st) => st.studentId === studentId);
    if (!studentRecord) {
      throw new AppError("\u0637\u0644\u0628\u0647 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u062F\u0631 \u0627\u06CC\u0646 \u062C\u0644\u0633\u0647 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.", { statusCode: 404 });
    }
    studentRecord.status = "excused";
    studentRecord.isExcused = true;
    studentRecord.excuseReason = reason;
    await serverSaveDoc("attendance", session, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "JUSTIFY_ABSENCE",
      entityType: "attendance_record",
      entityId: `${sessionId}_${studentId}`,
      description: `\u0645\u0648\u062C\u0647\u200C\u0633\u0627\u0632\u06CC \u063A\u06CC\u0628\u062A \u0637\u0644\u0628\u0647 ${studentRecord.studentName} \u062F\u0631 \u062C\u0644\u0633\u0647 ${session.programTitle} (${session.date}). \u0639\u0644\u062A: ${reason}`
    });
    return session;
  }
  /**
   * Aggregate attendance statistics across school, program, or grade
   */
  static async getAttendanceStats(filters, callerUser) {
    let sessions = await this.getAllSessions(callerUser);
    if (filters?.grade) {
      sessions = sessions.filter((s) => s.grade === filters.grade);
    }
    if (filters?.programId) {
      sessions = sessions.filter((s) => s.programId === filters.programId);
    }
    let totalAttendanceMarks = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalExcused = 0;
    let totalLate = 0;
    let totalWarnings = 0;
    sessions.forEach((s) => {
      s.students?.forEach((st) => {
        totalAttendanceMarks++;
        if (st.status === "present") totalPresent++;
        else if (st.status === "absent" && !st.isExcused) totalAbsent++;
        else if (st.status === "excused" || st.status === "absent" && st.isExcused) totalExcused++;
        else if (st.status === "late") totalLate++;
        if (st.hasEducationalWarning) totalWarnings++;
      });
    });
    return {
      totalSessions: sessions.length,
      totalAttendanceMarks,
      totalPresent,
      totalAbsent,
      totalExcused,
      totalLate,
      totalWarnings,
      overallPresencePercentage: totalAttendanceMarks > 0 ? Math.round((totalPresent + totalLate) / totalAttendanceMarks * 100) : 100
    };
  }
};

// src/controllers/AttendanceController.ts
init_serverAuth();
var AttendanceController = class _AttendanceController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async recordSession(req, res, next) {
    try {
      const caller = _AttendanceController.extractCaller(req);
      const session = await AttendanceService.recordAttendanceSession(req.body, caller);
      return res.status(200).json({ success: true, message: "\u062C\u0644\u0633\u0647 \u062D\u0636\u0648\u0631 \u0648 \u063A\u06CC\u0627\u0628 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.", session });
    } catch (error) {
      next(error);
    }
  }
  static async getAll(req, res, next) {
    try {
      const caller = _AttendanceController.extractCaller(req);
      const sessions = await AttendanceService.getAllSessions(caller);
      return res.status(200).json({ success: true, count: sessions.length, sessions });
    } catch (error) {
      next(error);
    }
  }
  static async getByProgram(req, res, next) {
    try {
      const { programId } = req.params;
      const caller = _AttendanceController.extractCaller(req);
      const sessions = await AttendanceService.getAttendanceByProgram(programId, caller);
      return res.status(200).json({ success: true, count: sessions.length, sessions });
    } catch (error) {
      next(error);
    }
  }
  static async getByStudent(req, res, next) {
    try {
      const { studentId } = req.params;
      const caller = _AttendanceController.extractCaller(req);
      const data = await AttendanceService.getAttendanceByStudent(studentId, caller);
      return res.status(200).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }
  static async justifyAbsence(req, res, next) {
    try {
      const { sessionId, studentId, reason } = req.body;
      const caller = _AttendanceController.extractCaller(req);
      const session = await AttendanceService.justifyAbsence(sessionId, studentId, reason || "\u0645\u0648\u062C\u0647 \u0634\u062F", caller);
      return res.status(200).json({ success: true, message: "\u063A\u06CC\u0628\u062A \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0645\u0648\u062C\u0647 \u062B\u0628\u062A \u0634\u062F.", session });
    } catch (error) {
      next(error);
    }
  }
  static async getStats(req, res, next) {
    try {
      const caller = _AttendanceController.extractCaller(req);
      const grade = req.query.grade;
      const programId = req.query.programId;
      const stats = await AttendanceService.getAttendanceStats({ grade, programId }, caller);
      return res.status(200).json({ success: true, stats });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/attendanceRoutes.ts
var router9 = (0, import_express9.Router)();
router9.post("/session", AttendanceController.recordSession);
router9.post("/justify", AttendanceController.justifyAbsence);
router9.get("/stats", AttendanceController.getStats);
router9.get("/program/:programId", AttendanceController.getByProgram);
router9.get("/student/:studentId", AttendanceController.getByStudent);
router9.get("/", AttendanceController.getAll);
var attendanceRoutes_default = router9;

// src/routes/studyRoutes.ts
var import_express10 = require("express");

// src/services/StudyService.ts
var import_zod10 = require("zod");
init_serverDataApi();
init_serverAuth();
init_logger();
var StudyPeriodSchema = import_zod10.z.object({
  id: import_zod10.z.string().optional(),
  title: import_zod10.z.string().min(2, "\u0639\u0646\u0648\u0627\u0646 \u062F\u0648\u0631\u0647 \u0645\u0637\u0627\u0644\u0639\u0627\u062A\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  startDate: import_zod10.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u0634\u0631\u0648\u0639 \u062F\u0648\u0631\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  endDate: import_zod10.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u067E\u0627\u06CC\u0627\u0646 \u062F\u0648\u0631\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  mandatoryHours: import_zod10.z.number().positive("\u0633\u0627\u0639\u062A \u0645\u0648\u0638\u0641\u06CC \u0645\u0637\u0627\u0644\u0639\u0647 \u0628\u0627\u06CC\u062F \u06CC\u06A9 \u0639\u062F\u062F \u0645\u062B\u0628\u062A \u0628\u0627\u0634\u062F.").default(40),
  deadlineDate: import_zod10.z.string().optional(),
  isClosed: import_zod10.z.boolean().default(false),
  closedManually: import_zod10.z.boolean().optional(),
  targetGrades: import_zod10.z.array(import_zod10.z.string()).optional(),
  exemptGrades: import_zod10.z.array(import_zod10.z.string()).optional(),
  exemptStudentIds: import_zod10.z.array(import_zod10.z.string()).optional(),
  warningRule: import_zod10.z.enum(["none", "below_mandatory", "below_mandatory_and_avg"]).default("below_mandatory")
});
var StudyLogEntrySchema = import_zod10.z.object({
  id: import_zod10.z.string().optional(),
  periodId: import_zod10.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u062F\u0648\u0631\u0647 \u0645\u0637\u0627\u0644\u0639\u0627\u062A\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentId: import_zod10.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  hours: import_zod10.z.number().nonnegative("\u0633\u0627\u0639\u062A \u0645\u0637\u0627\u0644\u0639\u0647 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u0646\u0641\u06CC \u0628\u0627\u0634\u062F."),
  studyHours: import_zod10.z.number().nonnegative().optional(),
  discussionHours: import_zod10.z.number().nonnegative().optional(),
  isExempt: import_zod10.z.boolean().optional(),
  exemptionReason: import_zod10.z.string().optional()
});
var StudyService = class {
  /**
   * Fetch all study periods
   */
  static async getAllStudyPeriods(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "study_periods", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u062F\u0648\u0631\u0647\u200C\u0647\u0627\u06CC \u0645\u0637\u0627\u0644\u0639\u0627\u062A\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("study_periods", callerUser);
    return Array.isArray(items) ? items : [];
  }
  /**
   * Fetch single study period by ID
   */
  static async getStudyPeriodById(id, callerUser) {
    const periods = await this.getAllStudyPeriods(callerUser);
    const period = periods.find((p) => p.id === id);
    if (!period) {
      throw new AppError("\u062F\u0648\u0631\u0647 \u0645\u0637\u0627\u0644\u0639\u0627\u062A\u06CC \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.", { statusCode: 404 });
    }
    return period;
  }
  /**
   * Create or update a study period
   */
  static async saveStudyPeriod(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "study_periods", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062A\u0639\u0631\u06CC\u0641 \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062F\u0648\u0631\u0647 \u0645\u0637\u0627\u0644\u0639\u0627\u062A\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = StudyPeriodSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `period_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const periodRecord = {
      id,
      title: validData.title.trim(),
      startDate: validData.startDate,
      endDate: validData.endDate,
      mandatoryHours: validData.mandatoryHours,
      deadlineDate: validData.deadlineDate,
      isClosed: validData.isClosed,
      closedManually: validData.closedManually,
      targetGrades: validData.targetGrades || [],
      exemptGrades: validData.exemptGrades || [],
      exemptStudentIds: validData.exemptStudentIds || [],
      warningRule: validData.warningRule,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    await serverSaveDoc("study_periods", periodRecord, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: validData.id ? "UPDATE_STUDY_PERIOD" : "CREATE_STUDY_PERIOD",
      entityType: "study_period",
      entityId: id,
      description: `\u062B\u0628\u062A \u062F\u0648\u0631\u0647 \u0645\u0637\u0627\u0644\u0639\u0627\u062A\u06CC: ${periodRecord.title} (\u0633\u0627\u0639\u062A \u0645\u0648\u0638\u0641\u06CC: ${periodRecord.mandatoryHours})`,
      newState: periodRecord
    });
    logger.info(`[StudyService] Saved study period ${id} (${periodRecord.title})`);
    return periodRecord;
  }
  /**
   * Log study and discussion hours for a student in a period
   */
  static async logStudyHours(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "periodic_study_logs", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u0633\u0627\u0639\u062A \u0645\u0637\u0627\u0644\u0639\u0647 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = StudyLogEntrySchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const valid = parsed.data;
    const id = valid.id || `log_${valid.periodId}_${valid.studentId}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const logRecord = {
      id,
      periodId: valid.periodId,
      studentId: valid.studentId,
      hours: valid.hours,
      studyHours: valid.studyHours || valid.hours,
      discussionHours: valid.discussionHours || 0,
      isExempt: valid.isExempt,
      exemptionReason: valid.exemptionReason,
      submittedBy: callerUser?.role === "student" ? "student" : "officer",
      lastModifiedAt: nowIso
    };
    await serverSaveDoc("periodic_study_logs", logRecord, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "LOG_STUDY_HOURS",
      entityType: "study_log",
      entityId: id,
      description: `\u062B\u0628\u062A \u0633\u0627\u0639\u062A \u0645\u0637\u0627\u0644\u0639\u0647 (${logRecord.hours} \u0633\u0627\u0639\u062A) \u0628\u0631\u0627\u06CC \u0637\u0644\u0628\u0647: ${logRecord.studentId}`
    });
    return logRecord;
  }
  /**
   * Fetch study stats and evaluation for a specific student in a period
   */
  static async getStudentStudyStats(studentId, periodId, callerUser) {
    if (callerUser && (callerUser.role === "student" || callerUser.level === 3)) {
      const uStudentId = String(callerUser.studentId || callerUser.linkedStudentId || callerUser.id || "").trim();
      if (uStudentId && studentId !== uStudentId) {
        throw new AppError("\u0634\u0645\u0627 \u062A\u0646\u0647\u0627 \u0645\u062C\u0627\u0632 \u0628\u0647 \u0645\u0634\u0627\u0647\u062F\u0647 \u0622\u0645\u0627\u0631 \u0645\u0637\u0627\u0644\u0639\u0647 \u062E\u0648\u062F \u0647\u0633\u062A\u06CC\u062F.", { statusCode: 403 });
      }
    }
    const period = await this.getStudyPeriodById(periodId, callerUser);
    const candidateIds = [
      `log_${periodId}_${studentId}`,
      `studylog_${periodId}_${studentId}`
    ];
    let studentLog = await serverGetDocByCandidateIds("periodic_study_logs", candidateIds, callerUser);
    if (studentLog && (studentLog.periodId !== periodId || studentLog.studentId !== studentId)) {
      studentLog = null;
    }
    const loggedHours = studentLog?.hours || 0;
    const studyHours = studentLog?.studyHours || loggedHours;
    const discussionHours = studentLog?.discussionHours || 0;
    const mandatory = period.mandatoryHours || 40;
    const diffHours = loggedHours - mandatory;
    const isBelowMandatory = diffHours < 0;
    return {
      studentId,
      periodId,
      periodTitle: period.title,
      mandatoryHours: mandatory,
      loggedHours,
      studyHours,
      discussionHours,
      diffHours,
      status: isBelowMandatory ? "shortage" : "surplus",
      hasWarning: isBelowMandatory && period.warningRule !== "none",
      isExempt: Boolean(studentLog?.isExempt)
    };
  }
  /**
   * Generate leaderboard ranked by total study and discussion hours
   */
  static async getStudyLeaderboard(periodId, grade, callerUser) {
    const period = await this.getStudyPeriodById(periodId, callerUser);
    const allLogs = await serverQueryCollection("periodic_study_logs", callerUser);
    const allStudents = await serverQueryCollection("students", callerUser);
    const logsInPeriod = Array.isArray(allLogs) ? allLogs.filter((l) => l.periodId === periodId) : [];
    const studentsList = Array.isArray(allStudents) ? allStudents : [];
    const ranked = logsInPeriod.map((log) => {
      const student = studentsList.find((s) => s.id === log.studentId);
      return {
        studentId: log.studentId,
        studentName: student?.name || student?.fullName || log.studentId,
        grade: student?.grade || "\u0639\u0645\u0648\u0645\u06CC",
        totalHours: Number(log.hours || 0),
        studyHours: Number(log.studyHours || log.hours || 0),
        discussionHours: Number(log.discussionHours || 0)
      };
    }).filter((item) => !grade || item.grade === grade).sort((a, b) => b.totalHours - a.totalHours).map((item, index) => ({
      rank: index + 1,
      ...item
    }));
    return {
      periodId,
      periodTitle: period.title,
      grade: grade || "all",
      totalParticipants: ranked.length,
      leaderboard: ranked
    };
  }
};

// src/controllers/StudyController.ts
init_serverAuth();
var StudyController = class _StudyController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAllPeriods(req, res, next) {
    try {
      const caller = _StudyController.extractCaller(req);
      const periods = await StudyService.getAllStudyPeriods(caller);
      return res.status(200).json({ success: true, count: periods.length, periods });
    } catch (error) {
      next(error);
    }
  }
  static async getPeriodById(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _StudyController.extractCaller(req);
      const period = await StudyService.getStudyPeriodById(id, caller);
      return res.status(200).json({ success: true, period });
    } catch (error) {
      next(error);
    }
  }
  static async savePeriod(req, res, next) {
    try {
      const caller = _StudyController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const period = await StudyService.saveStudyPeriod(payload, caller);
      return res.status(200).json({ success: true, message: "\u062F\u0648\u0631\u0647 \u0645\u0637\u0627\u0644\u0639\u0627\u062A\u06CC \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", period });
    } catch (error) {
      next(error);
    }
  }
  static async logHours(req, res, next) {
    try {
      const caller = _StudyController.extractCaller(req);
      const log = await StudyService.logStudyHours(req.body, caller);
      return res.status(200).json({ success: true, message: "\u0633\u0627\u0639\u062A \u0645\u0637\u0627\u0644\u0639\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.", log });
    } catch (error) {
      next(error);
    }
  }
  static async getStudentStats(req, res, next) {
    try {
      const { studentId } = req.params;
      const periodId = req.query.periodId;
      const caller = _StudyController.extractCaller(req);
      const stats = await StudyService.getStudentStudyStats(studentId, periodId, caller);
      return res.status(200).json({ success: true, stats });
    } catch (error) {
      next(error);
    }
  }
  static async getLeaderboard(req, res, next) {
    try {
      const periodId = req.query.periodId;
      const grade = req.query.grade;
      const caller = _StudyController.extractCaller(req);
      const result = await StudyService.getStudyLeaderboard(periodId, grade, caller);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/studyRoutes.ts
var router10 = (0, import_express10.Router)();
router10.get("/periods", StudyController.getAllPeriods);
router10.get("/periods/:id", StudyController.getPeriodById);
router10.post("/periods", StudyController.savePeriod);
router10.put("/periods/:id", StudyController.savePeriod);
router10.post("/log", StudyController.logHours);
router10.get("/stats/student/:studentId", StudyController.getStudentStats);
router10.get("/leaderboard", StudyController.getLeaderboard);
var studyRoutes_default = router10;

// src/routes/researchRoutes.ts
var import_express11 = require("express");

// src/services/ResearchService.ts
var import_zod11 = require("zod");
init_serverDataApi();
init_serverAuth();
init_logger();
var ArticleInputSchema = import_zod11.z.object({
  id: import_zod11.z.string().optional(),
  studentId: import_zod11.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentName: import_zod11.z.string().min(1, "\u0646\u0627\u0645 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentGrade: import_zod11.z.string().optional(),
  title: import_zod11.z.string().min(2, "\u0639\u0646\u0648\u0627\u0646 \u0645\u0642\u0627\u0644\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  summary: import_zod11.z.string().optional(),
  type: import_zod11.z.enum(["individual", "group"]).default("individual"),
  deliveryYear: import_zod11.z.string().optional(),
  pageCount: import_zod11.z.union([import_zod11.z.number(), import_zod11.z.string()]).optional(),
  evaluationScores: import_zod11.z.string().optional(),
  evaluatorComments: import_zod11.z.string().optional(),
  isCompleted: import_zod11.z.boolean().optional()
});
var EvaluationSessionInputSchema = import_zod11.z.object({
  id: import_zod11.z.string().optional(),
  articleId: import_zod11.z.string().optional(),
  title: import_zod11.z.string().min(2, "\u0639\u0646\u0648\u0627\u0646 \u062C\u0644\u0633\u0647 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  presenterStudentId: import_zod11.z.string().optional(),
  presenterName: import_zod11.z.string().min(1, "\u0646\u0627\u0645 \u0627\u0631\u0627\u0626\u0647\u200C\u062F\u0647\u0646\u062F\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentGrade: import_zod11.z.string().optional(),
  refereeCount: import_zod11.z.number().nonnegative().default(1),
  criticCount: import_zod11.z.number().nonnegative().default(1),
  allowedRoleRegistration: import_zod11.z.enum(["critic", "referee", "both"]).default("both"),
  hasAbstract: import_zod11.z.boolean().default(false),
  abstractText: import_zod11.z.string().optional(),
  hasDownloadLink: import_zod11.z.boolean().default(false),
  downloadUrl: import_zod11.z.string().optional(),
  status: import_zod11.z.enum(["active", "completed", "archived"]).default("active")
});
var ResearchService = class {
  /**
   * Fetch all received articles
   */
  static async getAllArticles(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "received_articles", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0628\u062E\u0634 \u067E\u0698\u0648\u0647\u0634 \u0648 \u0645\u0642\u0627\u0644\u0627\u062A \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("received_articles", callerUser);
    return Array.isArray(items) ? items : [];
  }
  /**
   * Fetch articles for a specific student
   */
  static async getArticlesByStudent(studentId, callerUser) {
    const articles = await this.getAllArticles(callerUser);
    return articles.filter((a) => a.studentId === studentId);
  }
  /**
   * Save / Submit an article
   */
  static async saveArticle(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "received_articles", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u0645\u0642\u0627\u0644\u0647 \u067E\u0698\u0648\u0647\u0634\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = ArticleInputSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0645\u0642\u0627\u0644\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const articleRecord = {
      id,
      studentId: validData.studentId,
      studentName: validData.studentName.trim(),
      studentGrade: validData.studentGrade?.trim(),
      title: validData.title.trim(),
      summary: validData.summary?.trim(),
      type: validData.type,
      deliveryYear: validData.deliveryYear,
      pageCount: validData.pageCount,
      evaluationScores: validData.evaluationScores,
      evaluatorComments: validData.evaluatorComments,
      isCompleted: Boolean(validData.isCompleted),
      createdAt: rawData?.createdAt || nowIso,
      updatedAt: nowIso
    };
    await serverSaveDoc("received_articles", articleRecord, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: validData.id ? "UPDATE_ARTICLE" : "CREATE_ARTICLE",
      entityType: "article",
      entityId: id,
      description: `\u062B\u0628\u062A \u0645\u0642\u0627\u0644\u0647 \u067E\u0698\u0648\u0647\u0634\u06CC: \xAB${articleRecord.title}\xBB \u0627\u062B\u0631 \u0637\u0644\u0628\u0647: ${articleRecord.studentName}`,
      newState: articleRecord
    });
    logger.info(`[ResearchService] Saved article ${id} (${articleRecord.title})`);
    return articleRecord;
  }
  /**
   * Delete an article
   */
  static async deleteArticle(id, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "received_articles", "delete");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062D\u0630\u0641 \u0645\u0642\u0627\u0644\u0647 \u067E\u0698\u0648\u0647\u0634\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    await serverDeleteDoc("received_articles", id, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "DELETE_ARTICLE",
      entityType: "article",
      entityId: id,
      description: `\u062D\u0630\u0641 \u0645\u0642\u0627\u0644\u0647 \u067E\u0698\u0648\u0647\u0634\u06CC \u0628\u0627 \u0634\u0646\u0627\u0633\u0647 ${id}`
    });
    return true;
  }
  /**
   * Fetch all evaluation sessions
   */
  static async getAllEvaluationSessions(callerUser) {
    const items = await serverQueryCollection("article_evaluation_sessions", callerUser);
    return Array.isArray(items) ? items : [];
  }
  /**
   * Save an evaluation session
   */
  static async saveEvaluationSession(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "article_evaluation_sessions", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062A\u0639\u0631\u06CC\u0641 \u062C\u0644\u0633\u0647 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = EvaluationSessionInputSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062C\u0644\u0633\u0647 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `eval_sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const sessionRecord = {
      id,
      articleId: validData.articleId,
      title: validData.title.trim(),
      presenterStudentId: validData.presenterStudentId,
      presenterName: validData.presenterName.trim(),
      studentGrade: validData.studentGrade?.trim(),
      refereeCount: validData.refereeCount,
      criticCount: validData.criticCount,
      allowedRoleRegistration: validData.allowedRoleRegistration,
      hasAbstract: validData.hasAbstract,
      abstractText: validData.abstractText,
      hasDownloadLink: validData.hasDownloadLink,
      downloadUrl: validData.downloadUrl,
      status: validData.status,
      approvedCriticStudentIds: rawData?.approvedCriticStudentIds || [],
      approvedRefereeStudentIds: rawData?.approvedRefereeStudentIds || [],
      createdAt: rawData?.createdAt || nowIso
    };
    await serverSaveDoc("article_evaluation_sessions", sessionRecord, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: validData.id ? "UPDATE_EVALUATION_SESSION" : "CREATE_EVALUATION_SESSION",
      entityType: "evaluation_session",
      entityId: id,
      description: `\u062B\u0628\u062A \u06A9\u0631\u0633\u06CC \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0645\u0642\u0627\u0644\u0647: \xAB${sessionRecord.title}\xBB \u0628\u0627 \u0627\u0631\u0627\u0626\u0647 ${sessionRecord.presenterName}`,
      newState: sessionRecord
    });
    return sessionRecord;
  }
  /**
   * Register role (critic or referee) for a student in an evaluation session
   */
  static async registerRoleForSession(sessionId, studentId, role, callerUser) {
    const sessions = await this.getAllEvaluationSessions(callerUser);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new AppError("\u062C\u0644\u0633\u0647 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.", { statusCode: 404 });
    }
    if (role === "critic") {
      const list = session.approvedCriticStudentIds || [];
      if (!list.includes(studentId)) list.push(studentId);
      session.approvedCriticStudentIds = list;
    } else {
      const list = session.approvedRefereeStudentIds || [];
      if (!list.includes(studentId)) list.push(studentId);
      session.approvedRefereeStudentIds = list;
    }
    await serverSaveDoc("article_evaluation_sessions", session, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "REGISTER_SESSION_ROLE",
      entityType: "evaluation_session",
      entityId: sessionId,
      description: `\u062B\u0628\u062A\u200C\u0646\u0627\u0645 \u0637\u0644\u0628\u0647 ${studentId} \u0628\u0647 \u0639\u0646\u0648\u0627\u0646 ${role === "critic" ? "\u0646\u0627\u0642\u062F" : "\u062F\u0627\u0648\u0631"} \u062F\u0631 \u062C\u0644\u0633\u0647: ${session.title}`
    });
    return session;
  }
};

// src/controllers/ResearchController.ts
init_serverAuth();
var ResearchController = class _ResearchController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAllArticles(req, res, next) {
    try {
      const caller = _ResearchController.extractCaller(req);
      const items = await ResearchService.getAllArticles(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getArticlesByStudent(req, res, next) {
    try {
      const { studentId } = req.params;
      const caller = _ResearchController.extractCaller(req);
      const items = await ResearchService.getArticlesByStudent(studentId, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async saveArticle(req, res, next) {
    try {
      const caller = _ResearchController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const article = await ResearchService.saveArticle(payload, caller);
      return res.status(200).json({ success: true, message: "\u0645\u0642\u0627\u0644\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", article });
    } catch (error) {
      next(error);
    }
  }
  static async deleteArticle(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _ResearchController.extractCaller(req);
      await ResearchService.deleteArticle(id, caller);
      return res.status(200).json({ success: true, message: "\u0645\u0642\u0627\u0644\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u06AF\u0631\u062F\u06CC\u062F." });
    } catch (error) {
      next(error);
    }
  }
  static async getAllSessions(req, res, next) {
    try {
      const caller = _ResearchController.extractCaller(req);
      const sessions = await ResearchService.getAllEvaluationSessions(caller);
      return res.status(200).json({ success: true, count: sessions.length, sessions });
    } catch (error) {
      next(error);
    }
  }
  static async saveSession(req, res, next) {
    try {
      const caller = _ResearchController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const session = await ResearchService.saveEvaluationSession(payload, caller);
      return res.status(200).json({ success: true, message: "\u062C\u0644\u0633\u0647 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.", session });
    } catch (error) {
      next(error);
    }
  }
  static async registerRole(req, res, next) {
    try {
      const { id } = req.params;
      const { studentId, role } = req.body;
      const caller = _ResearchController.extractCaller(req);
      const updated = await ResearchService.registerRoleForSession(id, studentId, role, caller);
      return res.status(200).json({ success: true, message: "\u062B\u0628\u062A\u200C\u0646\u0627\u0645 \u0646\u0642\u0634 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0646\u062C\u0627\u0645 \u0634\u062F.", session: updated });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/researchRoutes.ts
var router11 = (0, import_express11.Router)();
router11.get("/articles/student/:studentId", ResearchController.getArticlesByStudent);
router11.get("/articles", ResearchController.getAllArticles);
router11.post("/articles", ResearchController.saveArticle);
router11.delete("/articles/:id", ResearchController.deleteArticle);
router11.get("/sessions", ResearchController.getAllSessions);
router11.post("/sessions", ResearchController.saveSession);
router11.post("/sessions/:id/register-role", ResearchController.registerRole);
var researchRoutes_default = router11;

// src/routes/oralExamRoutes.ts
var import_express12 = require("express");

// src/services/OralExamService.ts
var import_zod12 = require("zod");
init_serverDataApi();
init_serverAuth();
var OralExamPeriodSchema = import_zod12.z.object({
  id: import_zod12.z.string().optional(),
  title: import_zod12.z.string().min(2, "\u0639\u0646\u0648\u0627\u0646 \u062F\u0648\u0631\u0647 \u0622\u0632\u0645\u0648\u0646 \u0634\u0641\u0627\u0647\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  academicYear: import_zod12.z.string().optional(),
  grade: import_zod12.z.string().min(1, "\u067E\u0627\u06CC\u0647 \u062A\u062D\u0635\u06CC\u0644\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  hasUsul: import_zod12.z.boolean().default(true),
  usulBooks: import_zod12.z.array(import_zod12.z.string()).default([]),
  hasFiqh: import_zod12.z.boolean().default(true),
  fiqhBooks: import_zod12.z.array(import_zod12.z.string()).default([]),
  examDates: import_zod12.z.array(import_zod12.z.string()).optional(),
  examinerTeacherIds: import_zod12.z.array(import_zod12.z.string()).default([]),
  examinerTeacherNames: import_zod12.z.array(import_zod12.z.string()).default([]),
  status: import_zod12.z.enum(["draft", "scheduled", "conducting", "finalized", "archived"]).default("draft"),
  notes: import_zod12.z.string().optional()
});
var StudentExamRecordSchema = import_zod12.z.object({
  id: import_zod12.z.string().optional(),
  periodId: import_zod12.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u062F\u0648\u0631\u0647 \u0622\u0632\u0645\u0648\u0646 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentId: import_zod12.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentName: import_zod12.z.string().min(1, "\u0646\u0627\u0645 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  grade: import_zod12.z.string().optional(),
  nationalId: import_zod12.z.string().optional(),
  phone: import_zod12.z.string().optional(),
  examTime: import_zod12.z.string().optional(),
  // Fiqh
  fiqhExaminerTeacherName: import_zod12.z.string().optional(),
  fiqhBookTitle: import_zod12.z.string().optional(),
  fiqhScore: import_zod12.z.number().nullable().optional(),
  fiqhTextMastery: import_zod12.z.number().optional(),
  fiqhExplanationMastery: import_zod12.z.number().optional(),
  fiqhExaminerNotes: import_zod12.z.string().optional(),
  fiqhIsRetake: import_zod12.z.boolean().optional(),
  // Usul
  usulExaminerTeacherName: import_zod12.z.string().optional(),
  usulBookTitle: import_zod12.z.string().optional(),
  usulScore: import_zod12.z.number().nullable().optional(),
  usulTextMastery: import_zod12.z.number().optional(),
  usulExplanationMastery: import_zod12.z.number().optional(),
  usulExaminerNotes: import_zod12.z.string().optional(),
  usulIsRetake: import_zod12.z.boolean().optional(),
  overallStatus: import_zod12.z.enum(["passed", "failed", "retake", "absent", "pending"]).optional(),
  status: import_zod12.z.enum(["draft", "finalized"]).default("draft")
});
var OralExamService = class {
  /**
   * Fetch all oral exam periods
   */
  static async getAllPeriods(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "oral_exam_periods", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0622\u0632\u0645\u0648\u0646\u200C\u0647\u0627\u06CC \u0634\u0641\u0627\u0647\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("oral_exam_periods", callerUser);
    return Array.isArray(items) ? items : [];
  }
  /**
   * Fetch single oral exam period by ID
   */
  static async getPeriodById(id, callerUser) {
    const periods = await this.getAllPeriods(callerUser);
    const period = periods.find((p) => p.id === id);
    if (!period) {
      throw new AppError("\u062F\u0648\u0631\u0647 \u0622\u0632\u0645\u0648\u0646 \u0634\u0641\u0627\u0647\u06CC \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.", { statusCode: 404 });
    }
    return period;
  }
  /**
   * Save an oral exam period
   */
  static async savePeriod(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "oral_exam_periods", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062A\u0639\u0631\u06CC\u0641 \u062F\u0648\u0631\u0647 \u0622\u0632\u0645\u0648\u0646 \u0634\u0641\u0627\u0647\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = OralExamPeriodSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `oral_p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const periodRecord = {
      id,
      title: validData.title.trim(),
      academicYear: validData.academicYear,
      grade: validData.grade,
      hasUsul: validData.hasUsul,
      usulBooks: validData.usulBooks,
      hasFiqh: validData.hasFiqh,
      fiqhBooks: validData.fiqhBooks,
      examDates: validData.examDates || [],
      examinerTeacherIds: validData.examinerTeacherIds,
      examinerTeacherNames: validData.examinerTeacherNames,
      hasCustomScopes: false,
      scopes: [],
      participatingStudentIds: rawData?.participatingStudentIds || [],
      status: validData.status,
      notes: validData.notes,
      createdAt: rawData?.createdAt || nowIso
    };
    await serverSaveDoc("oral_exam_periods", periodRecord, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: validData.id ? "UPDATE_ORAL_EXAM_PERIOD" : "CREATE_ORAL_EXAM_PERIOD",
      entityType: "oral_exam_period",
      entityId: id,
      description: `\u062A\u0639\u0631\u06CC\u0641 \u062F\u0648\u0631\u0647 \u0622\u0632\u0645\u0648\u0646 \u0634\u0641\u0627\u0647\u06CC: ${periodRecord.title} (${periodRecord.grade})`,
      newState: periodRecord
    });
    return periodRecord;
  }
  /**
   * Fetch exam evaluation records for a period
   */
  static async getRecordsByPeriod(periodId, callerUser) {
    const items = await serverQueryCollection("oral_exam_student_records", callerUser);
    const records = Array.isArray(items) ? items : [];
    return records.filter((r) => r.periodId === periodId);
  }
  /**
   * Save student exam score record
   */
  static async saveStudentRecord(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "oral_exam_student_records", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u0646\u0645\u0631\u0627\u062A \u0622\u0632\u0645\u0648\u0646 \u0634\u0641\u0627\u0647\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = StudentExamRecordSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0646\u0645\u0631\u0627\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `${validData.periodId}_${validData.studentId}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      periodId: validData.periodId,
      studentId: validData.studentId,
      studentName: validData.studentName.trim(),
      grade: validData.grade,
      nationalId: validData.nationalId,
      phone: validData.phone,
      examTime: validData.examTime,
      fiqhExaminerTeacherName: validData.fiqhExaminerTeacherName,
      fiqhBookTitle: validData.fiqhBookTitle,
      fiqhScore: validData.fiqhScore,
      fiqhTextMastery: validData.fiqhTextMastery,
      fiqhExplanationMastery: validData.fiqhExplanationMastery,
      fiqhExaminerNotes: validData.fiqhExaminerNotes,
      fiqhIsRetake: validData.fiqhIsRetake,
      usulExaminerTeacherName: validData.usulExaminerTeacherName,
      usulBookTitle: validData.usulBookTitle,
      usulScore: validData.usulScore,
      usulTextMastery: validData.usulTextMastery,
      usulExplanationMastery: validData.usulExplanationMastery,
      usulExaminerNotes: validData.usulExaminerNotes,
      usulIsRetake: validData.usulIsRetake,
      overallStatus: validData.overallStatus || (validData.fiqhScore !== null && validData.fiqhScore !== void 0 && validData.fiqhScore < 12 || validData.usulScore !== null && validData.usulScore !== void 0 && validData.usulScore < 12 ? "retake" : "passed"),
      status: validData.status,
      updatedAt: nowIso
    };
    await serverSaveDoc("oral_exam_student_records", record, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "SAVE_ORAL_EXAM_SCORE",
      entityType: "oral_exam_record",
      entityId: id,
      description: `\u062B\u0628\u062A \u0646\u0645\u0631\u0627\u062A \u0622\u0632\u0645\u0648\u0646 \u0634\u0641\u0627\u0647\u06CC \u0637\u0644\u0628\u0647 ${record.studentName} (\u0641\u0642\u0647: ${record.fiqhScore ?? "-"}\u060C \u0627\u0635\u0648\u0644: ${record.usulScore ?? "-"})`
    });
    return record;
  }
  /**
   * Generate comprehensive oral exam report for a period
   */
  static async getExamReport(periodId, callerUser) {
    const period = await this.getPeriodById(periodId, callerUser);
    const records = await this.getRecordsByPeriod(periodId, callerUser);
    let passedCount = 0;
    let failedCount = 0;
    let retakeCount = 0;
    let totalFiqh = 0;
    let fiqhCount = 0;
    let totalUsul = 0;
    let usulCount = 0;
    records.forEach((r) => {
      if (r.overallStatus === "passed") passedCount++;
      else if (r.overallStatus === "failed") failedCount++;
      else if (r.overallStatus === "retake") retakeCount++;
      if (typeof r.fiqhScore === "number") {
        totalFiqh += r.fiqhScore;
        fiqhCount++;
      }
      if (typeof r.usulScore === "number") {
        totalUsul += r.usulScore;
        usulCount++;
      }
    });
    return {
      periodId,
      periodTitle: period.title,
      grade: period.grade,
      totalStudents: records.length,
      passedCount,
      failedCount,
      retakeCount,
      averageFiqhScore: fiqhCount > 0 ? Number((totalFiqh / fiqhCount).toFixed(2)) : null,
      averageUsulScore: usulCount > 0 ? Number((totalUsul / usulCount).toFixed(2)) : null,
      records
    };
  }
};

// src/controllers/OralExamController.ts
init_serverAuth();
var OralExamController = class _OralExamController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAllPeriods(req, res, next) {
    try {
      const caller = _OralExamController.extractCaller(req);
      const periods = await OralExamService.getAllPeriods(caller);
      return res.status(200).json({ success: true, count: periods.length, periods });
    } catch (error) {
      next(error);
    }
  }
  static async getPeriodById(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _OralExamController.extractCaller(req);
      const period = await OralExamService.getPeriodById(id, caller);
      return res.status(200).json({ success: true, period });
    } catch (error) {
      next(error);
    }
  }
  static async savePeriod(req, res, next) {
    try {
      const caller = _OralExamController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const period = await OralExamService.savePeriod(payload, caller);
      return res.status(200).json({ success: true, message: "\u062F\u0648\u0631\u0647 \u0622\u0632\u0645\u0648\u0646 \u0634\u0641\u0627\u0647\u06CC \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", period });
    } catch (error) {
      next(error);
    }
  }
  static async getRecordsByPeriod(req, res, next) {
    try {
      const { periodId } = req.params;
      const caller = _OralExamController.extractCaller(req);
      const records = await OralExamService.getRecordsByPeriod(periodId, caller);
      return res.status(200).json({ success: true, count: records.length, records });
    } catch (error) {
      next(error);
    }
  }
  static async saveStudentRecord(req, res, next) {
    try {
      const caller = _OralExamController.extractCaller(req);
      const record = await OralExamService.saveStudentRecord(req.body, caller);
      return res.status(200).json({ success: true, message: "\u0646\u0645\u0631\u0627\u062A \u0622\u0632\u0645\u0648\u0646 \u0634\u0641\u0627\u0647\u06CC \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.", record });
    } catch (error) {
      next(error);
    }
  }
  static async getReport(req, res, next) {
    try {
      const { periodId } = req.params;
      const caller = _OralExamController.extractCaller(req);
      const report = await OralExamService.getExamReport(periodId, caller);
      return res.status(200).json({ success: true, ...report });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/oralExamRoutes.ts
var router12 = (0, import_express12.Router)();
router12.get("/report/:periodId", OralExamController.getReport);
router12.get("/records", OralExamController.getRecordsByPeriod);
router12.post("/records", OralExamController.saveStudentRecord);
router12.get("/periods/:id", OralExamController.getPeriodById);
router12.get("/periods", OralExamController.getAllPeriods);
router12.post("/periods", OralExamController.savePeriod);
var oralExamRoutes_default = router12;

// src/routes/lockerRoutes.ts
var import_express13 = require("express");

// src/services/LockerService.ts
var import_zod13 = require("zod");
init_serverDataApi();
init_serverAuth();
var AssignLockerSchema = import_zod13.z.object({
  studentId: import_zod13.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentName: import_zod13.z.string().min(1, "\u0646\u0627\u0645 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentCode: import_zod13.z.string().optional(),
  grade: import_zod13.z.string().optional(),
  phoneNumber: import_zod13.z.string().optional()
});
var ReportDefectSchema = import_zod13.z.object({
  defectType: import_zod13.z.enum(["lost_key", "broken", "other"]).default("broken"),
  defectDescription: import_zod13.z.string().min(2, "\u0634\u0631\u062D \u0646\u0642\u0635 \u06CC\u0627 \u062E\u0631\u0627\u0628\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.")
});
var LockerService = class {
  /**
   * Fetch all lockers
   */
  static async getAllLockers(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "lockers", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0645\u062F\u06CC\u0631\u06CC\u062A \u06A9\u0645\u062F\u0647\u0627 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("lockers", callerUser);
    return Array.isArray(items) ? items : [];
  }
  /**
   * Fetch single locker by number
   */
  static async getLockerByNumber(lockerNumber, callerUser) {
    const lockers = await this.getAllLockers(callerUser);
    const locker = lockers.find((l) => l.lockerNumber === lockerNumber);
    if (!locker) {
      throw new AppError(`\u06A9\u0645\u062F \u0634\u0645\u0627\u0631\u0647 ${lockerNumber} \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.`, { statusCode: 404 });
    }
    return locker;
  }
  /**
   * Assign locker to a student
   */
  static async assignLocker(lockerNumber, assignData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "lockers", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062A\u062E\u0635\u06CC\u0635 \u06A9\u0645\u062F \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const locker = await this.getLockerByNumber(lockerNumber, callerUser);
    if (locker.status === "occupied") {
      throw new AppError(`\u06A9\u0645\u062F \u0634\u0645\u0627\u0631\u0647 ${lockerNumber} \u062F\u0631 \u062D\u0627\u0644 \u062D\u0627\u0636\u0631 \u062A\u0648\u0633\u0637 \u0637\u0644\u0628\u0647 \xAB${locker.studentName}\xBB \u0627\u0634\u063A\u0627\u0644 \u0627\u0633\u062A.`, { statusCode: 409 });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const updated = {
      ...locker,
      status: "occupied",
      studentId: assignData.studentId,
      studentName: assignData.studentName.trim(),
      studentCode: assignData.studentCode,
      grade: assignData.grade,
      phoneNumber: assignData.phoneNumber,
      assignedDate: (/* @__PURE__ */ new Date()).toLocaleDateString("fa-IR"),
      updatedAt: nowIso,
      updatedBy: callerUser?.username || "system"
    };
    await serverSaveDoc("lockers", updated, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "ASSIGN_LOCKER",
      entityType: "locker",
      entityId: String(lockerNumber),
      description: `\u0648\u0627\u06AF\u0630\u0627\u0631\u06CC \u06A9\u0645\u062F \u0634\u0645\u0627\u0631\u0647 ${lockerNumber} \u0628\u0647 \u0637\u0644\u0628\u0647: ${assignData.studentName}`
    });
    return updated;
  }
  /**
   * Vacate / Release a locker
   */
  static async vacateLocker(lockerNumber, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "lockers", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062A\u062D\u0648\u06CC\u0644 \u06CC\u0627 \u062A\u062E\u0644\u06CC\u0647 \u06A9\u0645\u062F \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const locker = await this.getLockerByNumber(lockerNumber, callerUser);
    const previousStudent = locker.studentName || "\u0646\u0627\u0645\u0634\u062E\u0635";
    const updated = {
      ...locker,
      status: "vacant",
      studentId: void 0,
      studentName: void 0,
      studentCode: void 0,
      grade: void 0,
      phoneNumber: void 0,
      assignedDate: void 0,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy: callerUser?.username || "system"
    };
    await serverSaveDoc("lockers", updated, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "VACATE_LOCKER",
      entityType: "locker",
      entityId: String(lockerNumber),
      description: `\u062A\u062E\u0644\u06CC\u0647 \u0648 \u062A\u062D\u0648\u06CC\u0644 \u06A9\u0645\u062F \u0634\u0645\u0627\u0631\u0647 ${lockerNumber} (\u0637\u0644\u0628\u0647 \u0642\u0628\u0644\u06CC: ${previousStudent})`
    });
    return updated;
  }
  /**
   * Report a defect or broken key for a locker
   */
  static async reportDefect(lockerNumber, defectType, description, callerUser) {
    const locker = await this.getLockerByNumber(lockerNumber, callerUser);
    const updated = {
      ...locker,
      status: "defective",
      defectType,
      defectDescription: description,
      reportedAt: (/* @__PURE__ */ new Date()).toLocaleDateString("fa-IR"),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy: callerUser?.username || "system"
    };
    await serverSaveDoc("lockers", updated, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "REPORT_LOCKER_DEFECT",
      entityType: "locker",
      entityId: String(lockerNumber),
      description: `\u06AF\u0632\u0627\u0631\u0634 \u062E\u0631\u0627\u0628\u06CC \u06A9\u0645\u062F \u0634\u0645\u0627\u0631\u0647 ${lockerNumber} (${defectType}): ${description}`
    });
    return updated;
  }
  /**
   * Resolve defect and set locker back to vacant (or occupied)
   */
  static async resolveDefect(lockerNumber, repairNotes, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "lockers", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u0631\u0641\u0639 \u0646\u0642\u0635 \u06A9\u0645\u062F \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const locker = await this.getLockerByNumber(lockerNumber, callerUser);
    const updated = {
      ...locker,
      status: locker.studentId ? "occupied" : "vacant",
      defectType: void 0,
      defectDescription: void 0,
      repairNotes: repairNotes || "\u062A\u0639\u0645\u06CC\u0631 \u06CC\u0627 \u062A\u0639\u0648\u06CC\u0636 \u0642\u0641\u0644 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F.",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy: callerUser?.username || "system"
    };
    await serverSaveDoc("lockers", updated, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "RESOLVE_LOCKER_DEFECT",
      entityType: "locker",
      entityId: String(lockerNumber),
      description: `\u0631\u0641\u0639 \u0646\u0642\u0635 \u0648 \u062A\u0639\u0645\u06CC\u0631 \u06A9\u0645\u062F \u0634\u0645\u0627\u0631\u0647 ${lockerNumber}`
    });
    return updated;
  }
};

// src/controllers/LockerController.ts
init_serverAuth();
var LockerController = class _LockerController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAll(req, res, next) {
    try {
      const caller = _LockerController.extractCaller(req);
      const items = await LockerService.getAllLockers(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getByNumber(req, res, next) {
    try {
      const num = parseInt(req.params.number, 10);
      const caller = _LockerController.extractCaller(req);
      const locker = await LockerService.getLockerByNumber(num, caller);
      return res.status(200).json({ success: true, locker });
    } catch (error) {
      next(error);
    }
  }
  static async assign(req, res, next) {
    try {
      const num = parseInt(req.params.number, 10);
      const caller = _LockerController.extractCaller(req);
      const updated = await LockerService.assignLocker(num, req.body, caller);
      return res.status(200).json({ success: true, message: "\u06A9\u0645\u062F \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0648\u0627\u06AF\u0630\u0627\u0631 \u0634\u062F.", locker: updated });
    } catch (error) {
      next(error);
    }
  }
  static async vacate(req, res, next) {
    try {
      const num = parseInt(req.params.number, 10);
      const caller = _LockerController.extractCaller(req);
      const updated = await LockerService.vacateLocker(num, caller);
      return res.status(200).json({ success: true, message: "\u06A9\u0645\u062F \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062A\u062E\u0644\u06CC\u0647 \u0634\u062F.", locker: updated });
    } catch (error) {
      next(error);
    }
  }
  static async reportDefect(req, res, next) {
    try {
      const num = parseInt(req.params.number, 10);
      const { defectType, description } = req.body;
      const caller = _LockerController.extractCaller(req);
      const updated = await LockerService.reportDefect(num, defectType, description, caller);
      return res.status(200).json({ success: true, message: "\u06AF\u0632\u0627\u0631\u0634 \u062E\u0631\u0627\u0628\u06CC \u06A9\u0645\u062F \u062B\u0628\u062A \u0634\u062F.", locker: updated });
    } catch (error) {
      next(error);
    }
  }
  static async resolveDefect(req, res, next) {
    try {
      const num = parseInt(req.params.number, 10);
      const { repairNotes } = req.body;
      const caller = _LockerController.extractCaller(req);
      const updated = await LockerService.resolveDefect(num, repairNotes, caller);
      return res.status(200).json({ success: true, message: "\u0646\u0642\u0635 \u06A9\u0645\u062F \u0628\u0631\u0637\u0631\u0641 \u0634\u062F.", locker: updated });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/lockerRoutes.ts
var router13 = (0, import_express13.Router)();
router13.get("/", LockerController.getAll);
router13.get("/:number", LockerController.getByNumber);
router13.post("/:number/assign", LockerController.assign);
router13.post("/:number/vacate", LockerController.vacate);
router13.post("/:number/defect", LockerController.reportDefect);
router13.post("/:number/resolve-defect", LockerController.resolveDefect);
var lockerRoutes_default = router13;

// src/routes/calendarRoutes.ts
var import_express14 = require("express");

// src/services/CalendarService.ts
var import_zod14 = require("zod");
init_serverDataApi();
init_serverAuth();
var CalendarPeriodSchema = import_zod14.z.object({
  id: import_zod14.z.string().optional(),
  title: import_zod14.z.string().min(2, "\u0639\u0646\u0648\u0627\u0646 \u0633\u0627\u0644 \u06CC\u0627 \u062A\u0631\u0645 \u062A\u062D\u0635\u06CC\u0644\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  startDate: import_zod14.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u0634\u0631\u0648\u0639 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  endDate: import_zod14.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u067E\u0627\u06CC\u0627\u0646 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  description: import_zod14.z.string().optional(),
  defaultThursdayMode: import_zod14.z.enum(["special_program", "main_class", "off"]).default("off"),
  includeFridayAsStudyDay: import_zod14.z.boolean().default(false)
});
var HolidaySchema = import_zod14.z.object({
  id: import_zod14.z.string().optional(),
  periodId: import_zod14.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u062F\u0648\u0631\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  title: import_zod14.z.string().min(2, "\u0639\u0646\u0648\u0627\u0646 \u062A\u0639\u0637\u06CC\u0644\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  typeId: import_zod14.z.string().default("official"),
  typeName: import_zod14.z.string().default("\u062A\u0639\u0637\u06CC\u0644\u06CC \u0631\u0633\u0645\u06CC"),
  startDate: import_zod14.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u0634\u0631\u0648\u0639 \u062A\u0639\u0637\u06CC\u0644\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  endDate: import_zod14.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u067E\u0627\u06CC\u0627\u0646 \u062A\u0639\u0637\u06CC\u0644\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  description: import_zod14.z.string().optional()
});
var WeeklyProgramSchema = import_zod14.z.object({
  id: import_zod14.z.string().optional(),
  periodId: import_zod14.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u062F\u0648\u0631\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  title: import_zod14.z.string().min(2, "\u0639\u0646\u0648\u0627\u0646 \u0628\u0631\u0646\u0627\u0645\u0647 \u0647\u0641\u062A\u06AF\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  dayOfWeek: import_zod14.z.string().optional(),
  startDate: import_zod14.z.string().optional(),
  endDate: import_zod14.z.string().optional(),
  time: import_zod14.z.string().optional(),
  locationOrTeacher: import_zod14.z.string().optional(),
  grade: import_zod14.z.string().optional(),
  isPublic: import_zod14.z.boolean().default(true),
  description: import_zod14.z.string().optional(),
  color: import_zod14.z.string().optional()
});
var CalendarService = class {
  static async getAllPeriods(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "academic_calendar_periods", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u062A\u0642\u0648\u06CC\u0645 \u0622\u0645\u0648\u0632\u0634\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("academic_calendar_periods", callerUser);
    return Array.isArray(items) ? items : [];
  }
  static async getPeriodById(id, callerUser) {
    const periods = await this.getAllPeriods(callerUser);
    const period = periods.find((p) => p.id === id);
    if (!period) {
      throw new AppError("\u062F\u0648\u0631\u0647 \u062A\u0642\u0648\u06CC\u0645 \u0622\u0645\u0648\u0632\u0634\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.", { statusCode: 404 });
    }
    return period;
  }
  static async savePeriod(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "academic_calendar_periods", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062A\u0639\u0631\u06CC\u0641 \u062F\u0648\u0631\u0647 \u062A\u0642\u0648\u06CC\u0645 \u0622\u0645\u0648\u0632\u0634\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = CalendarPeriodSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `cal_p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      title: validData.title.trim(),
      startDate: validData.startDate,
      endDate: validData.endDate,
      description: validData.description?.trim(),
      defaultThursdayMode: validData.defaultThursdayMode,
      includeFridayAsStudyDay: validData.includeFridayAsStudyDay,
      createdAt: rawData?.createdAt || nowIso,
      updatedAt: nowIso
    };
    await serverSaveDoc("academic_calendar_periods", record, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: validData.id ? "UPDATE_CALENDAR_PERIOD" : "CREATE_CALENDAR_PERIOD",
      entityType: "calendar_period",
      entityId: id,
      description: `\u062B\u0628\u062A \u062F\u0648\u0631\u0647 \u062A\u0642\u0648\u06CC\u0645 \u0622\u0645\u0648\u0632\u0634\u06CC: ${record.title}`,
      newState: record
    });
    return record;
  }
  static async getAllHolidays(periodId, callerUser) {
    const items = await serverQueryCollection("academic_calendar_holidays", callerUser);
    const holidays = Array.isArray(items) ? items : [];
    return periodId ? holidays.filter((h) => h.periodId === periodId) : holidays;
  }
  static async saveHoliday(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "academic_calendar_holidays", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u062A\u0639\u0637\u06CC\u0644\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = HolidaySchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `hol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      periodId: validData.periodId,
      title: validData.title.trim(),
      typeId: validData.typeId,
      typeName: validData.typeName,
      startDate: validData.startDate,
      endDate: validData.endDate,
      description: validData.description?.trim(),
      createdAt: nowIso,
      updatedAt: nowIso
    };
    await serverSaveDoc("academic_calendar_holidays", record, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "SAVE_HOLIDAY",
      entityType: "holiday",
      entityId: id,
      description: `\u062B\u0628\u062A \u062A\u0639\u0637\u06CC\u0644\u06CC \u062F\u0631 \u062A\u0642\u0648\u06CC\u0645: ${record.title} (${record.startDate})`
    });
    return record;
  }
  static async deleteHoliday(id, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "academic_calendar_holidays", "delete");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062D\u0630\u0641 \u062A\u0639\u0637\u06CC\u0644\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    await serverDeleteDoc("academic_calendar_holidays", id, callerUser);
    return true;
  }
  static async getAllWeeklyPrograms(periodId, callerUser) {
    const items = await serverQueryCollection("academic_calendar_weekly_programs", callerUser);
    const programs = Array.isArray(items) ? items : [];
    return periodId ? programs.filter((p) => p.periodId === periodId) : programs;
  }
  static async saveWeeklyProgram(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "academic_calendar_weekly_programs", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u0628\u0631\u0646\u0627\u0645\u0647 \u0647\u0641\u062A\u06AF\u06CC \u062A\u0642\u0648\u06CC\u0645 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = WeeklyProgramSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0628\u0631\u0646\u0627\u0645\u0647 \u0647\u0641\u062A\u06AF\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `wp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      periodId: validData.periodId,
      title: validData.title.trim(),
      dayOfWeek: validData.dayOfWeek,
      startDate: validData.startDate || "",
      endDate: validData.endDate || "",
      time: validData.time,
      locationOrTeacher: validData.locationOrTeacher,
      grade: validData.grade,
      isPublic: validData.isPublic,
      description: validData.description?.trim(),
      color: validData.color,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    await serverSaveDoc("academic_calendar_weekly_programs", record, callerUser);
    return record;
  }
  static async deleteWeeklyProgram(id, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "academic_calendar_weekly_programs", "delete");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062D\u0630\u0641 \u0628\u0631\u0646\u0627\u0645\u0647 \u0647\u0641\u062A\u06AF\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    await serverDeleteDoc("academic_calendar_weekly_programs", id, callerUser);
    return true;
  }
};

// src/controllers/CalendarController.ts
init_serverAuth();
var CalendarController = class _CalendarController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAllPeriods(req, res, next) {
    try {
      const caller = _CalendarController.extractCaller(req);
      const items = await CalendarService.getAllPeriods(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getPeriodById(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _CalendarController.extractCaller(req);
      const period = await CalendarService.getPeriodById(id, caller);
      return res.status(200).json({ success: true, period });
    } catch (error) {
      next(error);
    }
  }
  static async savePeriod(req, res, next) {
    try {
      const caller = _CalendarController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const period = await CalendarService.savePeriod(payload, caller);
      return res.status(200).json({ success: true, message: "\u062F\u0648\u0631\u0647 \u062A\u0642\u0648\u06CC\u0645 \u0622\u0645\u0648\u0632\u0634\u06CC \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", period });
    } catch (error) {
      next(error);
    }
  }
  static async getHolidays(req, res, next) {
    try {
      const periodId = req.query.periodId;
      const caller = _CalendarController.extractCaller(req);
      const holidays = await CalendarService.getAllHolidays(periodId, caller);
      return res.status(200).json({ success: true, count: holidays.length, holidays });
    } catch (error) {
      next(error);
    }
  }
  static async saveHoliday(req, res, next) {
    try {
      const caller = _CalendarController.extractCaller(req);
      const holiday = await CalendarService.saveHoliday(req.body, caller);
      return res.status(200).json({ success: true, message: "\u062A\u0639\u0637\u06CC\u0644\u06CC \u062F\u0631 \u062A\u0642\u0648\u06CC\u0645 \u062B\u0628\u062A \u0634\u062F.", holiday });
    } catch (error) {
      next(error);
    }
  }
  static async deleteHoliday(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _CalendarController.extractCaller(req);
      await CalendarService.deleteHoliday(id, caller);
      return res.status(200).json({ success: true, message: "\u062A\u0639\u0637\u06CC\u0644\u06CC \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F." });
    } catch (error) {
      next(error);
    }
  }
  static async getWeeklyPrograms(req, res, next) {
    try {
      const periodId = req.query.periodId;
      const caller = _CalendarController.extractCaller(req);
      const programs = await CalendarService.getAllWeeklyPrograms(periodId, caller);
      return res.status(200).json({ success: true, count: programs.length, programs });
    } catch (error) {
      next(error);
    }
  }
  static async saveWeeklyProgram(req, res, next) {
    try {
      const caller = _CalendarController.extractCaller(req);
      const program = await CalendarService.saveWeeklyProgram(req.body, caller);
      return res.status(200).json({ success: true, message: "\u0628\u0631\u0646\u0627\u0645\u0647 \u0647\u0641\u062A\u06AF\u06CC \u062A\u0642\u0648\u06CC\u0645 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", program });
    } catch (error) {
      next(error);
    }
  }
  static async deleteWeeklyProgram(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _CalendarController.extractCaller(req);
      await CalendarService.deleteWeeklyProgram(id, caller);
      return res.status(200).json({ success: true, message: "\u0628\u0631\u0646\u0627\u0645\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F." });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/calendarRoutes.ts
var router14 = (0, import_express14.Router)();
router14.get("/holidays", CalendarController.getHolidays);
router14.post("/holidays", CalendarController.saveHoliday);
router14.delete("/holidays/:id", CalendarController.deleteHoliday);
router14.get("/weekly-programs", CalendarController.getWeeklyPrograms);
router14.post("/weekly-programs", CalendarController.saveWeeklyProgram);
router14.delete("/weekly-programs/:id", CalendarController.deleteWeeklyProgram);
router14.get("/periods", CalendarController.getAllPeriods);
router14.get("/periods/:id", CalendarController.getPeriodById);
router14.post("/periods", CalendarController.savePeriod);
var calendarRoutes_default = router14;

// src/routes/mealRoutes.ts
var import_express15 = require("express");

// src/services/MealService.ts
var import_zod15 = require("zod");
init_serverDataApi();
init_serverAuth();
var MealPeriodSchema = import_zod15.z.object({
  id: import_zod15.z.string().optional(),
  title: import_zod15.z.string().min(2, "\u0639\u0646\u0648\u0627\u0646 \u062F\u0648\u0631\u0647 \u0631\u0632\u0631\u0648 \u063A\u0630\u0627 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  startDate: import_zod15.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u0634\u0631\u0648\u0639 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  endDate: import_zod15.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u067E\u0627\u06CC\u0627\u0646 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  isActive: import_zod15.z.boolean().default(true),
  lunchPrice: import_zod15.z.number().nonnegative().optional(),
  dinnerPrice: import_zod15.z.number().nonnegative().optional()
});
var StudentReservationSchema = import_zod15.z.object({
  id: import_zod15.z.string().optional(),
  periodId: import_zod15.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u062F\u0648\u0631\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentId: import_zod15.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentName: import_zod15.z.string().min(1, "\u0646\u0627\u0645 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentGrade: import_zod15.z.string().optional(),
  selectedLunchDays: import_zod15.z.array(import_zod15.z.string()).default([]),
  selectedDinnerDays: import_zod15.z.array(import_zod15.z.string()).default([]),
  notes: import_zod15.z.string().optional()
});
var MealCancelledDaySchema = import_zod15.z.object({
  id: import_zod15.z.string().optional(),
  date: import_zod15.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u062A\u0639\u0637\u06CC\u0644\u06CC \u0648\u0639\u062F\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  mealType: import_zod15.z.enum(["lunch", "dinner", "both"]).default("both"),
  reason: import_zod15.z.string().min(2, "\u0639\u0644\u062A \u0639\u062F\u0645 \u0637\u0628\u062E \u06CC\u0627 \u062A\u0648\u0632\u06CC\u0639 \u063A\u0630\u0627 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.")
});
var MealService = class {
  static async getAllPeriods(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "meal_periods", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0645\u0627\u0698\u0648\u0644 \u062A\u063A\u0630\u06CC\u0647 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("meal_periods", callerUser);
    return Array.isArray(items) ? items : [];
  }
  static async savePeriod(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "meal_periods", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062A\u0639\u0631\u06CC\u0641 \u062F\u0648\u0631\u0647 \u062A\u063A\u0630\u06CC\u0647 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = MealPeriodSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062F\u0648\u0631\u0647 \u062A\u063A\u0630\u06CC\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `meal_p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      title: validData.title.trim(),
      startDate: validData.startDate,
      endDate: validData.endDate,
      enableLunch: true,
      enableDinner: true,
      lunchPrice: validData.lunchPrice || 45e3,
      dinnerPrice: validData.dinnerPrice || 35e3,
      status: validData.isActive ? "open" : "closed",
      lunchDisabledDays: ["\u062C\u0645\u0639\u0647"],
      dinnerDisabledDays: ["\u062C\u0645\u0639\u0647"],
      createdAt: rawData?.createdAt || nowIso
    };
    await serverSaveDoc("meal_periods", record, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: validData.id ? "UPDATE_MEAL_PERIOD" : "CREATE_MEAL_PERIOD",
      entityType: "meal_period",
      entityId: id,
      description: `\u062B\u0628\u062A \u062F\u0648\u0631\u0647 \u0631\u0632\u0631\u0648 \u0648\u0639\u062F\u0647\u200C\u0647\u0627\u06CC \u063A\u0630\u0627\u06CC\u06CC: ${record.title}`,
      newState: record
    });
    return record;
  }
  static async getStudentReservations(studentId, periodId, callerUser) {
    const items = await serverQueryCollection("student_meal_reservations", callerUser);
    let reservations = Array.isArray(items) ? items : [];
    if (studentId) reservations = reservations.filter((r) => r.studentId === studentId);
    if (periodId) reservations = reservations.filter((r) => r.periodId === periodId);
    return reservations;
  }
  static async saveReservation(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "student_meal_reservations", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0631\u0632\u0631\u0648 \u063A\u0630\u0627 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = StudentReservationSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0631\u0632\u0631\u0648 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `res_${validData.periodId}_${validData.studentId}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const lunchCount = validData.selectedLunchDays.length;
    const dinnerCount = validData.selectedDinnerDays.length;
    const totalLunchCost = lunchCount * 45e3;
    const totalDinnerCost = dinnerCount * 35e3;
    const totalMealCost = totalLunchCost + totalDinnerCost;
    const record = {
      id,
      periodId: validData.periodId,
      studentId: validData.studentId,
      studentName: validData.studentName.trim(),
      grade: validData.studentGrade,
      selectedLunchDays: validData.selectedLunchDays,
      selectedDinnerDays: validData.selectedDinnerDays,
      dinnerLocation: "institute",
      totalCalculatedLunches: lunchCount,
      totalCalculatedDinners: dinnerCount,
      totalLunchCost,
      totalDinnerCost,
      totalMealCost,
      finalDeductionAmount: totalMealCost,
      notes: validData.notes,
      updatedAt: nowIso
    };
    await serverSaveDoc("student_meal_reservations", record, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "SAVE_MEAL_RESERVATION",
      entityType: "meal_reservation",
      entityId: id,
      description: `\u062B\u0628\u062A \u0631\u0632\u0631\u0648 \u063A\u0630\u0627 \u0628\u0631\u0627\u06CC \u0637\u0644\u0628\u0647 ${record.studentName} (\u0646\u0647\u0627\u0631: ${lunchCount} \u0631\u0648\u0632\u060C \u0634\u0627\u0645: ${dinnerCount} \u0631\u0648\u0632)`
    });
    return record;
  }
  static async getMealCancelledDays(callerUser) {
    const items = await serverQueryCollection("meal_cancelled_days", callerUser);
    return Array.isArray(items) ? items : [];
  }
  static async saveMealCancelledDay(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "meal_cancelled_days", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u062A\u0639\u0637\u06CC\u0644\u06CC \u067E\u062E\u062A \u063A\u0630\u0627 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = MealCancelledDaySchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `canc_m_${Date.now()}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      date: validData.date,
      mealType: validData.mealType,
      reason: validData.reason.trim(),
      registeredAt: nowIso,
      registeredByName: callerUser?.username || "system"
    };
    await serverSaveDoc("meal_cancelled_days", record, callerUser);
    return record;
  }
  static async getDailyKitchenStats(date, callerUser) {
    const allReservations = await this.getStudentReservations(void 0, void 0, callerUser);
    const cancelledDays = await this.getMealCancelledDays(callerUser);
    const isDayCancelled = cancelledDays.find((c) => c.date === date);
    let lunchPortions = 0;
    let dinnerPortions = 0;
    const beneficiaries = [];
    allReservations.forEach((r) => {
      const hasLunch = r.selectedLunchDays.includes(date);
      const hasDinner = r.selectedDinnerDays.includes(date);
      if (hasLunch || hasDinner) {
        if (hasLunch) lunchPortions++;
        if (hasDinner) dinnerPortions++;
        beneficiaries.push({
          studentName: r.studentName,
          grade: r.grade,
          lunch: hasLunch,
          dinner: hasDinner
        });
      }
    });
    return {
      date,
      isCancelled: Boolean(isDayCancelled),
      cancellationReason: isDayCancelled?.reason,
      cancelledMealType: isDayCancelled?.mealType,
      totalLunchPortions: isDayCancelled?.mealType === "lunch" || isDayCancelled?.mealType === "both" ? 0 : lunchPortions,
      totalDinnerPortions: isDayCancelled?.mealType === "dinner" || isDayCancelled?.mealType === "both" ? 0 : dinnerPortions,
      beneficiaries
    };
  }
};

// src/controllers/MealController.ts
init_serverAuth();
var MealController = class _MealController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAllPeriods(req, res, next) {
    try {
      const caller = _MealController.extractCaller(req);
      const items = await MealService.getAllPeriods(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async savePeriod(req, res, next) {
    try {
      const caller = _MealController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const period = await MealService.savePeriod(payload, caller);
      return res.status(200).json({ success: true, message: "\u062F\u0648\u0631\u0647 \u062A\u063A\u0630\u06CC\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", period });
    } catch (error) {
      next(error);
    }
  }
  static async getReservations(req, res, next) {
    try {
      const { studentId, periodId } = req.query;
      const caller = _MealController.extractCaller(req);
      const items = await MealService.getStudentReservations(studentId, periodId, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async saveReservation(req, res, next) {
    try {
      const caller = _MealController.extractCaller(req);
      const record = await MealService.saveReservation(req.body, caller);
      return res.status(200).json({ success: true, message: "\u0631\u0632\u0631\u0648 \u063A\u0630\u0627 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.", record });
    } catch (error) {
      next(error);
    }
  }
  static async getCancelledDays(req, res, next) {
    try {
      const caller = _MealController.extractCaller(req);
      const items = await MealService.getMealCancelledDays(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async saveCancelledDay(req, res, next) {
    try {
      const caller = _MealController.extractCaller(req);
      const record = await MealService.saveMealCancelledDay(req.body, caller);
      return res.status(200).json({ success: true, message: "\u062A\u0639\u0637\u06CC\u0644\u06CC \u0648\u0639\u062F\u0647 \u063A\u0630\u0627\u06CC\u06CC \u062B\u0628\u062A \u0634\u062F.", record });
    } catch (error) {
      next(error);
    }
  }
  static async getKitchenStats(req, res, next) {
    try {
      const date = req.query.date || (/* @__PURE__ */ new Date()).toLocaleDateString("fa-IR");
      const caller = _MealController.extractCaller(req);
      const stats = await MealService.getDailyKitchenStats(date, caller);
      return res.status(200).json({ success: true, ...stats });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/mealRoutes.ts
var router15 = (0, import_express15.Router)();
router15.get("/kitchen-stats", MealController.getKitchenStats);
router15.get("/cancelled-days", MealController.getCancelledDays);
router15.post("/cancelled-days", MealController.saveCancelledDay);
router15.get("/reservations", MealController.getReservations);
router15.post("/reservations", MealController.saveReservation);
router15.get("/periods", MealController.getAllPeriods);
router15.post("/periods", MealController.savePeriod);
var mealRoutes_default = router15;

// src/routes/studentRequestRoutes.ts
var import_express16 = require("express");

// src/services/StudentRequestService.ts
var import_zod16 = require("zod");
init_serverDataApi();
init_serverAuth();
var CreateStudentRequestSchema = import_zod16.z.object({
  id: import_zod16.z.string().optional(),
  studentId: import_zod16.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentName: import_zod16.z.string().min(1, "\u0646\u0627\u0645 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  nationalCode: import_zod16.z.string().optional(),
  grade: import_zod16.z.string().optional(),
  unit: import_zod16.z.enum(["education", "finance", "cultural_welfare"]),
  category: import_zod16.z.string().min(1, "\u0645\u0648\u0636\u0648\u0639 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  title: import_zod16.z.string().min(2, "\u0639\u0646\u0648\u0627\u0646 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  description: import_zod16.z.string().min(5, "\u0634\u0631\u062D \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F5 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F."),
  priority: import_zod16.z.enum(["low", "medium", "high", "urgent"]).default("medium")
});
var ReplyRequestSchema = import_zod16.z.object({
  replyText: import_zod16.z.string().min(2, "\u0645\u062A\u0646 \u067E\u0627\u0633\u062E \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  status: import_zod16.z.enum(["pending", "in_progress", "resolved", "rejected"]).default("resolved"),
  rejectionReason: import_zod16.z.string().optional()
});
var StudentRequestService = class {
  /**
   * Fetch requests with department and student scoping
   */
  static async getAllRequests(filters, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "student_requests", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0633\u0627\u0645\u0627\u0646\u0647 \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u200C\u0647\u0627 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("student_requests", callerUser);
    let requests = Array.isArray(items) ? items : [];
    if (callerUser && callerUser.level === 3) {
      const studentId = callerUser.linkedStudentId || callerUser.id;
      return requests.filter((r) => r.studentId === studentId);
    }
    if (filters?.unit) {
      requests = requests.filter((r) => r.unit === filters.unit);
    }
    if (filters?.status) {
      requests = requests.filter((r) => r.status === filters.status);
    }
    return requests;
  }
  static async getRequestById(id, callerUser) {
    const requests = await this.getAllRequests({}, callerUser);
    const req = requests.find((r) => r.id === id);
    if (!req) {
      throw new AppError("\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F \u06CC\u0627 \u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0622\u0646 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 404 });
    }
    return req;
  }
  static async createRequest(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "student_requests", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = CreateStudentRequestSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const validData = parsed.data;
    const id = validData.id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      studentId: validData.studentId,
      studentName: validData.studentName.trim(),
      nationalCode: validData.nationalCode,
      grade: validData.grade,
      unit: validData.unit,
      category: validData.category,
      title: validData.title.trim(),
      description: validData.description.trim(),
      priority: validData.priority,
      status: "pending",
      createdAt: nowIso,
      updatedAt: nowIso
    };
    await serverSaveDoc("student_requests", record, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "CREATE_STUDENT_REQUEST",
      entityType: "student_request",
      entityId: id,
      description: `\u062B\u0628\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062C\u062F\u06CC\u062F: \xAB${record.title}\xBB \u062A\u0648\u0633\u0637 \u0637\u0644\u0628\u0647: ${record.studentName}`
    });
    return record;
  }
  static async replyRequest(id, replyData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "student_requests", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u067E\u0627\u0633\u062E\u06AF\u0648\u06CC\u06CC \u0628\u0647 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const req = await this.getRequestById(id, callerUser);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const updated = {
      ...req,
      officialReply: replyData.replyText.trim(),
      status: replyData.status || "resolved",
      rejectionReason: replyData.rejectionReason?.trim(),
      repliedBy: callerUser?.userId || callerUser?.id,
      repliedByName: callerUser?.fullName || callerUser?.username || "\u0645\u0633\u0626\u0648\u0644 \u0645\u0631\u0628\u0648\u0637\u0647",
      repliedAt: nowIso,
      updatedAt: nowIso
    };
    await serverSaveDoc("student_requests", updated, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "REPLY_STUDENT_REQUEST",
      entityType: "student_request",
      entityId: id,
      description: `\u067E\u0627\u0633\u062E\u06AF\u0648\u06CC\u06CC \u0628\u0647 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0634\u0645\u0627\u0631\u0647 ${id} (\u0648\u0636\u0639\u06CC\u062A: ${updated.status})`
    });
    return updated;
  }
  static async getGlobalConfig(callerUser) {
    const items = await serverQueryCollection("global_requests_config", callerUser);
    if (Array.isArray(items) && items.length > 0) {
      return items[0];
    }
    return {
      id: "global_requests_config",
      isGlobalVisibleForStudents: true,
      isGlobalEnabled: true,
      officersStatus: {
        education: { isAccepting: true, officerTitle: "\u0645\u0633\u0626\u0648\u0644 \u0622\u0645\u0648\u0632\u0634" },
        finance: { isAccepting: true, officerTitle: "\u0645\u0633\u0626\u0648\u0644 \u0645\u0627\u0644\u06CC" },
        cultural_welfare: { isAccepting: true, officerTitle: "\u0645\u0633\u0626\u0648\u0644 \u0627\u0645\u0648\u0631 \u0641\u0631\u0647\u0646\u06AF\u06CC \u0648 \u0631\u0641\u0627\u0647\u06CC" }
      }
    };
  }
  static async saveGlobalConfig(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "global_requests_config", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u062A\u0646\u0647\u0627 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0645\u062C\u0627\u0632 \u0628\u0647 \u062A\u063A\u06CC\u06CC\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0639\u0645\u0648\u0645\u06CC \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u200C\u0647\u0627 \u0627\u0633\u062A.", { statusCode: 403 });
    }
    const config = {
      ...rawData,
      id: "global_requests_config",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy: callerUser?.username || "system"
    };
    await serverSaveDoc("global_requests_config", config, callerUser);
    return config;
  }
};

// src/controllers/StudentRequestController.ts
init_serverAuth();
var StudentRequestController = class _StudentRequestController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAll(req, res, next) {
    try {
      const caller = _StudentRequestController.extractCaller(req);
      const items = await StudentRequestService.getAllRequests(req.query, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _StudentRequestController.extractCaller(req);
      const requestItem = await StudentRequestService.getRequestById(id, caller);
      return res.status(200).json({ success: true, request: requestItem });
    } catch (error) {
      next(error);
    }
  }
  static async create(req, res, next) {
    try {
      const caller = _StudentRequestController.extractCaller(req);
      const requestItem = await StudentRequestService.createRequest(req.body, caller);
      return res.status(200).json({ success: true, message: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0634\u0645\u0627 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.", request: requestItem });
    } catch (error) {
      next(error);
    }
  }
  static async reply(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _StudentRequestController.extractCaller(req);
      const updated = await StudentRequestService.replyRequest(id, req.body, caller);
      return res.status(200).json({ success: true, message: "\u067E\u0627\u0633\u062E \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.", request: updated });
    } catch (error) {
      next(error);
    }
  }
  static async getConfig(req, res, next) {
    try {
      const caller = _StudentRequestController.extractCaller(req);
      const config = await StudentRequestService.getGlobalConfig(caller);
      return res.status(200).json({ success: true, config });
    } catch (error) {
      next(error);
    }
  }
  static async saveConfig(req, res, next) {
    try {
      const caller = _StudentRequestController.extractCaller(req);
      const config = await StudentRequestService.saveGlobalConfig(req.body, caller);
      return res.status(200).json({ success: true, message: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0633\u0627\u0645\u0627\u0646\u0647 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", config });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/studentRequestRoutes.ts
var router16 = (0, import_express16.Router)();
router16.get("/config", StudentRequestController.getConfig);
router16.post("/config", StudentRequestController.saveConfig);
router16.get("/", StudentRequestController.getAll);
router16.get("/:id", StudentRequestController.getById);
router16.post("/", StudentRequestController.create);
router16.post("/:id/reply", StudentRequestController.reply);
var studentRequestRoutes_default = router16;

// src/routes/transportRoutes.ts
var import_express17 = require("express");

// src/services/TransportService.ts
var import_zod17 = require("zod");
init_serverDataApi();
init_serverAuth();
var DriverSchema = import_zod17.z.object({
  id: import_zod17.z.string().optional(),
  fullName: import_zod17.z.string().min(2, "\u0646\u0627\u0645 \u0648 \u0646\u0627\u0645 \u062E\u0627\u0646\u0648\u0627\u062F\u06AF\u06CC \u0631\u0627\u0646\u0646\u062F\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  name: import_zod17.z.string().optional(),
  phoneNumber: import_zod17.z.string().optional(),
  phone: import_zod17.z.string().optional(),
  carModel: import_zod17.z.string().optional(),
  plateNumber: import_zod17.z.string().optional(),
  carPlate: import_zod17.z.string().optional(),
  isActive: import_zod17.z.boolean().default(true),
  notes: import_zod17.z.string().optional()
});
var WeeklyRoutineSchema = import_zod17.z.object({
  id: import_zod17.z.string().optional(),
  teacherId: import_zod17.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0627\u0633\u062A\u0627\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  teacherName: import_zod17.z.string().min(1, "\u0646\u0627\u0645 \u0627\u0633\u062A\u0627\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  daysOfWeek: import_zod17.z.array(import_zod17.z.string()).default([]),
  arrivalEnabled: import_zod17.z.boolean().optional(),
  arrivalTime: import_zod17.z.string().default(""),
  arrivalAddressTitle: import_zod17.z.string().default(""),
  arrivalAddressDetails: import_zod17.z.string().default(""),
  departureEnabled: import_zod17.z.boolean().optional(),
  departureTime: import_zod17.z.string().default(""),
  departureAddressTitle: import_zod17.z.string().default(""),
  departureAddressDetails: import_zod17.z.string().default(""),
  costPerTrip: import_zod17.z.number().nonnegative().optional(),
  driverId: import_zod17.z.string().optional(),
  driverName: import_zod17.z.string().optional(),
  isActive: import_zod17.z.boolean().default(true),
  notes: import_zod17.z.string().optional()
});
var SingleTripSchema = import_zod17.z.object({
  id: import_zod17.z.string().optional(),
  teacherId: import_zod17.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0627\u0633\u062A\u0627\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  teacherName: import_zod17.z.string().min(1, "\u0646\u0627\u0645 \u0627\u0633\u062A\u0627\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  date: import_zod17.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u0633\u0641\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  tripType: import_zod17.z.enum(["arrival", "departure", "both", "round_trip"]).default("both"),
  arrivalTime: import_zod17.z.string().optional(),
  arrivalAddressTitle: import_zod17.z.string().optional(),
  arrivalAddressDetails: import_zod17.z.string().optional(),
  departureTime: import_zod17.z.string().optional(),
  departureAddressTitle: import_zod17.z.string().optional(),
  departureAddressDetails: import_zod17.z.string().optional(),
  driverId: import_zod17.z.string().optional(),
  driverName: import_zod17.z.string().optional(),
  tripsCount: import_zod17.z.number().positive().default(1),
  cost: import_zod17.z.number().nonnegative().default(0),
  status: import_zod17.z.enum(["scheduled", "completed", "cancelled"]).default("completed"),
  notes: import_zod17.z.string().optional()
});
var TransportService = class {
  static async getAllDrivers(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "drivers", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0628\u0627\u0646\u06A9 \u0631\u0627\u0646\u0646\u062F\u06AF\u0627\u0646 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("drivers", callerUser);
    return Array.isArray(items) ? items : [];
  }
  static async saveDriver(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "drivers", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0631\u0627\u0646\u0646\u062F\u0647 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = DriverSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0631\u0627\u0646\u0646\u062F\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const valid = parsed.data;
    const id = valid.id || `drv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      fullName: valid.fullName.trim(),
      name: valid.name?.trim() || valid.fullName.trim(),
      phoneNumber: valid.phoneNumber || valid.phone || "",
      phone: valid.phoneNumber || valid.phone || "",
      carModel: valid.carModel?.trim() || "",
      plateNumber: valid.plateNumber?.trim() || valid.carPlate?.trim() || "",
      carPlate: valid.plateNumber?.trim() || valid.carPlate?.trim() || "",
      isActive: valid.isActive,
      notes: valid.notes || "",
      createdAt: rawData?.createdAt || nowIso
    };
    await serverSaveDoc("drivers", record, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: valid.id ? "UPDATE_DRIVER" : "CREATE_DRIVER",
      entityType: "driver",
      entityId: id,
      description: `\u062B\u0628\u062A \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0631\u0627\u0646\u0646\u062F\u0647 \u0633\u0631\u0648\u06CC\u0633: ${record.fullName}`,
      newState: record
    });
    return record;
  }
  static async deleteDriver(id, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "drivers", "delete");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062D\u0630\u0641 \u0631\u0627\u0646\u0646\u062F\u0647 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    await serverDeleteDoc("drivers", id, callerUser);
    return true;
  }
  static async getWeeklyRoutines(teacherId, callerUser) {
    const items = await serverQueryCollection("teacher_transport_routines", callerUser);
    const routines = Array.isArray(items) ? items : [];
    return teacherId ? routines.filter((r) => r.teacherId === teacherId) : routines;
  }
  static async saveWeeklyRoutine(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "teacher_transport_routines", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u0628\u0631\u0646\u0627\u0645\u0647 \u0647\u0641\u062A\u06AF\u06CC \u0633\u0631\u0648\u06CC\u0633 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = WeeklyRoutineSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0628\u0631\u0646\u0627\u0645\u0647 \u0647\u0641\u062A\u06AF\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const valid = parsed.data;
    const id = valid.id || `routine_${valid.teacherId}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      teacherId: valid.teacherId,
      teacherName: valid.teacherName.trim(),
      daysOfWeek: valid.daysOfWeek,
      arrivalEnabled: valid.arrivalEnabled,
      arrivalTime: valid.arrivalTime,
      arrivalAddressTitle: valid.arrivalAddressTitle,
      arrivalAddressDetails: valid.arrivalAddressDetails,
      departureEnabled: valid.departureEnabled,
      departureTime: valid.departureTime,
      departureAddressTitle: valid.departureAddressTitle,
      departureAddressDetails: valid.departureAddressDetails,
      costPerTrip: valid.costPerTrip,
      driverId: valid.driverId,
      driverName: valid.driverName,
      isActive: valid.isActive,
      notes: valid.notes,
      createdAt: rawData?.createdAt || nowIso,
      updatedAt: nowIso
    };
    await serverSaveDoc("teacher_transport_routines", record, callerUser);
    return record;
  }
  static async getAllTrips(filters, callerUser) {
    const items = await serverQueryCollection("teacher_transport_trips", callerUser);
    let trips = Array.isArray(items) ? items : [];
    if (filters?.teacherId) trips = trips.filter((t) => t.teacherId === filters.teacherId);
    if (filters?.date) trips = trips.filter((t) => t.date === filters.date);
    return trips;
  }
  static async saveSingleTrip(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "teacher_transport_trips", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u0633\u0631\u0648\u06CC\u0633 \u0631\u0641\u062A \u0648 \u0622\u0645\u062F \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = SingleTripSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0633\u0631\u0648\u06CC\u0633 \u0631\u0641\u062A \u0648 \u0622\u0645\u062F \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const valid = parsed.data;
    const id = valid.id || `trip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      teacherId: valid.teacherId,
      teacherName: valid.teacherName.trim(),
      date: valid.date,
      tripType: valid.tripType,
      arrivalTime: valid.arrivalTime,
      arrivalAddressTitle: valid.arrivalAddressTitle,
      arrivalAddressDetails: valid.arrivalAddressDetails,
      departureTime: valid.departureTime,
      departureAddressTitle: valid.departureAddressTitle,
      departureAddressDetails: valid.departureAddressDetails,
      driverId: valid.driverId,
      driverName: valid.driverName,
      tripsCount: valid.tripsCount,
      cost: valid.cost,
      status: valid.status,
      notes: valid.notes,
      createdAt: rawData?.createdAt || nowIso
    };
    await serverSaveDoc("teacher_transport_trips", record, callerUser);
    return record;
  }
};

// src/controllers/TransportController.ts
init_serverAuth();
var TransportController = class _TransportController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAllDrivers(req, res, next) {
    try {
      const caller = _TransportController.extractCaller(req);
      const items = await TransportService.getAllDrivers(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async saveDriver(req, res, next) {
    try {
      const caller = _TransportController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const driver = await TransportService.saveDriver(payload, caller);
      return res.status(200).json({ success: true, message: "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0631\u0627\u0646\u0646\u062F\u0647 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", driver });
    } catch (error) {
      next(error);
    }
  }
  static async deleteDriver(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _TransportController.extractCaller(req);
      await TransportService.deleteDriver(id, caller);
      return res.status(200).json({ success: true, message: "\u0631\u0627\u0646\u0646\u062F\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F." });
    } catch (error) {
      next(error);
    }
  }
  static async getRoutines(req, res, next) {
    try {
      const teacherId = req.query.teacherId;
      const caller = _TransportController.extractCaller(req);
      const routines = await TransportService.getWeeklyRoutines(teacherId, caller);
      return res.status(200).json({ success: true, count: routines.length, routines });
    } catch (error) {
      next(error);
    }
  }
  static async saveRoutine(req, res, next) {
    try {
      const caller = _TransportController.extractCaller(req);
      const routine = await TransportService.saveWeeklyRoutine(req.body, caller);
      return res.status(200).json({ success: true, message: "\u0628\u0631\u0646\u0627\u0645\u0647 \u0647\u0641\u062A\u06AF\u06CC \u0633\u0631\u0648\u06CC\u0633 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", routine });
    } catch (error) {
      next(error);
    }
  }
  static async getTrips(req, res, next) {
    try {
      const { teacherId, date } = req.query;
      const caller = _TransportController.extractCaller(req);
      const trips = await TransportService.getAllTrips({ teacherId, date }, caller);
      return res.status(200).json({ success: true, count: trips.length, trips });
    } catch (error) {
      next(error);
    }
  }
  static async saveTrip(req, res, next) {
    try {
      const caller = _TransportController.extractCaller(req);
      const trip = await TransportService.saveSingleTrip(req.body, caller);
      return res.status(200).json({ success: true, message: "\u0633\u0641\u0631 \u0633\u0631\u0648\u06CC\u0633 \u062B\u0628\u062A \u0634\u062F.", trip });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/transportRoutes.ts
var router17 = (0, import_express17.Router)();
router17.get("/drivers", TransportController.getAllDrivers);
router17.post("/drivers", TransportController.saveDriver);
router17.delete("/drivers/:id", TransportController.deleteDriver);
router17.get("/routines", TransportController.getRoutines);
router17.post("/routines", TransportController.saveRoutine);
router17.get("/trips", TransportController.getTrips);
router17.post("/trips", TransportController.saveTrip);
var transportRoutes_default = router17;

// src/routes/courseSelectionRoutes.ts
var import_express18 = require("express");

// src/services/CourseSelectionService.ts
var import_zod18 = require("zod");
init_serverDataApi();
init_serverAuth();
var CourseSelectionPeriodSchema = import_zod18.z.object({
  id: import_zod18.z.string().optional(),
  title: import_zod18.z.string().min(2, "\u0639\u0646\u0648\u0627\u0646 \u062F\u0648\u0631\u0647 \u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  academicYear: import_zod18.z.string().optional(),
  term: import_zod18.z.string().optional(),
  allowedProgramTypes: import_zod18.z.array(import_zod18.z.string()).default(["\u0627\u0635\u0644\u06CC", "\u0645\u0634\u0627\u0648\u0631\u0647"]),
  allowedGrades: import_zod18.z.array(import_zod18.z.string()).default([]),
  startDate: import_zod18.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u0634\u0631\u0648\u0639 \u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  endDate: import_zod18.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u067E\u0627\u06CC\u0627\u0646 \u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  isActive: import_zod18.z.boolean().default(true),
  allowCrossGradeSelection: import_zod18.z.boolean().default(true),
  description: import_zod18.z.string().optional()
});
var SubmitCourseSelectionSchema = import_zod18.z.object({
  id: import_zod18.z.string().optional(),
  periodId: import_zod18.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u062F\u0648\u0631\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  periodTitle: import_zod18.z.string().min(1, "\u0639\u0646\u0648\u0627\u0646 \u062F\u0648\u0631\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentId: import_zod18.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentName: import_zod18.z.string().min(1, "\u0646\u0627\u0645 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentGrade: import_zod18.z.string().min(1, "\u067E\u0627\u06CC\u0647 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  nationalId: import_zod18.z.string().optional(),
  selectedCourses: import_zod18.z.array(import_zod18.z.object({
    programId: import_zod18.z.string(),
    programTitle: import_zod18.z.string(),
    programType: import_zod18.z.string(),
    teacherName: import_zod18.z.string().optional(),
    teacherPhone: import_zod18.z.string().optional(),
    day: import_zod18.z.string().optional(),
    time: import_zod18.z.string().optional(),
    madrasRoom: import_zod18.z.string().optional(),
    grade: import_zod18.z.string().optional()
  })).min(1, "\u062D\u062F\u0627\u0642\u0644 \u0628\u0627\u06CC\u062F \u06CC\u06A9 \u062F\u0631\u0633 \u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u0648\u062F.")
});
var CourseSelectionService = class {
  static async getAllPeriods(callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "course_selection_periods", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u062F\u0648\u0631\u0647\u200C\u0647\u0627\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("course_selection_periods", callerUser);
    return Array.isArray(items) ? items : [];
  }
  static async savePeriod(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "course_selection_periods", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062A\u0639\u0631\u06CC\u0641 \u062F\u0648\u0631\u0647 \u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = CourseSelectionPeriodSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062F\u0648\u0631\u0647 \u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const valid = parsed.data;
    const id = valid.id || `cs_period_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      title: valid.title.trim(),
      academicYear: valid.academicYear,
      term: valid.term,
      allowedProgramTypes: valid.allowedProgramTypes,
      allowedGrades: valid.allowedGrades,
      startDate: valid.startDate,
      endDate: valid.endDate,
      isActive: valid.isActive,
      allowCrossGradeSelection: valid.allowCrossGradeSelection,
      description: valid.description?.trim(),
      createdAt: rawData?.createdAt || nowIso,
      createdByUserName: callerUser?.username || "system",
      updatedAt: nowIso
    };
    await serverSaveDoc("course_selection_periods", record, callerUser);
    return record;
  }
  static async getAllRequests(periodId, callerUser) {
    const items = await serverQueryCollection("course_selection_requests", callerUser);
    let requests = Array.isArray(items) ? items : [];
    if (periodId) requests = requests.filter((r) => r.periodId === periodId);
    return requests;
  }
  static async getRequestByStudent(studentId, periodId, callerUser) {
    const requests = await this.getAllRequests(periodId, callerUser);
    return requests.find((r) => r.studentId === studentId) || null;
  }
  static async submitCourseSelection(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "course_selection_requests", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u0641\u0631\u0645 \u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = SubmitCourseSelectionSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0641\u0631\u0645 \u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const valid = parsed.data;
    const id = valid.id || `cs_req_${valid.periodId}_${valid.studentId}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      periodId: valid.periodId,
      periodTitle: valid.periodTitle,
      studentId: valid.studentId,
      studentName: valid.studentName.trim(),
      studentGrade: valid.studentGrade,
      nationalId: valid.nationalId,
      selectedCourses: valid.selectedCourses,
      status: "pending",
      submittedAt: nowIso
    };
    await serverSaveDoc("course_selection_requests", record, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: "SUBMIT_COURSE_SELECTION",
      entityType: "course_selection",
      entityId: id,
      description: `\u062B\u0628\u062A \u0641\u0631\u0645 \u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0628\u0631\u0627\u06CC \u0637\u0644\u0628\u0647: ${record.studentName} (${record.selectedCourses.length} \u062F\u0631\u0633)`
    });
    return record;
  }
  static async reviewRequest(id, status, adminNotes, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "course_selection_requests", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062A\u0627\u06CC\u06CC\u062F \u06CC\u0627 \u0631\u062F \u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const allRequests = await this.getAllRequests(void 0, callerUser);
    const req = allRequests.find((r) => r.id === id);
    if (!req) {
      throw new AppError("\u0641\u0631\u0645 \u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.", { statusCode: 404 });
    }
    const updated = {
      ...req,
      status,
      adminNotes: adminNotes || req.adminNotes,
      reviewedAt: (/* @__PURE__ */ new Date()).toISOString(),
      reviewedBy: callerUser?.username || "\u0645\u0633\u0626\u0648\u0644 \u0622\u0645\u0648\u0632\u0634"
    };
    await serverSaveDoc("course_selection_requests", updated, callerUser);
    return updated;
  }
};

// src/controllers/CourseSelectionController.ts
init_serverAuth();
var CourseSelectionController = class _CourseSelectionController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAllPeriods(req, res, next) {
    try {
      const caller = _CourseSelectionController.extractCaller(req);
      const items = await CourseSelectionService.getAllPeriods(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async savePeriod(req, res, next) {
    try {
      const caller = _CourseSelectionController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const period = await CourseSelectionService.savePeriod(payload, caller);
      return res.status(200).json({ success: true, message: "\u062F\u0648\u0631\u0647 \u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", period });
    } catch (error) {
      next(error);
    }
  }
  static async getAllRequests(req, res, next) {
    try {
      const periodId = req.query.periodId;
      const caller = _CourseSelectionController.extractCaller(req);
      const items = await CourseSelectionService.getAllRequests(periodId, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getRequestByStudent(req, res, next) {
    try {
      const { studentId } = req.params;
      const periodId = req.query.periodId;
      const caller = _CourseSelectionController.extractCaller(req);
      const item = await CourseSelectionService.getRequestByStudent(studentId, periodId, caller);
      return res.status(200).json({ success: true, request: item });
    } catch (error) {
      next(error);
    }
  }
  static async submit(req, res, next) {
    try {
      const caller = _CourseSelectionController.extractCaller(req);
      const record = await CourseSelectionService.submitCourseSelection(req.body, caller);
      return res.status(200).json({ success: true, message: "\u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0631\u0633\u0627\u0644 \u0634\u062F.", request: record });
    } catch (error) {
      next(error);
    }
  }
  static async review(req, res, next) {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;
      const caller = _CourseSelectionController.extractCaller(req);
      const updated = await CourseSelectionService.reviewRequest(id, status, adminNotes, caller);
      return res.status(200).json({ success: true, message: `\u0648\u0636\u0639\u06CC\u062A \u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u062D\u062F \u0628\u0647 ${status} \u062A\u063A\u06CC\u06CC\u0631 \u06CC\u0627\u0641\u062A.`, request: updated });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/courseSelectionRoutes.ts
var router18 = (0, import_express18.Router)();
router18.get("/requests/student/:studentId", CourseSelectionController.getRequestByStudent);
router18.get("/requests", CourseSelectionController.getAllRequests);
router18.post("/requests", CourseSelectionController.submit);
router18.post("/requests/:id/review", CourseSelectionController.review);
router18.get("/periods", CourseSelectionController.getAllPeriods);
router18.post("/periods", CourseSelectionController.savePeriod);
var courseSelectionRoutes_default = router18;

// src/routes/counselingRoutes.ts
var import_express19 = require("express");

// src/services/CounselingService.ts
var import_zod19 = require("zod");
init_serverDataApi();
init_serverAuth();
var CounselingGradeSchema = import_zod19.z.object({
  id: import_zod19.z.string().optional(),
  studentId: import_zod19.z.string().min(1, "\u0634\u0646\u0627\u0633\u0647 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  studentName: import_zod19.z.string().min(1, "\u0646\u0627\u0645 \u0637\u0644\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  grade: import_zod19.z.string().optional(),
  counselorTeacherName: import_zod19.z.string().min(1, "\u0646\u0627\u0645 \u0627\u0633\u062A\u0627\u062F \u0645\u0634\u0627\u0648\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  courseTitle: import_zod19.z.string().min(1, "\u0639\u0646\u0648\u0627\u0646 \u06A9\u0644\u0627\u0633 \u0645\u0634\u0627\u0648\u0631\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  sessionDate: import_zod19.z.string().min(1, "\u062A\u0627\u0631\u06CC\u062E \u062C\u0644\u0633\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."),
  sessionNumber: import_zod19.z.union([import_zod19.z.number(), import_zod19.z.string()]).optional(),
  participationScore: import_zod19.z.enum(["\u0627\u0644\u0641", "\u0628", "\u062C", "\u062F", "\u063A\u06CC\u0628\u062A"]).default("\u0627\u0644\u0641"),
  researchScore: import_zod19.z.enum(["\u0627\u0644\u0641", "\u0628", "\u062C", "\u062F", "\u063A\u06CC\u0628\u062A"]).default("\u0627\u0644\u0641"),
  counselorFeedback: import_zod19.z.string().optional()
});
var CounselingService = class {
  static async getAllGrades(filters, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "counseling_grades", "read");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0646\u0645\u0631\u0627\u062A \u0648 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0645\u0634\u0627\u0648\u0631\u0647 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const items = await serverQueryCollection("counseling_grades", callerUser);
    let grades = Array.isArray(items) ? items : [];
    if (filters?.studentId) grades = grades.filter((g) => g.studentId === filters.studentId);
    if (filters?.courseTitle) grades = grades.filter((g) => g.courseTitle === filters.courseTitle);
    return grades;
  }
  static async getGradesByStudent(studentId, callerUser) {
    return this.getAllGrades({ studentId }, callerUser);
  }
  static async saveCounselingGrade(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "counseling_grades", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0648 \u0646\u0645\u0631\u0647 \u0645\u0634\u0627\u0648\u0631\u0647 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const parsed = CounselingGradeSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0645\u0634\u0627\u0648\u0631\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
      throw new AppError(errorMsg, { statusCode: 400 });
    }
    const valid = parsed.data;
    const id = valid.id || `c_grade_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      studentId: valid.studentId,
      studentName: valid.studentName.trim(),
      grade: valid.grade,
      counselorTeacherName: valid.counselorTeacherName.trim(),
      courseTitle: valid.courseTitle.trim(),
      sessionDate: valid.sessionDate,
      sessionNumber: valid.sessionNumber,
      participationScore: valid.participationScore,
      researchScore: valid.researchScore,
      counselorFeedback: valid.counselorFeedback,
      createdAt: rawData?.createdAt || nowIso,
      createdByName: callerUser?.username || "\u0627\u0633\u062A\u0627\u062F \u0645\u0634\u0627\u0648\u0631",
      createdByRole: callerUser?.role || "teacher",
      updatedAt: nowIso
    };
    await serverSaveDoc("counseling_grades", record, callerUser);
    await logServerAudit2({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || "system",
      userRole: callerUser?.role,
      action: valid.id ? "UPDATE_COUNSELING_GRADE" : "CREATE_COUNSELING_GRADE",
      entityType: "counseling_grade",
      entityId: id,
      description: `\u062B\u0628\u062A \u0646\u0645\u0631\u0647 \u0645\u0634\u0627\u0648\u0631\u0647 \u0628\u0631\u0627\u06CC \u0637\u0644\u0628\u0647 ${record.studentName} \u062F\u0631 \u062F\u0631\u0633 ${record.courseTitle} (\u0645\u0634\u0627\u0631\u06A9\u062A: ${record.participationScore}\u060C \u067E\u0698\u0648\u0647\u0634: ${record.researchScore})`
    });
    return record;
  }
  static async deleteCounselingGrade(id, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "counseling_grades", "delete");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062D\u0630\u0641 \u0646\u0645\u0631\u0647 \u0645\u0634\u0627\u0648\u0631\u0647 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    await serverDeleteDoc("counseling_grades", id, callerUser);
    return true;
  }
  static async getAdvisorProposals(callerUser) {
    const items = await serverQueryCollection("consultation_advisor_proposals", callerUser);
    return Array.isArray(items) ? items : [];
  }
  static async saveAdvisorProposal(rawData, callerUser) {
    const authCheck = authorizeCollectionAccess(callerUser, "consultation_advisor_proposals", "write");
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || "\u0634\u0645\u0627 \u0645\u062C\u0648\u0632 \u062B\u0628\u062A \u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u06AF\u0631\u0648\u0647\u200C\u0628\u0646\u062F\u06CC \u0645\u0634\u0627\u0648\u0631\u0647 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", { statusCode: 403 });
    }
    const id = rawData.id || `adv_prop_${Date.now()}`;
    const record = {
      ...rawData,
      id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdByUserName: callerUser?.username || "system"
    };
    await serverSaveDoc("consultation_advisor_proposals", record, callerUser);
    return record;
  }
};

// src/controllers/CounselingController.ts
init_serverAuth();
var CounselingController = class _CounselingController {
  static extractCaller(req) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken2(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }
  static async getAllGrades(req, res, next) {
    try {
      const { studentId, courseTitle } = req.query;
      const caller = _CounselingController.extractCaller(req);
      const items = await CounselingService.getAllGrades({ studentId, courseTitle }, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async getByStudent(req, res, next) {
    try {
      const { studentId } = req.params;
      const caller = _CounselingController.extractCaller(req);
      const items = await CounselingService.getGradesByStudent(studentId, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async saveGrade(req, res, next) {
    try {
      const caller = _CounselingController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const grade = await CounselingService.saveCounselingGrade(payload, caller);
      return res.status(200).json({ success: true, message: "\u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u06A9\u0644\u0627\u0633 \u0645\u0634\u0627\u0648\u0631\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.", grade });
    } catch (error) {
      next(error);
    }
  }
  static async deleteGrade(req, res, next) {
    try {
      const { id } = req.params;
      const caller = _CounselingController.extractCaller(req);
      await CounselingService.deleteCounselingGrade(id, caller);
      return res.status(200).json({ success: true, message: "\u0646\u0645\u0631\u0647 \u0645\u0634\u0627\u0648\u0631\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u06AF\u0631\u062F\u06CC\u062F." });
    } catch (error) {
      next(error);
    }
  }
  static async getProposals(req, res, next) {
    try {
      const caller = _CounselingController.extractCaller(req);
      const items = await CounselingService.getAdvisorProposals(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
  static async saveProposal(req, res, next) {
    try {
      const caller = _CounselingController.extractCaller(req);
      const proposal = await CounselingService.saveAdvisorProposal(req.body, caller);
      return res.status(200).json({ success: true, message: "\u0637\u0631\u062D \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u0645\u0634\u0627\u0648\u0631 \u062B\u0628\u062A \u06AF\u0631\u062F\u06CC\u062F.", proposal });
    } catch (error) {
      next(error);
    }
  }
};

// src/routes/counselingRoutes.ts
var router19 = (0, import_express19.Router)();
router19.get("/grades/student/:studentId", CounselingController.getByStudent);
router19.get("/grades", CounselingController.getAllGrades);
router19.post("/grades", CounselingController.saveGrade);
router19.delete("/grades/:id", CounselingController.deleteGrade);
router19.get("/proposals", CounselingController.getProposals);
router19.post("/proposals", CounselingController.saveProposal);
var counselingRoutes_default = router19;

// src/routes/dataRoutes.ts
var import_express20 = require("express");
var import_path4 = __toESM(require("path"), 1);
var import_fs4 = __toESM(require("fs"), 1);
init_serverDataApi();
init_serverAuth();
init_logger();
var router20 = (0, import_express20.Router)();
var extractToken = (req) => {
  if (req.cookies) {
    if (req.cookies.auth_access_token) return req.cookies.auth_access_token;
    if (req.cookies.auth_token) return req.cookies.auth_token;
    if (req.cookies.access_token) return req.cookies.access_token;
    if (req.cookies.token) return req.cookies.token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
};
var getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
};
router20.get("/data/bootstrap", async (req, res) => {
  const token = extractToken(req);
  let userLevel = 3;
  let userRole = "guest";
  if (token) {
    const verification = verifyAccessToken2(token);
    if (verification.valid && verification.decoded) {
      userLevel = verification.decoded.level;
      userRole = verification.decoded.role;
    }
  }
  try {
    const data = await fetchBootstrapData(userLevel, userRole);
    return res.status(200).json({
      success: true,
      timestamp: Date.now(),
      data
    });
  } catch (error) {
    logger.error("[Bootstrap Route Error]:", error);
    return res.status(500).json({
      success: false,
      message: "\u062E\u0637\u0627 \u062F\u0631 \u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC \u0647\u0645\u0632\u0645\u0627\u0646 \u062A\u0645\u0627\u0645 \u062F\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u0633\u0627\u0645\u0627\u0646\u0647"
    });
  }
});
router20.get("/database/snapshot", async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: "\u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  const verification = verifyAccessToken2(token);
  if (!verification.valid || !verification.decoded || verification.decoded.level > 2) {
    return res.status(403).json({ success: false, message: "\u0645\u062C\u0648\u0632 \u062A\u0647\u06CC\u0647 \u0646\u0633\u062E\u0647 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F." });
  }
  const { createFullDatabaseSnapshot: createFullDatabaseSnapshot2 } = await Promise.resolve().then(() => (init_serverBackupEngine(), serverBackupEngine_exports));
  try {
    const snapshot = await createFullDatabaseSnapshot2(verification.decoded.username, false);
    const filename = `madrasah_backup_${snapshot.metadata.timestamp.substring(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(snapshot, null, 2));
  } catch (err) {
    return res.status(500).json({ success: false, message: "\u062E\u0637\u0627 \u062F\u0631 \u062A\u0647\u06CC\u0647 \u0646\u0633\u062E\u0647 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u06A9\u0627\u0645\u0644 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633." });
  }
});
router20.post("/database/restore-snapshot", async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: "\u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  const verification = verifyAccessToken2(token);
  if (!verification.valid || !verification.decoded || verification.decoded.level !== 1) {
    return res.status(403).json({ success: false, message: "\u0641\u0642\u0637 \u0633\u0648\u067E\u0631 \u0627\u062F\u0645\u06CC\u0646 (\u0633\u0637\u062D \u06F1) \u0645\u062C\u0627\u0632 \u0628\u0647 \u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC \u06A9\u0627\u0645\u0644 \u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647 \u0627\u0633\u062A." });
  }
  const { snapshotPayload } = req.body || {};
  if (!snapshotPayload || !snapshotPayload.data) {
    return res.status(400).json({ success: false, message: "\u0645\u062D\u062A\u0648\u0627\u06CC \u0641\u0627\u06CC\u0644 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A." });
  }
  const { restoreDatabaseSnapshot: restoreDatabaseSnapshot2 } = await Promise.resolve().then(() => (init_serverBackupEngine(), serverBackupEngine_exports));
  const result = await restoreDatabaseSnapshot2(snapshotPayload, verification.decoded.username, getClientIp(req));
  return res.status(result.success ? 200 : 400).json(result);
});
router20.get("/database/scheduled-backups", async (req, res) => {
  const { listOnDiskBackups: listOnDiskBackups2 } = await Promise.resolve().then(() => (init_serverBackupEngine(), serverBackupEngine_exports));
  const backups = listOnDiskBackups2();
  return res.json({ success: true, backups });
});
router20.post("/database/scheduled-backups/run-now", async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: "\u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  const verification = verifyAccessToken2(token);
  if (!verification.valid || !verification.decoded || verification.decoded.level > 2) {
    return res.status(403).json({ success: false, message: "\u062F\u0633\u062A\u0631\u0633\u06CC \u063A\u06CC\u0631\u0645\u062C\u0627\u0632" });
  }
  const { createFullDatabaseSnapshot: createFullDatabaseSnapshot2 } = await Promise.resolve().then(() => (init_serverBackupEngine(), serverBackupEngine_exports));
  const snapshot = await createFullDatabaseSnapshot2(verification.decoded.username, true);
  return res.json({
    success: true,
    message: `\u0646\u0633\u062E\u0647 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F (${snapshot.metadata.totalRecordsCount} \u0631\u06A9\u0648\u0631\u062F).`,
    metadata: snapshot.metadata
  });
});
router20.get("/audit-logs/verify-chain", async (req, res) => {
  try {
    const { verifyAuditChain: verifyAuditChain2 } = await Promise.resolve().then(() => (init_serverAuditChain(), serverAuditChain_exports));
    const logs = await serverQueryCollection("audit_logs");
    const result = verifyAuditChain2(Array.isArray(logs) ? logs : []);
    return res.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "\u062E\u0637\u0627 \u062F\u0631 \u0627\u0639\u062A\u0628\u0627\u0631\u0633\u0646\u062C\u06CC \u0632\u0646\u062C\u06CC\u0631\u0647 \u0644\u0627\u06AF\u200C\u0647\u0627";
    return res.status(500).json({ success: false, message });
  }
});
router20.get("/data/:collection", async (req, res) => {
  const { collection } = req.params;
  const token = extractToken(req);
  let callerUser = null;
  if (token) {
    const verification = verifyAccessToken2(token);
    if (verification.valid && verification.decoded) {
      callerUser = verification.decoded;
    }
  }
  const authCheck = authorizeCollectionAccess(callerUser, collection, "read");
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || "\u062F\u0633\u062A\u0631\u0633\u06CC \u063A\u06CC\u0631\u0645\u062C\u0627\u0632" });
  }
  try {
    const items = await serverQueryCollection(collection, callerUser);
    return res.json({ success: true, items });
  } catch (err) {
    logger.error(`Error querying collection ${collection}:`, err);
    return res.status(500).json({ success: false, message: "\u062E\u0637\u0627 \u062F\u0631 \u062F\u0631\u06CC\u0627\u0641\u062A \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0627\u0632 \u0633\u0631\u0648\u0631." });
  }
});
router20.get("/data/:collection/:id", async (req, res) => {
  const { collection, id } = req.params;
  const token = extractToken(req);
  let callerUser = null;
  if (token) {
    const verification = verifyAccessToken2(token);
    if (verification.valid && verification.decoded) {
      callerUser = verification.decoded;
    }
  }
  const authCheck = authorizeCollectionAccess(callerUser, collection, "read");
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || "\u062F\u0633\u062A\u0631\u0633\u06CC \u063A\u06CC\u0631\u0645\u062C\u0627\u0632" });
  }
  try {
    const item = await serverGetDocByCandidateIds(collection, [id], callerUser);
    if (!item) {
      return res.status(404).json({ success: false, message: "\u0631\u06A9\u0648\u0631\u062F \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
    }
    return res.json({ success: true, item });
  } catch (err) {
    logger.error(`Error querying document ${id} in ${collection}:`, err);
    return res.status(500).json({ success: false, message: "\u062E\u0637\u0627 \u062F\u0631 \u062F\u0631\u06CC\u0627\u0641\u062A \u0631\u06A9\u0648\u0631\u062F \u0627\u0632 \u0633\u0631\u0648\u0631." });
  }
});
router20.post("/data/:collection", async (req, res) => {
  const { collection } = req.params;
  const token = extractToken(req);
  let callerUser = null;
  if (token) {
    const verification = verifyAccessToken2(token);
    if (verification.valid && verification.decoded) {
      callerUser = verification.decoded;
    }
  }
  const data = req.body;
  const recordOwnerId = data?.userId || data?.studentId;
  const authCheck = authorizeCollectionAccess(callerUser, collection, "write", recordOwnerId);
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || "\u062F\u0633\u062A\u0631\u0633\u06CC \u063A\u06CC\u0631\u0645\u062C\u0627\u0632" });
  }
  try {
    const saveRes = await serverSaveDoc(collection, data, callerUser);
    if (!saveRes.success) {
      return res.status(500).json({ success: false, message: saveRes.error || "\u062E\u0637\u0627 \u062F\u0631 \u0630\u062E\u06CC\u0631\u0647\u200C\u0633\u0627\u0632\u06CC \u062F\u0627\u062F\u0647" });
    }
    if (callerUser) {
      logServerAudit2({
        userId: callerUser.userId,
        username: callerUser.username,
        userRole: callerUser.role,
        action: "DATA_WRITE",
        entityType: collection,
        entityId: saveRes.id,
        description: `\u062B\u0628\u062A \u06CC\u0627 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0631\u06A9\u0648\u0631\u062F \u062F\u0631 \u06A9\u0627\u0644\u06A9\u0634\u0646 ${collection} \u062A\u0648\u0633\u0637 ${callerUser.username}`,
        ipAddress: getClientIp(req)
      }).catch(() => {
      });
    }
    return res.json({ success: true, id: saveRes.id });
  } catch (err) {
    logger.error(`Error writing to collection ${collection}:`, err);
    return res.status(500).json({ success: false, message: "\u062E\u0637\u0627 \u062F\u0631 \u0630\u062E\u06CC\u0631\u0647 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062F\u0631 \u0633\u0631\u0648\u0631." });
  }
});
router20.put("/data/:collection/:id", async (req, res) => {
  const { collection, id } = req.params;
  const token = extractToken(req);
  let callerUser = null;
  if (token) {
    const verification = verifyAccessToken2(token);
    if (verification.valid && verification.decoded) {
      callerUser = verification.decoded;
    }
  }
  const data = { ...req.body, id };
  const recordOwnerId = data?.userId || data?.studentId;
  const authCheck = authorizeCollectionAccess(callerUser, collection, "write", recordOwnerId);
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || "\u062F\u0633\u062A\u0631\u0633\u06CC \u063A\u06CC\u0631\u0645\u062C\u0627\u0632" });
  }
  try {
    const saveRes = await serverSaveDoc(collection, data, callerUser);
    if (!saveRes.success) {
      return res.status(500).json({ success: false, message: saveRes.error || "\u062E\u0637\u0627 \u062F\u0631 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647" });
    }
    return res.json({ success: true, id: saveRes.id });
  } catch (err) {
    logger.error(`Error updating collection ${collection}:`, err);
    return res.status(500).json({ success: false, message: "\u062E\u0637\u0627 \u062F\u0631 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062F\u0631 \u0633\u0631\u0648\u0631." });
  }
});
router20.delete("/data/:collection/:id", async (req, res) => {
  const { collection, id } = req.params;
  const token = extractToken(req);
  let callerUser = null;
  if (token) {
    const verification = verifyAccessToken2(token);
    if (verification.valid && verification.decoded) {
      callerUser = verification.decoded;
    }
  }
  const authCheck = authorizeCollectionAccess(callerUser, collection, "delete");
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || "\u062F\u0633\u062A\u0631\u0633\u06CC \u063A\u06CC\u0631\u0645\u062C\u0627\u0632" });
  }
  try {
    const delRes = await serverDeleteDoc(collection, id, callerUser);
    if (!delRes.success) {
      return res.status(500).json({ success: false, message: delRes.error || "\u062E\u0637\u0627 \u062F\u0631 \u062D\u0630\u0641 \u062F\u0627\u062F\u0647" });
    }
    if (callerUser) {
      logServerAudit2({
        userId: callerUser.userId,
        username: callerUser.username,
        userRole: callerUser.role,
        action: "DATA_DELETE",
        entityType: collection,
        entityId: id,
        description: `\u062D\u0630\u0641 \u0631\u06A9\u0648\u0631\u062F ${id} \u0627\u0632 \u06A9\u0627\u0644\u06A9\u0634\u0646 ${collection} \u062A\u0648\u0633\u0637 ${callerUser.username}`,
        ipAddress: getClientIp(req)
      }).catch(() => {
      });
    }
    return res.json({ success: true, message: "\u0631\u06A9\u0648\u0631\u062F \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F." });
  } catch (err) {
    logger.error(`Error deleting from collection ${collection}:`, err);
    return res.status(500).json({ success: false, message: "\u062E\u0637\u0627 \u062F\u0631 \u062D\u0630\u0641 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062F\u0631 \u0633\u0631\u0648\u0631." });
  }
});
router20.post("/data/:collection/batch", async (req, res) => {
  const { collection } = req.params;
  const token = extractToken(req);
  let callerUser = null;
  if (token) {
    const verification = verifyAccessToken2(token);
    if (verification.valid && verification.decoded) {
      callerUser = verification.decoded;
    }
  }
  const authCheck = authorizeCollectionAccess(callerUser, collection, "write");
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || "\u062F\u0633\u062A\u0631\u0633\u06CC \u063A\u06CC\u0631\u0645\u062C\u0627\u0632" });
  }
  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, message: "\u0622\u06CC\u062A\u0645\u200C\u0647\u0627 \u0628\u0627\u06CC\u062F \u0622\u0631\u0627\u06CC\u0647\u200C\u0627\u06CC \u0628\u0627\u0634\u0646\u062F." });
  }
  try {
    for (const item of items) {
      await serverSaveDoc(collection, item, callerUser);
    }
    return res.json({ success: true, count: items.length });
  } catch (err) {
    logger.error(`Error batch saving ${collection}:`, err);
    return res.status(500).json({ success: false, message: "\u062E\u0637\u0627 \u062F\u0631 \u0630\u062E\u06CC\u0631\u0647 \u062F\u0633\u062A\u0647\u200C\u0627\u06CC \u0627\u0637\u0644\u0627\u0639\u0627\u062A." });
  }
});
router20.post("/system/save-background-image", async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "\u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
    }
    const verification = verifyAccessToken2(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ success: false, message: "\u062A\u0648\u06A9\u0646 \u0627\u0645\u0646\u06CC\u062A\u06CC \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A \u06CC\u0627 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A." });
    }
    const user = verification.decoded;
    const isSuperAdmin = user.role === "super_admin" || user.level === 1;
    if (!isSuperAdmin) {
      return res.status(403).json({ success: false, message: "\u062A\u0646\u0647\u0627 \u0633\u0648\u067E\u0631 \u0627\u062F\u0645\u06CC\u0646 (\u0633\u0637\u062D \u06F1) \u0645\u062C\u0627\u0632 \u0628\u0647 \u062A\u063A\u06CC\u06CC\u0631 \u062A\u0635\u0648\u06CC\u0631 \u067E\u0633\u200C\u0632\u0645\u06CC\u0646\u0647 \u0633\u06CC\u0633\u062A\u0645 \u0627\u0633\u062A." });
    }
    const { imageBase64, target } = req.body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ success: false, message: "\u062A\u0635\u0648\u06CC\u0631\u06CC \u0627\u0631\u0633\u0627\u0644 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." });
    }
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length > 500 * 1024) {
      return res.status(400).json({
        success: false,
        message: `\u062D\u062C\u0645 \u062A\u0635\u0648\u06CC\u0631 \u0627\u0631\u0633\u0627\u0644 \u0634\u062F\u0647 (${(buffer.length / 1024).toFixed(1)}KB) \u0628\u06CC\u0634 \u0627\u0632 \u062D\u062F \u0645\u062C\u0627\u0632 \u06F5\u06F0\u06F0 \u06A9\u06CC\u0644\u0648\u0628\u0627\u06CC\u062A \u0627\u0633\u062A.`
      });
    }
    if (buffer.length < 12) {
      return res.status(400).json({ success: false, message: "\u0641\u0631\u0645\u062A \u062A\u0635\u0648\u06CC\u0631 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A." });
    }
    const isRiff = buffer.toString("ascii", 0, 4) === "RIFF";
    const isWebp = buffer.toString("ascii", 8, 12) === "WEBP";
    if (!isRiff || !isWebp) {
      return res.status(400).json({ success: false, message: "\u0641\u0642\u0637 \u062A\u0635\u0627\u0648\u06CC\u0631 \u0628\u0627 \u0641\u0631\u0645\u062A \u0648\u0627\u0642\u0639\u06CC WebP \u0645\u062C\u0627\u0632 \u0645\u06CC\u200C\u0628\u0627\u0634\u0646\u062F." });
    }
    const filename = target === "mobile" ? "000-mobile.webp" : "000.webp";
    const publicDir = import_path4.default.join(process.cwd(), "public");
    if (!import_fs4.default.existsSync(publicDir)) {
      import_fs4.default.mkdirSync(publicDir, { recursive: true });
    }
    import_fs4.default.writeFileSync(import_path4.default.join(publicDir, filename), buffer);
    return res.json({ success: true, message: `\u062A\u0635\u0648\u06CC\u0631 \u067E\u0633\u200C\u0632\u0645\u06CC\u0646\u0647 (${filename}) \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.` });
  } catch (e) {
    const message = e instanceof Error ? e.message : "\u062E\u0637\u0627 \u062F\u0631 \u0630\u062E\u06CC\u0631\u0647 \u062A\u0635\u0648\u06CC\u0631";
    return res.status(500).json({ success: false, message });
  }
});
router20.post("/bug-reports", async (req, res) => {
  try {
    const { title, description, severity, pageUrl, browserInfo, osInfo, userAgent, userId, userName } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: "\u0639\u0646\u0648\u0627\u0646 \u0648 \u0634\u0631\u062D \u062F\u0642\u06CC\u0642 \u062E\u0637\u0627 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
    }
    const reportId = "bug_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    const newBug = {
      id: reportId,
      title: String(title).trim(),
      description: String(description).trim(),
      severity: severity || "medium",
      status: "open",
      pageUrl: pageUrl || "/",
      browserInfo: browserInfo || "Unknown",
      osInfo: osInfo || "Unknown",
      userAgent: userAgent || "",
      userId: userId || "anonymous",
      userName: userName || "\u06A9\u0627\u0631\u0628\u0631 \u0646\u0627\u0634\u0646\u0627\u0633",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await serverSaveDoc("bug_reports", newBug);
    logger.warn(`[BUG REPORTED] ${title} (${severity}) by ${userName || "user"} on ${pageUrl}`);
    return res.status(201).json({ success: true, message: "\u06AF\u0632\u0627\u0631\u0634 \u062E\u0637\u0627 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.", reportId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "\u062E\u0637\u0627 \u062F\u0631 \u062B\u0628\u062A \u06AF\u0632\u0627\u0631\u0634";
    return res.status(500).json({ success: false, message });
  }
});
router20.get("/bug-reports", async (req, res) => {
  try {
    const items = await serverQueryCollection("bug_reports");
    return res.json({ success: true, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "\u062E\u0637\u0627 \u062F\u0631 \u062F\u0631\u06CC\u0627\u0641\u062A \u06AF\u0632\u0627\u0631\u0634\u200C\u0647\u0627";
    return res.status(500).json({ success: false, message });
  }
});
router20.get("/sync/events", async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "\u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  }
  const verification = verifyAccessToken2(token);
  if (!verification.valid) {
    return res.status(401).json({ success: false, message: "\u0646\u0634\u0633\u062A \u0634\u0645\u0627 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A." });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
  const { registerRealtimeListener: registerRealtimeListener2 } = await Promise.resolve().then(() => (init_serverDataApi(), serverDataApi_exports));
  const unsubscribe = registerRealtimeListener2((event) => {
    try {
      res.write(`event: data_change
data: ${JSON.stringify(event)}

`);
    } catch (e) {
    }
  });
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch (e) {
    }
  }, 2e4);
  req.on("close", () => {
    unsubscribe();
    clearInterval(heartbeat);
  });
});
router20.get("/sync/changes", async (_req, res) => {
  return res.json({ success: true, changes: [] });
});
var dataRoutes_default = router20;

// src/routes/systemRoutes.ts
var import_express21 = require("express");
init_serverAuth();
init_systemHealthMonitor();
init_databaseAbstraction();
var router21 = (0, import_express21.Router)();
var extractToken2 = (req) => {
  if (req.cookies && req.cookies.auth_access_token) {
    return req.cookies.auth_access_token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
};
router21.get("/health", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  try {
    const token = extractToken2(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "\u062A\u0648\u06A9\u0646 \u0627\u0645\u0646\u06CC\u062A\u06CC \u0645\u0639\u062A\u0628\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
    }
    const verification = verifyAccessToken2(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ success: false, message: "\u0627\u0639\u062A\u0628\u0627\u0631 \u062C\u0644\u0633\u0647 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A." });
    }
    const user = verification.decoded;
    const usernameUpper = (user.username || "").toUpperCase();
    const isSuperAdmin = user.role === "super_admin" || user.level === 1 || user.role === "school_manager" || usernameUpper === "SADEGH";
    const isEducationManager = user.role === "education_manager" || user.role === "education_officer" || usernameUpper === "SHAH" || user.name && user.name.includes("\u0622\u0645\u0648\u0632\u0634");
    const isFinanceManager = user.role === "finance_manager" || user.role === "finance_officer" || usernameUpper === "MALI" || user.name && user.name.includes("\u0645\u0627\u0644\u06CC");
    const hasExplicitTab = Array.isArray(user.allowedTabs) && user.allowedTabs.includes("system-health");
    const isAuthorized = isSuperAdmin || isEducationManager || isFinanceManager || hasExplicitTab;
    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: "\u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u067E\u0627\u06CC\u0634 \u0633\u0644\u0627\u0645\u062A \u0633\u06CC\u0633\u062A\u0645 \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u0633\u0648\u067E\u0631 \u0627\u062F\u0645\u06CC\u0646\u060C \u0645\u0633\u0626\u0648\u0644 \u0622\u0645\u0648\u0632\u0634 \u0648 \u0645\u0633\u0626\u0648\u0644 \u0645\u0627\u0644\u06CC \u0645\u062C\u0627\u0632 \u0627\u0633\u062A." });
    }
    await recordMemorySnapshot();
    const report = getSystemHealthReport();
    return res.json({
      success: true,
      ...report
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "\u062E\u0637\u0627 \u062F\u0631 \u062F\u0631\u06CC\u0627\u0641\u062A \u0648\u0636\u0639\u06CC\u062A \u0633\u0644\u0627\u0645\u062A \u0633\u06CC\u0633\u062A\u0645";
    return res.status(500).json({ success: false, message });
  }
});
router21.get("/db-status", async (_req, res) => {
  await testMysqlConnection();
  const status = getDbConnectionStatus();
  return res.json({
    success: true,
    connected: status.connected
  });
});
var systemRoutes_default = router21;

// src/routes/auditRoutes.ts
var import_express22 = require("express");
init_databaseAbstraction();
init_serverAuth();
var router22 = (0, import_express22.Router)();
function extractCaller(req) {
  let token = req.cookies?.auth_access_token;
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.substring(7);
  }
  if (token) {
    const verified = verifyAccessToken2(token);
    if (verified.valid && verified.decoded) {
      return verified.decoded;
    }
  }
  return null;
}
function requireAdminRole(req, res, next) {
  const caller = extractCaller(req);
  if (!caller) {
    return res.status(401).json({ success: false, message: "\u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  }
  const isAuthorized = caller.level === 1 || caller.role === "super_admin" || caller.role === "school_manager" || caller.username && caller.username.toUpperCase() === "SADEGH";
  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: "\u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0644\u0627\u06AF\u200C\u0647\u0627\u06CC \u0633\u06CC\u0633\u062A\u0645 \u0645\u0646\u062D\u0635\u0631\u0627\u064B \u062F\u0631 \u0627\u062E\u062A\u06CC\u0627\u0631 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0627\u0633\u062A." });
  }
  req.user = caller;
  next();
}
router22.get("/logs", requireAdminRole, async (req, res) => {
  try {
    const pool2 = getMysqlPool();
    if (!pool2) {
      return res.status(500).json({ success: false, message: "\u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A." });
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10), 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset || "0"), 10), 0);
    const action = req.query.action ? String(req.query.action).trim() : null;
    const collection = req.query.collection ? String(req.query.collection).trim() : null;
    const userId = req.query.user_id ? String(req.query.user_id).trim() : null;
    const status = req.query.status ? String(req.query.status).trim() : null;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const whereConditions = [];
    const params = [];
    if (action) {
      whereConditions.push("action = ?");
      params.push(action);
    }
    if (collection) {
      whereConditions.push("collection_name = ?");
      params.push(collection);
    }
    if (userId) {
      whereConditions.push("(user_id = ? OR user_name LIKE ?)");
      params.push(userId, `%${userId}%`);
    }
    if (status) {
      whereConditions.push("status = ?");
      params.push(status);
    }
    if (search) {
      whereConditions.push("(record_id LIKE ? OR user_name LIKE ? OR error_message LIKE ? OR details LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";
    const countSql = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
    const [countRows] = await pool2.execute(countSql, params);
    const total = countRows?.[0]?.total || 0;
    const dataSql = `
      SELECT id, action, collection_name, record_id, user_id, user_name, user_role, details, ip_address, status, error_message, created_at
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool2.execute(dataSql, [...params, String(limit), String(offset)]);
    const items = (rows || []).map((r) => {
      let detailsParsed = r.details;
      if (typeof r.details === "string") {
        try {
          detailsParsed = JSON.parse(r.details);
        } catch (e) {
        }
      }
      return {
        ...r,
        details: detailsParsed
      };
    });
    return res.json({
      success: true,
      items,
      total,
      limit,
      offset
    });
  } catch (err) {
    console.error("[AuditRoutes GET /logs error]:", err);
    return res.status(500).json({ success: false, message: err?.message || "\u062E\u0637\u0627 \u062F\u0631 \u062F\u0631\u06CC\u0627\u0641\u062A \u0644\u0627\u06AF\u200C\u0647\u0627\u06CC \u0633\u06CC\u0633\u062A\u0645." });
  }
});
router22.get("/stats", requireAdminRole, async (_req, res) => {
  try {
    const pool2 = getMysqlPool();
    if (!pool2) {
      return res.status(500).json({ success: false, message: "\u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A." });
    }
    const [totalRows] = await pool2.execute(`SELECT COUNT(*) as total FROM audit_logs`);
    const [todayRows] = await pool2.execute(`SELECT COUNT(*) as today FROM audit_logs WHERE created_at >= DATE(NOW())`);
    const [errorRows] = await pool2.execute(`SELECT COUNT(*) as errors FROM audit_logs WHERE status = 'error' OR status = 'failed'`);
    const [actionRows] = await pool2.execute(`
      SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action ORDER BY count DESC LIMIT 10
    `);
    const total = totalRows?.[0]?.total || 0;
    const today = todayRows?.[0]?.today || 0;
    const errors = errorRows?.[0]?.errors || 0;
    const successRate = total > 0 ? Math.round((total - errors) / total * 100) : 100;
    return res.json({
      success: true,
      stats: {
        total,
        today,
        errors,
        successRate,
        actions: actionRows || []
      }
    });
  } catch (err) {
    console.error("[AuditRoutes GET /stats error]:", err);
    return res.status(500).json({ success: false, message: err?.message || "\u062E\u0637\u0627 \u062F\u0631 \u062F\u0631\u06CC\u0627\u0641\u062A \u0622\u0645\u0627\u0631 \u0644\u0627\u06AF\u200C\u0647\u0627." });
  }
});
router22.post("/cleanup", requireAdminRole, async (_req, res) => {
  try {
    const pool2 = getMysqlPool();
    if (!pool2) {
      return res.status(500).json({ success: false, message: "\u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A." });
    }
    const [result] = await pool2.execute(`
      DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
    const deletedCount = result?.affectedRows || 0;
    return res.json({
      success: true,
      message: `\u062A\u0639\u062F\u0627\u062F ${deletedCount} \u0644\u0627\u06AF \u0642\u062F\u06CC\u0645\u06CC\u200C\u062A\u0631 \u0627\u0632 \u06F3\u06F0 \u0631\u0648\u0632 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u067E\u0627\u06A9\u0633\u0627\u0632\u06CC \u0634\u062F\u0646\u062F.`,
      deletedCount
    });
  } catch (err) {
    console.error("[AuditRoutes POST /cleanup error]:", err);
    return res.status(500).json({ success: false, message: err?.message || "\u062E\u0637\u0627 \u062F\u0631 \u067E\u0627\u06A9\u0633\u0627\u0632\u06CC \u0644\u0627\u06AF\u200C\u0647\u0627\u06CC \u0642\u062F\u06CC\u0645\u06CC." });
  }
});
router22.post("/revert", requireAdminRole, async (req, res) => {
  try {
    const { logId, revertedBy } = req.body || {};
    const { revertAuditActivity: revertAuditActivity2 } = await Promise.resolve().then(() => (init_auditLogger(), auditLogger_exports));
    const caller = req.user;
    const userName = revertedBy || caller?.username || caller?.name || "\u0645\u062F\u06CC\u0631 \u0633\u0627\u0645\u0627\u0646\u0647";
    const result = await revertAuditActivity2(logId, userName);
    return res.json(result);
  } catch (err) {
    console.error("[AuditRoutes POST /revert error]:", err);
    return res.status(500).json({ success: false, message: err?.message || "\u062E\u0637\u0627 \u062F\u0631 \u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u06CC \u0639\u0645\u0644\u06CC\u0627\u062A." });
  }
});
var auditRoutes_default = router22;

// server.ts
init_logger();

// src/lib/memoryMonitor.ts
init_logger();
function getMemoryStats() {
  const mem = process.memoryUsage();
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100;
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100;
  const rssMb = Math.round(mem.rss / 1024 / 1024 * 100) / 100;
  const externalMb = Math.round(mem.external / 1024 / 1024 * 100) / 100;
  const heapUsagePercent = Math.round(heapUsedMb / heapTotalMb * 100);
  return {
    rssMb,
    heapTotalMb,
    heapUsedMb,
    externalMb,
    heapUsagePercent,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var monitorInterval = null;
function startMemoryMonitor(intervalMs = 5 * 60 * 1e3, warningThresholdMb = 450) {
  if (monitorInterval) clearInterval(monitorInterval);
  logger.info(`[MemoryMonitor] Initialized. Checking memory footprint every ${intervalMs / 1e3}s.`);
  monitorInterval = setInterval(() => {
    const stats = getMemoryStats();
    if (stats.heapUsedMb > warningThresholdMb) {
      logger.warn(`[MemoryMonitor] High memory usage detected: ${stats.heapUsedMb} MB used out of ${stats.heapTotalMb} MB total (${stats.heapUsagePercent}%)`, stats);
      if (typeof global.gc === "function") {
        logger.info("[MemoryMonitor] Triggering manual V8 Garbage Collection...");
        global.gc();
      }
    } else {
      logger.debug("[MemoryMonitor] Memory footprint normal", stats);
    }
  }, intervalMs);
  if (monitorInterval.unref) monitorInterval.unref();
}

// server.ts
init_systemHealthMonitor();

// src/lib/buildInfo.ts
var BUILD_INFO = {
  "version": "v1.0.2-secure",
  "buildTime": "2026-10-07T22:32:36.003Z",
  "features": [
    "version-endpoint",
    "hardcoded-secrets-removed"
  ]
};

// server.ts
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Promise Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err);
});
import_dotenv3.default.config();
var PORT = parseInt(process.env.PORT || "3000", 10);
async function startServer() {
  const app = (0, import_express23.default)();
  app.set("trust proxy", 1);
  app.use((0, import_helmet.default)({ contentSecurityPolicy: false }));
  app.use((0, import_cors.default)({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-TOKEN"]
  }));
  app.use((0, import_compression.default)({
    filter: (req, res) => {
      if (req.headers["accept"] === "text/event-stream" || req.path.includes("/sync/events")) {
        return false;
      }
      return import_compression.default.filter(req, res);
    }
  }));
  app.use(import_express23.default.json({ limit: "50mb" }));
  app.use(import_express23.default.urlencoded({ extended: true, limit: "50mb" }));
  app.use((0, import_cookie_parser.default)());
  app.use(requestLogger);
  app.get("/api/version", (_req, res) => {
    res.json({
      commit: BUILD_INFO.version,
      buildTime: BUILD_INFO.buildTime,
      features: BUILD_INFO.features,
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      env: process.env.NODE_ENV || "production",
      startTime: new Date(Date.now() - process.uptime() * 1e3).toISOString()
    });
  });
  app.get("/api/healthz", (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });
  app.use("/api/auth", authRoutes_default);
  app.use("/api/students", studentRoutes_default);
  app.use("/api/teachers", teacherRoutes_default);
  app.use("/api/programs", programRoutes_default);
  app.use("/api/classrooms", classroomRoutes_default);
  app.use("/api/tuition", tuitionRoutes_default);
  app.use("/api/loans", loanRoutes_default);
  app.use("/api/expenses", expenseRoutes_default);
  app.use("/api/attendance", attendanceRoutes_default);
  app.use("/api/study", studyRoutes_default);
  app.use("/api/research", researchRoutes_default);
  app.use("/api/oral-exams", oralExamRoutes_default);
  app.use("/api/lockers", lockerRoutes_default);
  app.use("/api/calendar", calendarRoutes_default);
  app.use("/api/meals", mealRoutes_default);
  app.use("/api/requests", studentRequestRoutes_default);
  app.use("/api/transport", transportRoutes_default);
  app.use("/api/course-selection", courseSelectionRoutes_default);
  app.use("/api/counseling", counselingRoutes_default);
  app.use("/api/system", systemRoutes_default);
  app.use("/api/audit", auditRoutes_default);
  app.use("/api", dataRoutes_default);
  app.get("/health", (_req, res) => {
    try {
      const memory = process.memoryUsage();
      return res.status(200).json({
        status: "ok",
        uptime: Math.floor(process.uptime()),
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        version: "1.0.1",
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || "development",
        memory: {
          rssMb: Math.round(memory.rss / 1024 / 1024 * 100) / 100,
          heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100,
          heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100
        },
        services: {
          mysqlConfigured: Boolean(process.env.MYSQL_DATABASE || process.env.DB_DATABASE),
          supabaseConfigured: Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_SECRET_KEY)
        }
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Health check failed";
      return res.status(503).json({ status: "error", message });
    }
  });
  app.use(import_express23.default.static(import_path5.default.join(process.cwd(), "public")));
  const distPath = import_path5.default.join(process.cwd(), "dist");
  const hasDist = import_fs5.default.existsSync(distPath) && import_fs5.default.existsSync(import_path5.default.join(distPath, "index.html"));
  if (hasDist || process.env.NODE_ENV === "production") {
    app.use(import_express23.default.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.includes("/assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith("index.html") || filePath.endsWith("sw.js") || filePath.endsWith("manifest.webmanifest")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      }
    }));
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      const indexPath = import_path5.default.join(distPath, "index.html");
      if (import_fs5.default.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send("<!DOCTYPE html><html><body><h1>\u0633\u06CC\u0633\u062A\u0645 \u062F\u0631 \u062D\u0627\u0644 \u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC \u0627\u0648\u0644\u06CC\u0647 \u0627\u0633\u062A...</h1><p>\u0644\u0637\u0641\u0627\u064B \u0686\u0646\u062F \u0644\u062D\u0638\u0647 \u062F\u06CC\u06AF\u0631 \u0635\u0641\u062D\u0647 \u0631\u0627 \u062A\u0627\u0632\u0647\u200C\u0633\u0627\u0632\u06CC \u0646\u0645\u0627\u06CC\u06CC\u062F.</p></body></html>");
      }
    });
  } else {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (vErr) {
      console.warn("[Vite Dev Server Notice]:", vErr);
    }
  }
  app.use(globalErrorHandler);
  console.log("BOOT", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    version: process.env.GIT_COMMIT || "unknown",
    nodeVersion: process.version,
    port: PORT
  });
  const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`[Production Server] running on http://0.0.0.0:${PORT}`);
    [80, 8080, 3e3].forEach((auxPort) => {
      if (auxPort !== PORT) {
        try {
          const auxServer = app.listen(auxPort, "0.0.0.0", () => {
            logger.info(`[Production Server] Auxiliary listener active on http://0.0.0.0:${auxPort}`);
          });
          auxServer.on("error", (err) => {
            if (err.code !== "EACCES" && err.code !== "EADDRINUSE") {
              logger.warn(`[Auxiliary Port ${auxPort}]:`, err?.message || err);
            }
          });
        } catch (e) {
        }
      }
    });
    (async () => {
      try {
        const { isMysqlConfigured: isMysqlConfigured2, validateMysqlConfig: validateMysqlConfig2, testMysqlConnection: testMysqlConnection2, ensurePerformanceIndexes: ensurePerformanceIndexes2 } = await Promise.resolve().then(() => (init_databaseAbstraction(), databaseAbstraction_exports));
        if (isMysqlConfigured2) {
          console.log("[Startup] Validating MySQL Configuration...");
          const validation = validateMysqlConfig2();
          if (validation.isValid) {
            console.log("[Startup] Testing MySQL Connection...");
            const isOk = await testMysqlConnection2();
            if (isOk) {
              console.log("[Startup] MySQL connected successfully! Creating schemas/indexes...");
              await ensurePerformanceIndexes2();
            } else {
              console.error("[Startup Error] MySQL database is not reachable right now. Server will start, but db-status endpoint should be checked.");
            }
          } else {
            console.error("[Startup Error] MySQL configuration is invalid. Please check your environment variables.");
          }
        }
      } catch (idxErr) {
        logger.warn("[Startup] Database initialization notice:", idxErr?.message || idxErr);
      }
    })();
    startMemoryMonitor(5 * 60 * 1e3, 450);
    startSystemHealthMonitor(10 * 60 * 1e3);
    Promise.resolve().then(() => (init_serverBackupEngine(), serverBackupEngine_exports)).then((mod) => {
      mod.initScheduledBackupService();
      logger.info("[System] Automated database backup scheduler initialized.");
    }).catch(() => {
    });
    setInterval(async () => {
      try {
        const { getMysqlPool: getMysqlPool2 } = await Promise.resolve().then(() => (init_databaseAbstraction(), databaseAbstraction_exports));
        const pool2 = getMysqlPool2();
        if (pool2) {
          const [res] = await pool2.execute(`DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`);
          logger.info(`[Audit Cron] Automated 30-day cleanup purged ${res?.affectedRows || 0} old audit logs.`);
        }
      } catch (e) {
        logger.warn("[Audit Cron Notice] Automated cleanup notice:", e);
      }
    }, 24 * 60 * 60 * 1e3);
  });
  const handleShutdown = (signal) => {
    logger.warn(`[Process] Received ${signal}. Starting graceful shutdown...`);
    server.close(() => {
      logger.info("[Process] HTTP server closed gracefully.");
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("[Process] Forcefully terminating server after timeout.");
      process.exit(1);
    }, 1e4);
  };
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}
process.on("uncaughtException", (error) => {
  logger.error("[CRITICAL FATAL EXCEPTION]", error);
});
process.on("unhandledRejection", (reason) => {
  logger.error("[CRITICAL UNHANDLED REJECTION]", reason);
});
startServer();
