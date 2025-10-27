/**
 * High-performance logger with optimizations for the Agnost Analytics SDK
 */

// Performance-optimized logger with cached timestamps and log levels
let cachedTimestamp = '';
let lastTimestampUpdate = 0;

const getCachedTimestamp = (): string => {
  const now = Date.now();
  // Update timestamp cache every 100ms to balance performance and accuracy
  if (now - lastTimestampUpdate > 100) {
    cachedTimestamp = new Date(now).toISOString();
    lastTimestampUpdate = now;
  }
  return cachedTimestamp;
};

// Log level control (can be set via environment variable)
const LOG_LEVEL = process.env.AGNOST_LOG_LEVEL || 'info';
const LOG_LEVELS = { debug: 0, info: 1, warning: 2, error: 3 };
const currentLogLevel = LOG_LEVELS[LOG_LEVEL as keyof typeof LOG_LEVELS] ?? 0;

export const logger = {
  debug: (message: string) => {
    if (currentLogLevel <= LOG_LEVELS.debug) {
      console.error(`[Agnost Analytics DEBUG] ${getCachedTimestamp()} - ${message}`);
    }
  },
  info: (message: string) => {
    if (currentLogLevel <= LOG_LEVELS.info) {
      console.error(`[Agnost Analytics INFO] ${getCachedTimestamp()} - ${message}`);
    }
  },
  warning: (message: string) => {
    if (currentLogLevel <= LOG_LEVELS.warning) {
      console.error(`[Agnost Analytics WARN] ${getCachedTimestamp()} - ${message}`);
    }
  },
  error: (message: string) => {
    console.error(`[Agnost Analytics ERROR] ${getCachedTimestamp()} - ${message}`);
  }
};