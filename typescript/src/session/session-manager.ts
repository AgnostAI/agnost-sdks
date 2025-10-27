/**
 * Session management with optimized key generation and caching
 */

import { v4 as uuidv4 } from 'uuid';
import type { MCPServer, SessionData, IdentifyFunction, UserIdentity } from '../types/index.js';
import { logger, DataObjectPools } from '../performance/index.js';
import { AnalyticsHttpClient } from '../network/index.js';

/**
 * Utility functions for server introspection
 */
export function isHighLevelServer(server: any): boolean {
  return (
    server && typeof server === "object" &&
    server.server && typeof server.server === "object"
  );
}

/**
 * Manages user sessions with optimized key generation and caching
 */
export class SessionManager {
  private sessionIds: Record<any, string> = {};
  private sessionKeyCache: Map<any, string> = new Map();
  private httpClient: AnalyticsHttpClient;
  private objectPools: DataObjectPools;
  private identifyFn?: IdentifyFunction;
  private requestContext?: any;
  private cachedUser?: UserIdentity | null;

  constructor(
    httpClient: AnalyticsHttpClient,
    objectPools: DataObjectPools,
    identifyFn?: IdentifyFunction,
    requestContext?: any
  ) {
    this.httpClient = httpClient;
    this.objectPools = objectPools;
    this.identifyFn = identifyFn;
    this.requestContext = requestContext;
  }

  /**
   * Start a new session for tracking events
   */
  async startSession(
    server: MCPServer | null,
    sessionKey: string,
    returnDummySession: boolean = false
  ): Promise<string> {
    logger.debug(`startSession called with sessionKey: ${sessionKey}, returnDummySession: ${returnDummySession}`);

    if (returnDummySession) {
      return this.createDummySession();
    }

    // Check if session already exists
    if (sessionKey in this.sessionIds) {
      return this.sessionIds[sessionKey];
    }

    try {
      const newSessionId = uuidv4();
      const clientName = this.extractClientName(server);

      // Try to identify user
      const userIdentity = await this.identifyUser();

      // Extract tools from server using MCP protocol
      const tools = await this.extractTools(server);

      const sessionData = this.objectPools.getSessionData();
      sessionData.session_id = newSessionId;
      sessionData.client_config = String(clientName);
      sessionData.connection_type = "";
      sessionData.ip = "";

      // Add user data if identified
      if (userIdentity) {
        sessionData.user_data = userIdentity;
      }

      // Add tools list if found
      if (tools.length > 0) {
        sessionData.tools = tools;
      }

      await this.httpClient.sendSession(sessionData);

      this.sessionIds[sessionKey] = newSessionId;

      // Return object to pool
      this.objectPools.returnSessionData(sessionData);
      return newSessionId;
    } catch (error) {
      logger.warning(`Failed to start session: ${error instanceof Error ? error.message : String(error)}`);
      return "";
    }
  }

  /**
   * Create a dummy session for testing or fallback scenarios
   */
  private async createDummySession(): Promise<string> {
    logger.debug("Creating dummy session...");

    try {
      const newSessionId = uuidv4();
      logger.debug(`Generated dummy session ID: ${newSessionId}`);

      // Try to identify user even for dummy session
      const userIdentity = await this.identifyUser();

      const sessionData = this.objectPools.getSessionData();
      sessionData.session_id = newSessionId;
      sessionData.client_config = "unidentified_client";
      sessionData.connection_type = "";
      sessionData.ip = "";

      // Add user data if identified
      if (userIdentity) {
        sessionData.user_data = userIdentity;
      }

      await this.httpClient.sendSession(sessionData);

      logger.info(`Dummy session created successfully: ${newSessionId}${userIdentity ? ' with user: ' + userIdentity.userId : ''}`);

      // Return object to pool
      this.objectPools.returnSessionData(sessionData);
      return newSessionId;
    } catch (error) {
      logger.error(`Failed to start dummy session: ${error instanceof Error ? error.message : String(error)}`);
      return "";
    }
  }

  /**
   * Get a unique key for the current session (optimized with caching)
   */
  getSessionKey(server: MCPServer | null): string {
    try {
      const lowLevelServer = isHighLevelServer(server) ? server.server : server;

      // Check cache first
      if (this.sessionKeyCache.has(lowLevelServer)) {
        return this.sessionKeyCache.get(lowLevelServer)!;
      }

      let sessionKey: string;

      // Try to get session info from request context
      if (lowLevelServer?.requestContext?.session) {
        const sessionObj = lowLevelServer.requestContext.session;
        sessionKey = `session_${Object.prototype.toString.call(sessionObj).slice(8, -1)}_${Date.now()}`;
      }
      // Try to get transport session ID if available
      else if (server?.transport?.sessionId) {
        sessionKey = server.transport.sessionId;
      }
      // Fallback to object ID (similar to Python hex(id(server)))
      else {
        sessionKey = `server_${server ? Object.prototype.toString.call(server).slice(8, -1) : 'unknown'}_${Date.now()}`;
      }

      // Cache the result for future use
      this.sessionKeyCache.set(lowLevelServer, sessionKey);
      return sessionKey;
    } catch (error) {
      logger.debug(`Failed to get session key: ${error instanceof Error ? error.message : String(error)}`);
      return `fallback_${uuidv4()}`;
    }
  }

  /**
   * Extract client name from server instance
   */
  private extractClientName(server: MCPServer | null): string {
    let clientName = "default";

    try {
      const lowLevelServer = isHighLevelServer(server) ? server.server : server;

      // Try the correct MCP SDK method first
      if (lowLevelServer?.getClientVersion?.()?.name) {
        clientName = lowLevelServer.getClientVersion().name;
      }
      // Fallback to the old path for compatibility
      else if (lowLevelServer?.requestContext?.session?.clientParams?.clientInfo?.name) {
        clientName = lowLevelServer.requestContext.session.clientParams.clientInfo.name;
      }
    } catch (error) {
      logger.debug(`Could not extract client info: ${error instanceof Error ? error.message : String(error)}`);
    }

    return clientName;
  }

  /**
   * Get session ID for a given session key
   */
  getSessionId(sessionKey: string): string | undefined {
    return this.sessionIds[sessionKey];
  }

  /**
   * Check if a session exists
   */
  hasSession(sessionKey: string): boolean {
    return sessionKey in this.sessionIds;
  }

  /**
   * Identify user using the provided identify function
   */
  private async identifyUser(): Promise<UserIdentity | null> {
    if (!this.identifyFn) return null;

    // Return cached user if available
    if (this.cachedUser !== undefined) return this.cachedUser;

    try {
      // Pass both request context and environment variables
      const result = await this.identifyFn(this.requestContext, process.env);

      // Validate that userId exists
      if (result && !result.userId) {
        logger.warning('User identity missing required userId field');
        this.cachedUser = null;
        return null;
      }

      this.cachedUser = result;
      return result;
    } catch (error) {
      logger.warning(`User identification failed: ${error instanceof Error ? error.message : String(error)}`);
      this.cachedUser = null;
      return null;
    }
  }

  /**
   * Extract list of tool names from the MCP server using the official tools/list protocol method
   */
  private async extractTools(server: MCPServer | null): Promise<string[]> {
    try {
      if (!server) {
        logger.debug('extractTools: server is null');
        return [];
      }

      const lowLevelServer = isHighLevelServer(server) ? server.server : server;

      // Use the MCP protocol's tools/list method
      const requestHandlers = (lowLevelServer as any)._requestHandlers;
      const toolsListHandler = requestHandlers?.get?.('tools/list');

      if (!toolsListHandler) {
        logger.warning('extractTools: tools/list handler not found - MCP server may not support tools');
        return [];
      }

      logger.debug('extractTools: calling tools/list handler');

      // Call the tools/list handler according to MCP spec
      const response = await toolsListHandler.call(lowLevelServer, {
        method: 'tools/list',
        params: {}
      });

      // Parse the response according to MCP spec
      if (response && response.tools && Array.isArray(response.tools)) {
        const tools = response.tools.map((tool: any) => tool.name).filter((name: string) => name);
        logger.info(`Extracted ${tools.length} tools via tools/list: ${tools.join(', ')}`);
        return tools;
      }

      logger.warning('extractTools: tools/list response was empty or malformed');
      return [];
    } catch (error) {
      logger.warning(`Failed to extract tools via tools/list: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Clear all cached sessions and session keys
   */
  clear(): void {
    this.sessionIds = {};
    this.sessionKeyCache.clear();
    this.cachedUser = undefined; // Clear cached user as well
  }
}