/**
 * Object pooling for performance optimization
 */

import type { SessionData, EventData } from '../types/index.js';

/**
 * Generic object pool for reusing objects to reduce GC pressure
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;

  constructor(createFn: () => T, resetFn: (obj: T) => void, maxSize: number = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  /**
   * Get an object from the pool or create a new one
   */
  get(): T {
    const pooled = this.pool.pop();
    if (pooled) {
      this.resetFn(pooled);
      return pooled;
    }
    return this.createFn();
  }

  /**
   * Return an object to the pool
   */
  return(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  /**
   * Clear the pool
   */
  clear(): void {
    this.pool.length = 0;
  }

  /**
   * Get current pool size
   */
  size(): number {
    return this.pool.length;
  }
}

/**
 * Specialized pools for common data types
 */
export class DataObjectPools {
  private sessionDataPool: ObjectPool<SessionData>;
  private eventDataPool: ObjectPool<EventData>;

  constructor() {
    this.sessionDataPool = new ObjectPool<SessionData>(
      () => ({
        session_id: '',
        client_config: '',
        connection_type: '',
        ip: ''
      }),
      (obj) => {
        obj.session_id = '';
        obj.client_config = '';
        obj.connection_type = '';
        obj.ip = '';
      }
    );

    this.eventDataPool = new ObjectPool<EventData>(
      () => ({
        org_id: '',
        session_id: '',
        primitive_type: '',
        primitive_name: '',
        latency: 0,
        success: true,
        args: '',
        result: ''
      }),
      (obj) => {
        obj.org_id = '';
        obj.session_id = '';
        obj.primitive_type = '';
        obj.primitive_name = '';
        obj.latency = 0;
        obj.success = true;
        obj.args = '';
        obj.result = '';
      }
    );
  }

  getSessionData(): SessionData {
    return this.sessionDataPool.get();
  }

  returnSessionData(data: SessionData): void {
    this.sessionDataPool.return(data);
  }

  getEventData(): EventData {
    return this.eventDataPool.get();
  }

  returnEventData(data: EventData): void {
    this.eventDataPool.return(data);
  }

  clear(): void {
    this.sessionDataPool.clear();
    this.eventDataPool.clear();
  }
}