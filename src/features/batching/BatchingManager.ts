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
 * Batching Manager - Request'leri batch'leyerek gönderme
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
   * Request'i batch'e ekle
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
   * Request'in batch'lenebilir olup olmadığını kontrol et
   */
  private isBatchable(config: SaxiosRequestConfig): boolean {
    const method = (config.method || 'GET').toUpperCase();
    
    // Sadece GET request'leri batch'lenir
    if (method !== 'GET') {
      return false;
    }

    // Cancel token varsa batch'leme
    if (config.cancelToken || config.signal) {
      return false;
    }

    return true;
  }

  /**
   * Request'i batch'e ekle
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

    // Timer'ı sıfırla
    if (batch.timer) {
      clearTimeout(batch.timer);
    }

    // Batch size kontrolü
    if (batch.requests.length >= this.config.maxBatchSize) {
      this.executeBatch(batchKey);
    } else {
      // Delay timer kur
      batch.timer = setTimeout(() => {
        this.executeBatch(batchKey);
      }, this.config.batchDelay);
    }
  }

  /**
   * Batch'i execute et
   */
  private async executeBatch(batchKey: string): Promise<void> {
    const batch = this.batches.get(batchKey);
    if (!batch || batch.requests.length === 0) {
      return;
    }

    // Batch'i map'den çıkar
    this.batches.delete(batchKey);

    // Timer'ı temizle
    if (batch.timer) {
      clearTimeout(batch.timer);
    }

    try {
      // Batch request oluştur
      const batchRequest = this.createBatchRequest(batch.requests);
      
      // Batch'i gönder
      const batchResponse = await this.sendBatchRequest(batchRequest);
      
      // Response'ları dağıt
      this.distributeBatchResponse(batch.requests, batchResponse);
    } catch (error) {
      // Hata durumunda tüm request'leri reject et
      batch.requests.forEach(req => req.reject(error));
    }
  }

  /**
   * Batch request oluştur
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
   * Batch request'i gönder
   */
  private async sendBatchRequest(batchConfig: SaxiosRequestConfig): Promise<any> {
    // Bu kısım gerçek implementasyonda fetch ile yapılacak
    // Şimdilik mock response döndür
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
   * Batch response'ını dağıt
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
    // Aynı base URL'e sahip request'leri batch'le
    const baseURL = config.baseURL || '';
    const method = (config.method || 'GET').toUpperCase();
    
    // Headers'dan önemli olanları al
    const authHeader = config.headers?.authorization || config.headers?.Authorization || '';
    
    return `${method}:${baseURL}:${authHeader}`;
  }

  /**
   * Pending batch'lerin durumunu al
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
   * Tüm pending batch'leri flush et
   */
  flushAll(): void {
    const batchKeys = Array.from(this.batches.keys());
    batchKeys.forEach(key => this.executeBatch(key));
  }

  /**
   * Belirli bir batch'i flush et
   */
  flushBatch(batchKey: string): void {
    this.executeBatch(batchKey);
  }

  /**
   * Tüm batch'leri iptal et
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
   * Konfigürasyonu güncelle
   */
  updateConfig(newConfig: Partial<BatchingConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Batching'i etkinleştir
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Batching'i devre dışı bırak
   */
  disable(): void {
    this.config.enabled = false;
    this.cancelAll();
  }

  /**
   * Etkin mi kontrol et
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Temizlik yap
   */
  destroy(): void {
    this.cancelAll();
  }
}