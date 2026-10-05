import { logger } from './logger';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface MemorySnapshot {
  timestamp: string;
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  externalMb: number;
  freeOsMemInfo?: string;
}

export interface CpuSnapshot {
  percent: number;
  cores: number;
  model: string;
  loadAvg: number[];
}

export interface SlowQueryLog {
  timestamp: string;
  collection: string;
  durationMs: number;
  querySnippet: string;
}

export interface ServerErrorLog {
  timestamp: string;
  message: string;
  stack?: string;
  source?: string;
}

const logDir = path.join(process.cwd(), 'logs');
const memoryLogFile = path.join(logDir, 'memory.log');
const slowQueryLogFile = path.join(logDir, 'slow_queries.log');
const errorLogFile = path.join(logDir, 'error.log');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// CPU usage tracking state
let previousCpus = os.cpus();

export function getCpuUsage(): CpuSnapshot {
  try {
    const currentCpus = os.cpus();
    const cores = currentCpus.length || 1;
    const model = currentCpus[0]?.model || 'پردازنده اصلی';
    const rawLoadAvg = os.loadavg() || [0, 0, 0];
    const loadAvg = rawLoadAvg.map(l => Math.round(l * 100) / 100);

    let totalIdle = 0;
    let totalTick = 0;

    for (let i = 0; i < cores; i++) {
      const prev = previousCpus[i] || currentCpus[i];
      const curr = currentCpus[i];
      if (!prev || !curr) continue;

      for (const type in curr.times) {
        totalTick += (curr.times as any)[type] - (prev.times as any)[type];
      }
      totalIdle += curr.times.idle - prev.times.idle;
    }

    previousCpus = currentCpus;

    const idlePercent = totalTick > 0 ? (totalIdle / totalTick) : 1;
    let percent = Math.round((1 - idlePercent) * 100);

    // Fallback using load average if tick delta was 0
    if (totalTick === 0 && loadAvg && loadAvg[0] !== undefined && cores > 0) {
      percent = Math.min(100, Math.round((loadAvg[0] / cores) * 100));
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
      model: 'CPU',
      loadAvg: [0, 0, 0]
    };
  }
}

// Get free OS memory via free -h if linux available
function getOsMemoryInfo(): Promise<string> {
  return new Promise((resolve) => {
    exec('free -h', (error, stdout) => {
      if (error || !stdout) {
        return resolve('اطلاعات RAM سیستم عامل قابل دریافت نیست.');
      }
      resolve(stdout.trim());
    });
  });
}

// Helper to read the last N lines of a log file and parse them as JSON objects
function readLastLogEntries<T = any>(filePath: string, maxEntries: number): T[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    
    // Take the last N lines
    const lastLines = lines.slice(-maxEntries);
    
    const parsedEntries: T[] = [];
    for (const line of lastLines) {
      try {
        parsedEntries.push(JSON.parse(line));
      } catch (err) {
        // Fallback for non-JSON or malformed log lines
        parsedEntries.push({
          timestamp: new Date().toISOString(),
          message: line
        } as any);
      }
    }
    
    // Return newest first for tables, or keep natural order for charts
    return parsedEntries;
  } catch (err) {
    console.error(`Error reading log file ${filePath}:`, err);
    return [];
  }
}

// Record memory snapshot to file
export async function recordMemorySnapshot(): Promise<MemorySnapshot> {
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;
  const heapTotalMb = Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100;
  const rssMb = Math.round((mem.rss / 1024 / 1024) * 100) / 100;
  const externalMb = Math.round((mem.external / 1024 / 1024) * 100) / 100;

  const freeOsMemInfo = await getOsMemoryInfo();

  const snapshot: MemorySnapshot = {
    timestamp: new Date().toISOString(),
    heapUsedMb,
    heapTotalMb,
    rssMb,
    externalMb,
    freeOsMemInfo
  };

  try {
    // Append JSON line to memory.log
    fs.appendFileSync(memoryLogFile, JSON.stringify(snapshot) + '\n', 'utf-8');
    
    // Maintain max size of memory.log file (approx 1440 lines = 10 days of logging)
    const stats = fs.statSync(memoryLogFile);
    if (stats.size > 2 * 1024 * 1024) { // 2MB
      const content = fs.readFileSync(memoryLogFile, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      if (lines.length > 500) {
        fs.writeFileSync(memoryLogFile, lines.slice(-288).join('\n') + '\n', 'utf-8');
      }
    }
  } catch (err) {
    console.error('Failed to write to memory.log:', err);
  }

  return snapshot;
}

// Intercept and persist slow queries (>1000ms) to slow_queries.log
export function logSlowQuery(collection: string, durationMs: number, querySnippet: string) {
  if (durationMs < 1000) return;

  const entry: SlowQueryLog = {
    timestamp: new Date().toISOString(),
    collection: collection || 'General DB',
    durationMs: Math.round(durationMs),
    querySnippet: querySnippet ? querySnippet.substring(0, 300) : 'N/A'
  };

  try {
    fs.appendFileSync(slowQueryLogFile, JSON.stringify(entry) + '\n', 'utf-8');
    logger.warn(`[SlowQuery] ${collection} query took ${durationMs}ms: ${entry.querySnippet}`);
  } catch (err) {
    console.error('Failed to log slow query:', err);
  }
}

// Intercept and log server errors
export function logServerError(message: string, stack?: string, source?: string) {
  // Errors are handled and written to logs/error.log by winston logger transport.
  // We can also log to Console or Winston here
  logger.error(`[ServerErrorLog] ${message}`, { source, stack });
}

let monitorTimer: NodeJS.Timeout | null = null;

// Start automated background system health monitoring (every 10 minutes)
export function startSystemHealthMonitor(intervalMs = 10 * 60 * 1000) {
  if (monitorTimer) clearInterval(monitorTimer);

  // Take initial snapshot
  recordMemorySnapshot().catch(() => {});

  monitorTimer = setInterval(() => {
    recordMemorySnapshot().catch(() => {});
  }, intervalMs);

  if (monitorTimer.unref) monitorTimer.unref();
  logger.info('[SystemHealthMonitor] Automated 10-min memory logger to file initialized.');
}

// Get full system health report
export function getSystemHealthReport() {
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;
  const heapTotalMb = Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100;
  const rssMb = Math.round((mem.rss / 1024 / 1024) * 100) / 100;
  const externalMb = Math.round((mem.external / 1024 / 1024) * 100) / 100;

  // 1. Read last 144 memory history entries (last 24 hours at 10-minute intervals)
  const memoryHistory = readLastLogEntries<MemorySnapshot>(memoryLogFile, 144);

  // Calculate 24h peak heap usage
  let peakHeap24hMb = heapUsedMb;
  for (const s of memoryHistory) {
    if (s.heapUsedMb > peakHeap24hMb) {
      peakHeap24hMb = s.heapUsedMb;
    }
  }

  // 2. Read last 20 slow queries
  const slowQueries = readLastLogEntries<SlowQueryLog>(slowQueryLogFile, 20).reverse(); // Newest first

  // 3. Read last 20 errors from error.log (winston)
  const rawErrors = readLastLogEntries<any>(errorLogFile, 20).reverse(); // Newest first
  const recentErrors: ServerErrorLog[] = rawErrors.map((err: any) => ({
    timestamp: err.timestamp || new Date().toISOString(),
    message: err.message || JSON.stringify(err),
    stack: err.stack,
    source: err.service || 'madrasah-backend'
  }));

  const freeOsMemInfo = memoryHistory[memoryHistory.length - 1]?.freeOsMemInfo || 'اطلاعات موجود نیست';
  const currentCpu = getCpuUsage();

  return {
    currentMemory: {
      heapUsedMb,
      heapTotalMb,
      rssMb,
      externalMb,
      heapUsagePercent: Math.round((heapUsedMb / heapTotalMb) * 100),
      freeOsMemInfo
    },
    currentCpu,
    peakHeap24hMb,
    memoryHistory,
    slowQueries,
    recentErrors,
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  };
}
