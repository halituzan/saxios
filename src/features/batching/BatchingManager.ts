import { BatchingConfig } from '../types';
import { SaxiosRequestConfig, SaxiosResponse } from '../../types';

interface BatchedRequest {
  config: SaxiosRequestConfig;
  resolve: (response: SaxiosResponse) => void;
  reject: (error: any) => void;
  timestamp: number;
}

interface BatchGroup {
  key: string;
  requests: BatchedRequest[];
  timer?: NodeJS.Timeout;
}

/**
 * Batching manager — sends requests in batches
 */
export class BatchingManager {
  private config: Required<BatchingConfig>;
  private batches = new Map<string, BatchGroup>();

  constructor(config: BatchingConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      maxBatchSize: config.maxBatchSize ?? 10,
      batchDelay: config.batchDelay ?? 50,
      batchEndpoint: config.batchEndpoint ?? '/batch',
      batchKey: config.batchKey ?? this.defaultBatchKey
    };
  }

  /**
   * Add a request to a batch
   */
  async batchRequest<T = any>(
    config: SaxiosRequestConfig,
    requestFn: () => Promise<SaxiosResponse<T>>
  ): Promise<SaxiosResponse<T>> {
    if (!this.config.enabled || !this.isBatchable(config)) {
      return requestFn();
    }

    return new Promise<SaxiosResponse<T>>((resolve, reject) => {
      const batchKey = this.config.batchKey(config);
      const batchedRequest: BatchedRequest = {
        config,
        resolve: resolve as any,
        reject,
        timestamp: Date.now()
      };

      this.addToBatch(batchKey, batchedRequest);
    });
  }

  /**
   * Whether the request can be batched
   */
  private isBatchable(config: SaxiosRequestConfig): boolean {
    const method = (config.method || 'GET').toUpperCase();
    
    // Only GET requests are batched
    if (method !== 'GET') {
      return false;
    }

    // Do not batch when cancel token or signal is present
    if (config.cancelToken || config.signal) {
      return false;
    }

    return true;
  }

  /**
   * Append a request to the batch queue
   */
  private addToBatch(batchKey: string, request: BatchedRequest): void {
    let batch = this.batches.get(batchKey);

    if (!batch) {
      batch = {
        key: batchKey,
        requests: []
      };
      this.batches.set(batchKey, batch);
    }

    batch.requests.push(request);

    // Reset debounce timer
    if (batch.timer) {
      clearTimeout(batch.timer);
    }

    // Batch size limit
    if (batch.requests.length >= this.config.maxBatchSize) {
      this.executeBatch(batchKey);
    } else {
      // Schedule delayed flush
      batch.timer = setTimeout(() => {
        this.executeBatch(batchKey);
      }, this.config.batchDelay);
    }
  }

  /**
   * Execute a batch
   */
  private async executeBatch(batchKey: string): Promise<void> {
    const batch = this.batches.get(batchKey);
    if (!batch || batch.requests.length === 0) {
      return;
    }

    // Remove batch from map
    this.batches.delete(batchKey);

    // Clear timer
    if (batch.timer) {
      clearTimeout(batch.timer);
    }

    try {
      // Build batch request payload
      const batchRequest = this.createBatchRequest(batch.requests);
      
      // Send batch
      const batchResponse = await this.sendBatchRequest(batchRequest);
      
      // Fan out responses
      this.distributeBatchResponse(batch.requests, batchResponse);
    } catch (error) {
      // Reject all batched requests on error
      batch.requests.forEach(req => req.reject(error));
    }
  }

  /**
   * Build batch request config
   */
  private createBatchRequest(requests: BatchedRequest[]): SaxiosRequestConfig {
    const batchData = {
      requests: requests.map((req, index) => ({
        id: index,
        method: req.config.method || 'GET',
        url: req.config.url,
        params: req.config.params,
        headers: req.config.headers
      }))
    };

    return {
      method: 'POST',
      url: this.config.batchEndpoint,
      data: batchData,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  /**
   * Send the batch request (implementation uses fetch in production)
   */
  private async sendBatchRequest(batchConfig: SaxiosRequestConfig): Promise<any> {
    // Real implementation would use fetch; mock for now
    console.log('Sending batch request:', batchConfig);
    
    // Mock batch response
    return {
      responses: batchConfig.data.requests.map((req: any) => ({
        id: req.id,
        status: 200,
        statusText: 'OK',
        data: { message: `Mock response for ${req.url}` },
        headers: { 'content-type': 'application/json' }
      }))
    };
  }

  /**
   * Distribute batch response to callers
   */
  private distributeBatchResponse(requests: BatchedRequest[], batchResponse: any): void {
    const responses = batchResponse.responses || [];

    requests.forEach((request, index) => {
      const response = responses[index];
      
      if (response) {
        const item: SaxiosResponse = {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          config: request.config,
          request: null
        };

        request.resolve(item);
      } else {
        request.reject(new Error(`No response for batch request ${index}`));
      }
    });
  }

  /**
   * Default batch key generator
   */
  private defaultBatchKey(config: SaxiosRequestConfig): string {
    // Group by base URL
    const baseURL = config.baseURL || '';
    const method = (config.method || 'GET').toUpperCase();
    
    // Include auth-relevant headers in key
    const authHeader = config.headers?.authorization || config.headers?.Authorization || '';
    
    return `${method}:${baseURL}:${authHeader}`;
  }

  /**
   * Snapshot of pending batches
   */
  getBatchStatus(): {
    totalBatches: number;
    totalRequests: number;
    batches: Array<{
      key: string;
      requestCount: number;
      oldestRequest: number;
    }>;
  } {
    const batches: Array<{
      key: string;
      requestCount: number;
      oldestRequest: number;
    }> = [];

    let totalRequests = 0;

    this.batches.forEach((batch, key) => {
      const oldestTimestamp = Math.min(...batch.requests.map(r => r.timestamp));
      
      batches.push({
        key,
        requestCount: batch.requests.length,
        oldestRequest: Date.now() - oldestTimestamp
      });

      totalRequests += batch.requests.length;
    });

    return {
      totalBatches: this.batches.size,
      totalRequests,
      batches
    };
  }

  /**
   * Flush all pending batches immediately
   */
  flushAll(): void {
    const batchKeys = Array.from(this.batches.keys());
    batchKeys.forEach(key => this.executeBatch(key));
  }

  /**
   * Flush a specific batch by key
   */
  flushBatch(batchKey: string): void {
    this.executeBatch(batchKey);
  }

  /**
   * Cancel all batches
   */
  cancelAll(): void {
    this.batches.forEach(batch => {
      if (batch.timer) {
        clearTimeout(batch.timer);
      }
      batch.requests.forEach(req => {
        req.reject(new Error('Batch cancelled'));
      });
    });
    this.batches.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BatchingConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Enable batching
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable batching
   */
  disable(): void {
    this.config.enabled = false;
    this.cancelAll();
  }

  /**
   * Whether batching is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Tear down and cancel pending work
   */
  destroy(): void {
    this.cancelAll();
  }
}