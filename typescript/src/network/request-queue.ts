/**
 * Request queue manager for optimizing network performance
 */

import { logger } from '../performance/index.js';

export type QueuedRequest = () => Promise<void>;

/**
 * Manages a queue of network requests with configurable processing behavior
 */
export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private isProcessing: boolean = false;
  private processingDelay: number = 10; // ms between requests

  constructor(processingDelay: number = 10) {
    this.processingDelay = processingDelay;
  }

  /**
   * Add a request to the queue for processing
   */
  async enqueue(requestFn: QueuedRequest): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await requestFn();
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the request queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const request = this.queue.shift();
        if (request) {
          try {
            await request();
          } catch (error) {
            logger.warning(`Queued request failed: ${error instanceof Error ? error.message : String(error)}`);
          }

          // Add small delay between requests to prevent overwhelming the server
          if (this.queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, this.processingDelay));
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is currently processing
   */
  isProcessingQueue(): boolean {
    return this.isProcessing;
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.queue.length = 0;
  }

  /**
   * Wait for all pending requests to complete
   */
  async flush(): Promise<void> {
    while (this.isProcessing && this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}