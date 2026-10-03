import { logger } from './logger';

export interface MemoryStats {
  rssMb: number;
  heapTotalMb: number;
  heapUsedMb: number;
  externalMb: number;
  heapUsagePercent: number;
  timestamp: string;
}

export function getMemoryStats(): MemoryStats {
  const mem = process.memoryUsage();
  const heapTotalMb = Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100;
  const heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;
  const rssMb = Math.round((mem.rss / 1024 / 1024) * 100) / 100;
  const externalMb = Math.round((mem.external / 1024 / 1024) * 100) / 100;
  const heapUsagePercent = Math.round((heapUsedMb / heapTotalMb) * 100);

  return {
    rssMb,
    heapTotalMb,
    heapUsedMb,
    externalMb,
    heapUsagePercent,
    timestamp: new Date().toISOString(),
  };
}

let monitorInterval: NodeJS.Timeout | null = null;

export function startMemoryMonitor(intervalMs = 5 * 60 * 1000, warningThresholdMb = 450) {
  if (monitorInterval) clearInterval(monitorInterval);

  logger.info(`[MemoryMonitor] Initialized. Checking memory footprint every ${intervalMs / 1000}s.`);

  monitorInterval = setInterval(() => {
    const stats = getMemoryStats();

    if (stats.heapUsedMb > warningThresholdMb) {
      logger.warn(`[MemoryMonitor] High memory usage detected: ${stats.heapUsedMb} MB used out of ${stats.heapTotalMb} MB total (${stats.heapUsagePercent}%)`, stats);
      
      // If garbage collection is exposed via node flag --expose-gc
      if (typeof global.gc === 'function') {
        logger.info('[MemoryMonitor] Triggering manual V8 Garbage Collection...');
        global.gc();
      }
    } else {
      logger.debug('[MemoryMonitor] Memory footprint normal', stats);
    }
  }, intervalMs);

  // Do not prevent process from exiting
  if (monitorInterval.unref) monitorInterval.unref();
}

export function stopMemoryMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
