/**
 * HTTP client wrapper with optimizations for analytics requests
 */

import axios from 'axios';
import type { SessionData, EventData } from '../types/index.js';
import { logger } from '../performance/index.js';

/**
 * Configuration for HTTP requests
 */
export interface HttpRequestConfig {
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * HTTP client for making analytics API requests
 */
export class AnalyticsHttpClient {
  private baseUrl: string;
  private orgId: string;
  private defaultHeaders: Record<string, string>;
  private defaultTimeout: number = 10000;

  constructor(baseUrl: string, orgId: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.orgId = orgId;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-Org-Id': orgId
    };
  }

  /**
   * Send session data to analytics endpoint
   */
  async sendSession(sessionData: SessionData, config?: HttpRequestConfig): Promise<any> {
    const url = `${this.baseUrl}/api/v1/capture-session`;
    const requestConfig = this.buildRequestConfig(config);

    logger.debug(`Making POST request to: ${url}`);

    // Cache JSON string to avoid redundant serialization
    const sessionDataStr = JSON.stringify(sessionData);
    logger.debug(`Session data: ${sessionDataStr}`);
    logger.debug(`Request headers: ${JSON.stringify(requestConfig.headers)}`);

    const response = await axios.post(url, sessionData, requestConfig);

    logger.info(`Session created successfully, response status: ${response.status}`);
    logger.debug(`Response data: ${JSON.stringify(response.data)}`);

    return response;
  }

  /**
   * Send event data to analytics endpoint
   */
  async sendEvent(eventData: EventData, config?: HttpRequestConfig): Promise<any> {
    const url = `${this.baseUrl}/api/v1/capture-event`;
    const requestConfig = this.buildRequestConfig(config);

    logger.debug(`Making POST request to: ${url}`);

    // Cache JSON string to avoid redundant serialization
    const eventDataStr = JSON.stringify(eventData);
    logger.debug(`Event data: ${eventDataStr}`);
    logger.debug(`Request headers: ${JSON.stringify(requestConfig.headers)}`);

    const response = await axios.post(url, eventData, requestConfig);

    logger.info(`Event recorded successfully, response status: ${response.status}`);
    logger.debug(`Response data: ${JSON.stringify(response.data)}`);

    return response;
  }

  /**
   * Build request configuration with defaults
   */
  private buildRequestConfig(config?: HttpRequestConfig): any {
    return {
      headers: {
        ...this.defaultHeaders,
        ...config?.headers
      },
      timeout: config?.timeout ?? this.defaultTimeout
    };
  }

  /**
   * Update organization ID
   */
  updateOrgId(orgId: string): void {
    this.orgId = orgId;
    this.defaultHeaders['X-Org-Id'] = orgId;
  }

  /**
   * Get current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get current organization ID
   */
  getOrgId(): string {
    return this.orgId;
  }
}