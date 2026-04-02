import { DeduplicationConfig } from '../types';
import { SaxiosRequestConfig, SaxiosResponse } from '../../types';

interface PendingRequest<T = any> {
  promise: Promise<SaxiosResponse<T>>;
  timestamp: number;
  resolve: (value: SaxiosResponse<T>) => void;
  reject: (error: any) => void;
  subscribers: Array<{
    resolve: (value: SaxiosResponse<T>) => void;
    reject: (error: any) => void;
  }>;
}

/**
 * Request deduplication — coalesces in-flight identical requests
 */
export class DeduplicationManager {
  private config: Required<DeduplicationConfig>;
  private pendingRequests = new Map<string, PendingRequest>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: DeduplicationConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      keyGenerator: config.keyGenerator ?? this.defaultKeyGenerator,
      ttl: config.ttl ?? 60000 // 1 minute
    };

    // Periodic cleanup of stale pending entries
    this.startCleanupTimer();
  }

  /**
   * Deduplicate by key or pass through when disabled
   */
  async deduplicate<T = any>(
    key: string,
    requestFn: () => Promise<SaxiosResponse<T>>
  ): Promise<SaxiosResponse<T>> {
    if (!this.config.enabled) {
      return requestFn();
    }

    const requestKey = key;
    const existingRequest = this.pendingRequests.get(requestKey);

    if (existingRequest) {
      // Join existing in-flight request
      return new Promise<SaxiosResponse<T>>((resolve, reject) => {
        existingRequest.subscribers.push({ resolve, reject });
      });
    }

    // Start new leader request
    return new Promise<SaxiosResponse<T>>((resolve, reject) => {
      const pendingRequest: PendingRequest<T> = {
        promise: requestFn(),
        timestamp: Date.now(),
        resolve,
        reject,
        subscribers: []
      };

      this.pendingRequests.set(requestKey, pendingRequest);

      // Execute and fan out to subscribers
      pendingRequest.promise
        .then((response) => {
          // Resolve leader
          pendingRequest.resolve(response);
          
          // Resolve subscribers
          pendingRequest.subscribers.forEach(sub => sub.resolve(response));
          
          this.pendingRequests.delete(requestKey);
        })
        .catch((error) => {
          // Reject leader
          pendingRequest.reject(error);
          
          // Reject subscribers
          pendingRequest.subscribers.forEach(sub => sub.reject(error));
          
          this.pendingRequests.delete(requestKey);
        });
    });
  }

  /**
   * Build dedup key from config
   */
  generateKey(config: SaxiosRequestConfig): string {
    return this.config.keyGenerator(config);
  }

  /**
   * Default key generator
   */
  private defaultKeyGenerator(config: SaxiosRequestConfig): string {
    const method = (config.method || 'GET').toUpperCase();
    const url = config.url || '';
    const params = config.params ? JSON.stringify(config.params) : '';
    const data = config.data ? JSON.stringify(config.data) : '';
    
    // Include auth/content headers in key
    const relevantHeaders: Record<string, any> = {};
    if (config.headers) {
      const importantHeaders = ['authorization', 'content-type', 'accept'];
      Object.keys(config.headers).forEach(key => {
        if (importantHeaders.includes(key.toLowerCase())) {
          relevantHeaders[key.toLowerCase()] = config.headers![key];
        }
      });
    }
    const headers = Object.keys(relevantHeaders).length > 0 
      ? JSON.stringify(relevantHeaders) 
      : '';

    return `${method}:${url}:${params}:${data}:${headers}`;
  }

  /**
   * Run cleanup on half the TTL interval
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.ttl / 2);
  }

  /**
   * Drop pending entries past TTL
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.pendingRequests.forEach((request, key) => {
      if (now - request.timestamp > this.config.ttl) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      const request = this.pendingRequests.get(key);
      if (request) {
        // Reject with timeout
        const timeoutError = new Error(`Request deduplication timeout: ${key}`);
        request.reject(timeoutError);
        request.subscribers.forEach(sub => sub.reject(timeoutError));
        this.pendingRequests.delete(key);
      }
    });
  }

  /**
   * Number of in-flight dedup groups
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Keys of pending dedup groups
   */
  getPendingKeys(): string[] {
    return Array.from(this.pendingRequests.keys());
  }

  /**
   * Reject and clear all pending
   */
  clear(): void {
    this.pendingRequests.forEach((request, key) => {
      const cancelError = new Error(`Request deduplication cleared: ${key}`);
      request.reject(cancelError);
      request.subscribers.forEach(sub => sub.reject(cancelError));
    });
    this.pendingRequests.clear();
  }

  /**
   * Merge partial config
   */
  updateConfig(newConfig: Partial<DeduplicationConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Current dedup settings
   */
  getConfig(): DeduplicationConfig {
    return { ...this.config };
  }

  /**
   * Enable deduplication
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable and clear pending
   */
  disable(): void {
    this.config.enabled = false;
    this.clear();
  }

  /**
   * Whether deduplication is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Stop interval and clear state
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}