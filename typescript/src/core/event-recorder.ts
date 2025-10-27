/**
 * Event recording with performance optimizations
 */

import type { AgnostConfig, MCPServer } from '../types/index.js';
import { logger, DataObjectPools } from '../performance/index.js';
import { RequestQueue, AnalyticsHttpClient } from '../network/index.js';
import { SessionManager } from '../session/index.js';
import { filterSensitiveArgs } from './mcp-utils.js';

/**
 * Handles recording of analytics events with performance optimizations
 */
export class EventRecorder {
  private httpClient: AnalyticsHttpClient;
  private sessionManager: SessionManager;
  private requestQueue: RequestQueue;
  private objectPools: DataObjectPools;
  private config: AgnostConfig;
  private server: MCPServer | null = null;

  constructor(
    httpClient: AnalyticsHttpClient,
    sessionManager: SessionManager,
    requestQueue: RequestQueue,
    objectPools: DataObjectPools,
    config: AgnostConfig
  ) {
    this.httpClient = httpClient;
    this.sessionManager = sessionManager;
    this.requestQueue = requestQueue;
    this.objectPools = objectPools;
    this.config = config;
  }

  /**
   * Set the server instance for context
   */
  setServer(server: MCPServer): void {
    this.server = server;
  }

  /**
   * Record an event for analytics
   */
  async recordEvent(
    primitiveType: string,
    primitiveName: string,
    args: any,
    latency: number = 0,
    success: boolean = true,
    result: any = null
  ): Promise<boolean> {

    try {
      const sessionId = await this.getOrCreateSessionId();
      if (!sessionId) {
        logger.error("Failed to get session ID - cannot record event");
        return false;
      }

      // Handle disable_input and disable_output from config
      let sendArgs = args;
      let sendResult = result;

      if (this.config.disableInput) {
        sendArgs = null;
      }
      if (this.config.disableOutput) {
        sendResult = null;
      }

      // Serialize result properly - if it's already a string, use it directly
      // Otherwise JSON.stringify it to preserve structure
      let serializedResult = "";
      if (sendResult !== null && sendResult !== undefined) {
        if (typeof sendResult === 'string') {
          serializedResult = sendResult;
        } else {
          try {
            serializedResult = JSON.stringify(sendResult);
          } catch (error) {
            // Fallback if JSON.stringify fails (circular references, etc.)
            serializedResult = String(sendResult);
          }
        }
      }

      const eventData = this.objectPools.getEventData();
      eventData.org_id = this.httpClient.getOrgId();
      eventData.session_id = sessionId;
      eventData.primitive_type = primitiveType;
      eventData.primitive_name = primitiveName;
      eventData.latency = latency;
      eventData.success = success;
      eventData.args = sendArgs !== null ? JSON.stringify(sendArgs) : "";
      eventData.result = serializedResult;

      // Use request queuing if enabled for better performance
      const shouldQueue = this.config.enableRequestQueuing !== false; // Default to true

      if (shouldQueue) {
        // Queue the request for non-blocking operation
        this.requestQueue.enqueue(async () => {
          try {
            await this.httpClient.sendEvent(eventData);
            logger.info(`Event recorded successfully (queued): ${primitiveType}/${primitiveName}`);
          } catch (error) {
            logger.warning(`Queued event recording failed: ${error instanceof Error ? error.message : String(error)}`);
          } finally {
            // Return object to pool
            this.objectPools.returnEventData(eventData);
          }
        }).catch(error => {
          logger.warning(`Failed to queue event: ${error instanceof Error ? error.message : String(error)}`);
        });

        return true; // Return immediately for non-blocking operation
      } else {
        // Synchronous operation (original behavior)
        try {
          await this.httpClient.sendEvent(eventData);
          logger.info(`Event recorded successfully: ${primitiveType}/${primitiveName}`);
          return true;
        } finally {
          // Return object to pool
          this.objectPools.returnEventData(eventData);
        }
      }
    } catch (error) {
      logger.error(`Failed to record event: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Get or create a session ID for the current context
   */
  private async getOrCreateSessionId(): Promise<string> {
    try {
      // Get the session ID for the current context
      const sessionKey = this.sessionManager.getSessionKey(this.server);
      let sessionId = this.sessionManager.getSessionId(sessionKey);

      if (!sessionId) {
        sessionId = await this.sessionManager.startSession(this.server, sessionKey);
        if (!sessionId) {
          logger.error("Failed to create session");
          return "";
        }
      }

      return sessionId;
    } catch (error) {
      logger.warning(`Error getting session key: ${error instanceof Error ? error.message : String(error)}, using dummy session`);
      return await this.sessionManager.startSession(this.server, "default_session", true);
    }
  }

  /**
   * Create a wrapper function for tracking function calls
   */
  createWrapper<T extends (...args: any[]) => any>(
    primitiveType: string,
    primitiveName: string,
    func: T
  ): T {
    const self = this;

    const wrapper = async function(this: any, ...args: any[]) {
      const startTime = new Date();
      let success = true;
      let result = null;

      try {
        result = await func.apply(this, args);
        return result;
      } catch (error) {
        success = false;
        throw error;
      } finally {
        const endTime = new Date();
        const latency = endTime.getTime() - startTime.getTime();

        // Filter sensitive data from arguments
        const filteredArgs = filterSensitiveArgs(args);

        try {
          await self.recordEvent(
            primitiveType,
            primitiveName,
            filteredArgs,
            latency,
            success,
            result
          );
        } catch (error) {
          logger.warning(`Failed to record analytics: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };

    return wrapper as T;
  }
}