/**
 * Agnost Analytics SDK for MCP Integration.
 *
 * This module provides a structured, performance-optimized client for tracking
 * and analyzing MCP server interactions.
 */

// Import structured modules
import { AgnostAnalytics } from './core/index.js';
import type { AgnostConfig, MCPServer } from './types/index.js';
import { logger, DataObjectPools } from './performance/index.js';
import { AnalyticsHttpClient } from './network/index.js';
import { SessionManager } from './session/index.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: AgnostConfig = {
  endpoint: 'https://api.agnost.ai',
  disableInput: false,
  disableOutput: false,
  enableRequestQueuing: true,
  batchSize: 5,
  maxRetries: 3,
  retryDelay: 1000,
  requestTimeout: 5000
};

/**
 * Create a configuration object for Agnost Analytics
 *
 * @param config Configuration options
 * @returns AgnostConfig object
 */
export function createConfig(config: Partial<AgnostConfig> = {}): AgnostConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config
  };
}

// Create and export singleton instance for backward compatibility
export const analytics = new AgnostAnalytics();

/**
 * Track an MCP server with Agnost Analytics (modifies server in-place)
 *
 * @param server MCP server instance to enhance with analytics tracking
 * @param orgId Organization ID for analytics
 * @param config Optional configuration with identify function
 *
 * @example
 * ```typescript
 * import { Server } from '@modelcontextprotocol/sdk/server/index.js';
 * import { trackMCP } from 'agnost';
 *
 * const server = new Server({ name: 'my-server', version: '1.0.0' }, {});
 *
 * // Basic tracking without user identification
 * trackMCP(server, 'your-org-id');
 *
 * // With user identification
 * trackMCP(server, 'your-org-id', {
 *   identify: (req, env) => ({
 *     userId: req?.headers?.['x-user-id'] || env?.USER_ID || 'anonymous',
 *     email: req?.headers?.['x-user-email'] || env?.USER_EMAIL,
 *     role: req?.headers?.['x-user-role'] || env?.USER_ROLE || 'user'
 *   })
 * });
 * ```
 */
export function trackMCP(
  server: MCPServer,
  orgId: string,
  config: Partial<AgnostConfig> = {}
): void {
  const fullConfig = createConfig(config);
  analytics.trackMcp(server, orgId, fullConfig);
}

/**
 * Wrap a function with analytics tracking
 *
 * @param primitiveType Type of primitive (tool/resource/prompt)
 * @param primitiveName Name of the primitive
 * @param func Function to wrap
 * @returns Wrapped function with analytics tracking
 */
export function wrap<T extends (...args: any[]) => any>(
  primitiveType: string,
  primitiveName: string,
  func: T
): T {
  return analytics.wrap(primitiveType, primitiveName, func);
}

/**
 * Helper to configure Agnost Analytics with environment variables.
 *
 * Usage:
 * ```typescript
 * import { configureFromEnv } from 'agnost';
 * const config = configureFromEnv();
 * ```
 *
 * Environment Variables:
 * - AGNOST_ENDPOINT: Analytics API endpoint (default: "https://api.agnost.ai")
 * - AGNOST_ORG_ID: Organization ID for Agnost Analytics (required)
 * - AGNOST_DISABLE_INPUT: Set to "true" to disable input tracking
 * - AGNOST_DISABLE_OUTPUT: Set to "true" to disable output tracking
 * - AGNOST_ENABLE_REQUEST_QUEUING: Set to "false" to disable request queuing (default: true)
 * - AGNOST_LOG_LEVEL: Set log level (debug, info, warning, error) (default: info)
 */
export function configureFromEnv() {
  const endpoint = process.env.AGNOST_ENDPOINT || "https://api.agnost.ai";
  const orgId = process.env.AGNOST_ORG_ID;
  const disableInput = process.env.AGNOST_DISABLE_INPUT === "true";
  const disableOutput = process.env.AGNOST_DISABLE_OUTPUT === "true";
  const enableRequestQueuing = process.env.AGNOST_ENABLE_REQUEST_QUEUING !== "false";
  const batchSize = parseInt(process.env.AGNOST_BATCH_SIZE || "5", 10);

  if (!orgId) {
    throw new Error("AGNOST_ORG_ID environment variable is required");
  }

  return {
    orgId,
    config: createConfig({
      endpoint,
      disableInput,
      disableOutput,
      enableRequestQueuing,
      batchSize: isNaN(batchSize) ? 5 : batchSize
    })
  };
}

// Main exports
export { AgnostAnalytics } from './core/index.js';

// Type exports
export type {
  AgnostConfig,
  MCPServer,
  SessionData,
  EventData
} from './types/index.js';

// Performance utilities (for advanced usage)
export { logger };

// Export all
export default {
  trackMCP,
  createConfig,
  configureFromEnv,
  wrap,
  AgnostAnalytics,
  analytics,
  logger
};