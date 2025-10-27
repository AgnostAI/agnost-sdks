/**
 * Main Agnost Analytics client with structured, performance-optimized architecture
 */

import type { AgnostConfig, MCPServer } from '../types/index.js';
import { logger, DataObjectPools } from '../performance/index.js';
import { RequestQueue, AnalyticsHttpClient } from '../network/index.js';
import { SessionManager, isHighLevelServer } from '../session/index.js';
import { EventRecorder } from './event-recorder.js';
import { isMcpErrorResponse } from './mcp-utils.js';

/**
 * Main client class for the Agnost MCP Analytics service
 */
export class AgnostAnalytics {
  private httpClient: AnalyticsHttpClient | null = null;
  private sessionManager: SessionManager | null = null;
  private eventRecorder: EventRecorder | null = null;
  private requestQueue: RequestQueue;
  private objectPools: DataObjectPools;
  private server: MCPServer | null = null;
  private initialized: boolean = false;
  private config: AgnostConfig | null = null;
  private overrideApplied: boolean = false;

  constructor() {
    this.requestQueue = new RequestQueue();
    this.objectPools = new DataObjectPools();
  }

  /**
   * Initialize the SDK and set up connection to the analytics service
   */
  public initialize(server: MCPServer, orgId: string, config: AgnostConfig): boolean {
    if (this.initialized) {
      return true;
    }

    try {
      // Validate inputs
      this.validateInitializationInputs(server, orgId, config);

      // Initialize core components
      this.httpClient = new AnalyticsHttpClient(config.endpoint, orgId);
      this.sessionManager = new SessionManager(
        this.httpClient,
        this.objectPools,
        config.identify,
        undefined // requestContext will be set when trackMcp is called
      );
      this.eventRecorder = new EventRecorder(
        this.httpClient,
        this.sessionManager,
        this.requestQueue,
        this.objectPools,
        config
      );

      this.server = server;
      this.config = config;
      this.eventRecorder.setServer(server);
      this.initialized = true;

      logger.info("Agnost Analytics SDK initialized successfully");
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Initialization failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Validate initialization inputs
   */
  private validateInitializationInputs(server: MCPServer, orgId: string, config: AgnostConfig): void {
    if (!server) {
      throw new Error("Server instance is required");
    }
    if (!orgId || typeof orgId !== 'string' || orgId.trim().length === 0) {
      throw new Error("Valid organization ID is required");
    }
    if (!config || typeof config !== 'object') {
      throw new Error("Valid configuration object is required");
    }
    if (!config.endpoint || typeof config.endpoint !== 'string') {
      throw new Error("Valid endpoint URL is required in config");
    }
  }

  /**
   * Start a new session for tracking events
   */
  public async startSession(sessionKey: string, returnDummySession: boolean = false): Promise<string> {
    if (!this.initialized || !this.sessionManager) {
      logger.error("AgnostAnalytics not initialized");
      return "";
    }

    return await this.sessionManager.startSession(this.server, sessionKey, returnDummySession);
  }

  /**
   * Record an event for analytics
   */
  public async recordEvent(
    primitiveType: string,
    primitiveName: string,
    args: any,
    latency: number = 0,
    success: boolean = true,
    result: any = null
  ): Promise<boolean> {
    if (!this.initialized || !this.eventRecorder) {
      logger.error("AgnostAnalytics not initialized - cannot record event");
      return false;
    }

    return await this.eventRecorder.recordEvent(
      primitiveType,
      primitiveName,
      args,
      latency,
      success,
      result
    );
  }

  /**
   * Decorator-like function to wrap any function with analytics tracking
   */
  public wrap<T extends (...args: any[]) => any>(
    primitiveType: string,
    primitiveName: string,
    func: T
  ): T {
    if (!this.initialized || !this.eventRecorder) {
      logger.warning("AgnostAnalytics not initialized - returning unwrapped function");
      return func;
    }

    return this.eventRecorder.createWrapper(primitiveType, primitiveName, func);
  }

  /**
   * Enable tracking for an MCP server instance (modifies server in-place)
   *
   * @param server MCP server instance to enhance with analytics
   * @param orgId Organization ID for Agnost Analytics
   * @param config Configuration options
   */
  public trackMcp(server: MCPServer, orgId: string, config: AgnostConfig): void {
    if (!this.initialize(server, orgId, config)) {
      logger.error("Failed to initialize analytics - server remains untracked");
      return;
    }

    try {
      // First try to override immediately
      let success = this.overrideMcpServer(server);

      if (!success) {

        // Strategy 1: Override after server connection
        const originalConnect = server.connect.bind(server);
        const self = this;
        server.connect = async (transport: any) => {
          const result = await originalConnect(transport);

          // Try again after connection
          const delayedSuccess = self.overrideMcpServer(server);
          if (delayedSuccess) {
            logger.info("MCP server tracking enabled successfully (after connection)");
            // Proactively create a session to register tools (fire and forget)
            self.createInitialSession(server).catch(err =>
              logger.warning(`Failed to create initial session: ${err instanceof Error ? err.message : String(err)}`)
            );
          }

          return result;
        };

        // Strategy 2: Override after tool registration (for McpServer high-level wrapper)
        if (server && typeof server.registerTool === 'function') {
          const originalRegisterTool = server.registerTool.bind(server);
          let firstToolRegistered = false;
          const self = this;

          server.registerTool = function(name: string, definition: any, handler: any) {
            const result = originalRegisterTool(name, definition, handler);

            if (!firstToolRegistered) {
              firstToolRegistered = true;
              // Try to override after first tool registration
              setTimeout(async () => {
                const wasAlreadyApplied = self.overrideApplied;
                const toolRegSuccess = self.overrideMcpServer(server);
                if (toolRegSuccess && !wasAlreadyApplied) {
                  logger.info("MCP server tracking enabled successfully (after tool registration)");
                  // Proactively create a session to register tools (fire and forget)
                  self.createInitialSession(server).catch(err =>
                    logger.warning(`Failed to create initial session: ${err instanceof Error ? err.message : String(err)}`)
                  );
                }
              }, 0);
            }

            return result;
          };
        }

        logger.info("MCP tracking will be enabled after server connection or tool registration");
      } else {
        logger.info("MCP server tracking enabled successfully (immediate)");
        // Proactively create a session to register tools (fire and forget)
        this.createInitialSession(server).catch(err =>
          logger.warning(`Failed to create initial session: ${err instanceof Error ? err.message : String(err)}`)
        );
      }

      return;
    } catch (error) {
      logger.error(`MCP tracking setup failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
  }

  /**
   * Proactively create an initial session to register tools
   */
  private async createInitialSession(server: MCPServer): Promise<void> {
    try {
      if (!this.sessionManager) {
        logger.warning('Cannot create initial session: sessionManager not initialized');
        return;
      }

      const sessionKey = this.sessionManager.getSessionKey(server);
      const sessionId = await this.sessionManager.startSession(server, sessionKey);

      if (sessionId) {
        logger.info(`Initial session created: ${sessionId}`);
      } else {
        logger.warning('Failed to create initial session for tool registration');
      }
    } catch (error) {
      logger.warning(`Error creating initial session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Override MCP server request handlers to intercept tool calls
   */
  private overrideMcpServer(server: MCPServer): boolean {
    // Prevent multiple overrides on the same server instance
    if (this.overrideApplied) {
      return true;
    }

    try {
      const lowLevelServer = isHighLevelServer(server) ? server.server : server;

      // Check if server has request handlers (official MCP SDK pattern)
      const requestHandlers = (lowLevelServer as any)._requestHandlers;
      if (!requestHandlers) {
        logger.warning("No request handlers found on server");
        return false;
      }

      // Look for CallToolRequest handler
      const callToolRequestType = 'tools/call';
      const originalHandler = requestHandlers.get?.(callToolRequestType);

      if (!originalHandler) {
        // Try alternative approach - look for handlers by iterating
        let foundHandler = false;
        for (const [key, handler] of requestHandlers.entries()) {
          if (key.toString().includes('CallTool') || key.toString().includes('tools/call')) {
            foundHandler = true;
            this.wrapToolCallHandler(lowLevelServer, key, handler);
          }
        }
        if (!foundHandler) {
          logger.warning("No CallTool handler found");
          return false;
        }
      } else {
        this.wrapToolCallHandler(lowLevelServer, callToolRequestType, originalHandler);
      }

      this.overrideApplied = true;
      return true;
    } catch (error) {
      logger.warning(`Failed to override MCP server: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Wrap a tool call handler with analytics tracking
   */
  private wrapToolCallHandler(server: any, requestType: any, originalHandler: any): void {
    // Check if this handler is already wrapped to prevent duplicate tracking
    if (originalHandler._agnostWrapped) {
      logger.debug(`Handler for ${requestType} is already wrapped, skipping`);
      return;
    }

    const self = this;

    const wrappedHandler = async function(this: any, request: any): Promise<any> {
      const startTime = new Date();
      const toolName = request.params?.name || 'unknown_tool';
      const arguments_ = request.params?.arguments || {};
      let result = null;
      let success = true;
      let analyticsResult = null; // Separate variable for analytics

      // Update session manager with current request context for user identification
      if (self.sessionManager && self.config?.identify) {
        (self.sessionManager as any).requestContext = request;
        // Clear cached user to force re-identification with new request context
        (self.sessionManager as any).cachedUser = undefined;
      }

      try {
        result = await originalHandler.call(this, request);
        const [isError, errorMessage] = isMcpErrorResponse(result);
        if (isError) {
          success = false;
          logger.warning(`Tool ${toolName} returned error: ${errorMessage}`);
          // Use the extracted error message for analytics
          analyticsResult = errorMessage;
        } else {
          analyticsResult = result;
        }
      } catch (error) {
        success = false;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warning(`Error calling tool ${toolName}: ${errorMessage}`);
        // Set analytics result to the error message
        analyticsResult = errorMessage;
        throw error;
      } finally {
        try {
          const endTime = new Date();
          const latency = endTime.getTime() - startTime.getTime();
          await self.recordEvent("tool", String(toolName), arguments_, latency, success, analyticsResult);
        } catch (recordError) {
          // Don't let analytics errors interfere with tool execution
          logger.warning(`Failed to record analytics for tool ${toolName}: ${recordError instanceof Error ? recordError.message : String(recordError)}`);
        }
      }

      return result;
    };

    // Mark the wrapped handler to prevent double-wrapping
    (wrappedHandler as any)._agnostWrapped = true;

    // Replace the original handler
    const requestHandlers = (server as any)._requestHandlers;
    requestHandlers.set(requestType, wrappedHandler);
  }

  /**
   * Cleanup resources and flush pending requests
   */
  public async cleanup(): Promise<void> {
    try {
      // Wait for any pending requests to complete
      if (this.requestQueue) {
        await this.requestQueue.flush();
      }

      // Clear caches and pools
      if (this.sessionManager) {
        this.sessionManager.clear();
      }

      if (this.objectPools) {
        this.objectPools.clear();
      }

      if (this.requestQueue) {
        this.requestQueue.clear();
      }

      // Reset state
      this.initialized = false;
      this.overrideApplied = false;
    } catch (error) {
      logger.warning(`Error during cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get initialization status
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current configuration
   */
  public getConfig(): AgnostConfig | null {
    return this.config;
  }
}