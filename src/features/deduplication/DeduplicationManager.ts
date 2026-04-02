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
 * Request Deduplication Manager
 * Aynı request'leri birleştirir, tek seferde gönderir
 */
export class DeduplicationManager {
  private config: Required<DeduplicationConfig>;
  private pendingRequests = new Map<string, PendingRequest>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: DeduplicationConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      keyGenerator: config.keyGenerator ?? this.defaultKeyGenerator,
      ttl: config.ttl ?? 60000 // 1 dakika
    };

    // Cleanup timer başlat
    this.startCleanupTimer();
  }

  /**
   * Request'i deduplicate et
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
      // Mevcut request'e subscribe ol
      return new Promise<SaxiosResponse<T>>((resolve, reject) => {
        existingRequest.subscribers.push({ resolve, reject });
      });
    }

    // Yeni request oluştur
    return new Promise<SaxiosResponse<T>>((resolve, reject) => {
      const pendingRequest: PendingRequest<T> = {
        promise: requestFn(),
        timestamp: Date.now(),
        resolve,
        reject,
        subscribers: []
      };

      this.pendingRequests.set(requestKey, pendingRequest);

      // Request'i execute et
      pendingRequest.promise
        .then((response) => {
          // Ana request'i resolve et
          pendingRequest.resolve(response);
          
          // Tüm subscriber'ları resolve et
          pendingRequest.subscribers.forEach(sub => sub.resolve(response));
          
          // Cleanup
          this.pendingRequests.delete(requestKey);
        })
        .catch((error) => {
          // Ana request'i reject et
          pendingRequest.reject(error);
          
          // Tüm subscriber'ları reject et
          pendingRequest.subscribers.forEach(sub => sub.reject(error));
          
          // Cleanup
          this.pendingRequests.delete(requestKey);
        });
    });
  }

  /**
   * Request key oluştur
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
    
    // Headers'dan önemli olanları al
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
   * Cleanup timer başlat
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.ttl / 2); // TTL'nin yarısında bir cleanup yap
  }

  /**
   * Expired request'leri temizle
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
        // Timeout error ile reject et
        const timeoutError = new Error(`Request deduplication timeout: ${key}`);
        request.reject(timeoutError);
        request.subscribers.forEach(sub => sub.reject(timeoutError));
        this.pendingRequests.delete(key);
      }
    });
  }

  /**
   * Pending request'lerin sayısını al
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Pending request'leri listele
   */
  getPendingKeys(): string[] {
    return Array.from(this.pendingRequests.keys());
  }

  /**
   * Tüm pending request'leri temizle
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
   * Konfigürasyonu güncelle
   */
  updateConfig(newConfig: Partial<DeduplicationConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Konfigürasyonu al
   */
  getConfig(): DeduplicationConfig {
    return { ...this.config };
  }

  /**
   * Deduplication'ı etkinleştir
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Deduplication'ı devre dışı bırak
   */
  disable(): void {
    this.config.enabled = false;
    this.clear();
  }

  /**
   * Etkin mi kontrol et
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Cleanup timer'ı durdur
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}