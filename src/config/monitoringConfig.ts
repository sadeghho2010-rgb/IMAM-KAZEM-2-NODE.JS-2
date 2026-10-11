/**
 * Central Monitoring Configuration
 * Lightweight, non-intrusive thresholds and policies.
 * Designed for 2GB RAM / 3GB Disk environment (Runflare & Cloudflare).
 */

export const monitoringConfig = {
  // Retention & Storage limits
  retentionDays: 14,             // Purge events older than 14 days
  maxTotalEvents: 20000,         // Absolute max rows in mon_events to keep disk under control
  cleanupIntervalMs: 24 * 60 * 60 * 1000, // Run cleanup once every 24 hours

  // Performance thresholds
  slowRequestThresholdMs: 1200,  // Requests taking > 1.2s are flagged as slow
  slowQueryThresholdMs: 800,     // Database queries taking > 800ms are flagged as slow

  // Noise filter: paths that must NEVER be logged as slow or failed (unless 5xx)
  noisePaths: [
    '/api/sync/events',
    '/api/system/health',
    '/api/system/db-status',
    '/favicon.ico',
    '/api/monitor/events',       // Do not log the monitoring endpoint itself
  ],

  // Rate limiting for client events
  clientEventMaxPerMinute: 20,
  clientEventDebounceMs: 60 * 1000, // 60s debounce for identical fingerprints

  // Payload caps
  maxShortMessageLength: 500,
  maxStackLines: 10,
  maxMetadataBytes: 2048,
};
