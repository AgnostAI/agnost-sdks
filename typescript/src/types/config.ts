/**
 * Configuration interfaces for the Agnost Analytics SDK
 */

/**
 * User identity returned by identify function
 */
export interface UserIdentity {
  userId: string; // Required field
  [key: string]: any; // Any other fields user wants to track
}

/**
 * Function to identify user from request and environment
 * @param request - The incoming request object (headers, body, etc.)
 * @param env - Environment variables (process.env)
 */
export type IdentifyFunction = (request?: any, env?: Record<string, string | undefined>) => UserIdentity | null | Promise<UserIdentity | null>;

/**
 * Configuration for the Agnost Analytics client
 * endpoint: API endpoint URL @default "https://api.agnost.ai"
 * disableInput: Flag to disable tracking input arguments @default false
 * disableOutput: Flag to disable tracking output results @default false
 * enableRequestQueuing: Enable request queuing for better performance @default true
 * batchSize: Number of events to batch together @default 5
 * maxRetries: Maximum number of retry attempts for failed requests @default 3
 * retryDelay: Delay between retry attempts in milliseconds @default 1000
 * requestTimeout: Request timeout in milliseconds @default 5000
 * identify: Optional function to identify users from request context
 */
export interface AgnostConfig {
  endpoint: string;
  disableInput: boolean;
  disableOutput: boolean;
  enableRequestQueuing?: boolean;
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  requestTimeout?: number;
  identify?: IdentifyFunction;
}

/**
 * Type representing any MCP server instance
 * This is kept as `any` to support different MCP SDK versions and server implementations
 */
export type MCPServer = any;