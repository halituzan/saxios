import { LaxiosRequestConfig, LaxiosResponse } from '../types';
import { CacheConfig, CachedResponse, CacheStorage, CacheStats, CacheEvents } from './types';
import { MemoryStorage } from './MemoryStorage';

/**
 * Cache Manager sınıfı
 */
export class CacheManager {
  private config: Required<CacheConfig>;
  private storage: CacheStorage;
  private stats: CacheStats;
  private events: Partial<CacheEvents> = {};

  constructor(config: CacheConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      ttl: config.ttl ?? 300000, // 5 dakika
      maxSize: config.maxSize ?? 100,
      storage: config.storage ?? new MemoryStorage(config.maxSize ?? 100),
      keyGenerator: config.keyGenerator ?? this.defaultKeyGenerator,
      methods: config.methods ?? ['GET'],
      statusCodes: config.statusCodes ?? [200, 203, 300, 301, 410],
      filter: config.filter ?? (() => true),
      staleWhileRevalidate: config.staleWhileRevalidate ?? false,
      retryOnCacheMiss: config.retryOnCacheMiss ?? 0
    };

    this.storage = this.config.storage;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: 0,
      hitRate: 0
    };
  }

  /**
   * Cache'i etkinleştir
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Cache'i devre dışı bırak
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Cache'in etkin olup olmadığını kontrol et
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Request'in cache'lenebilir olup olmadığını kontrol et
   */
  isCacheable(config: LaxiosRequestConfig): boolean {
    if (!this.config.enabled) return false;
    
    const method = (config.method || 'GET').toUpperCase();
    return this.config.methods.includes(method);
  }

  /**
   * Response'un cache'lenebilir olup olmadığını kontrol et
   */
  isCacheableResponse(response: LaxiosResponse): boolean {
    if (!this.config.enabled) return false;
    
    return (
      this.config.statusCodes.includes(response.status) &&
      this.config.filter(response)
    );
  }

  /**
   * Cache key oluştur
   */
  generateKey(config: LaxiosRequestConfig): string {
    return this.config.keyGenerator(config);
  }

  /**
   * Default cache key generator
   */
  private defaultKeyGenerator(config: LaxiosRequestConfig): string {
    const method = (config.method || 'GET').toUpperCase();
    const url = config.url || '';
    const params = config.params ? JSON.stringify(config.params) : '';
    const data = config.data ? JSON.stringify(config.data) : '';
    
    return `${method}:${url}:${params}:${data}`;
  }

  /**
   * Cache'den response al
   */
  async get(key: string): Promise<CachedResponse | null> {
    try {
      const cached = await this.storage.get(key);
      
      if (cached) {
        this.stats.hits++;
        this.emit('hit', key, cached);
        this.updateStats();
        return cached;
      } else {
        this.stats.misses++;
        this.emit('miss', key);
        this.updateStats();
        return null;
      }
    } catch (error) {
      this.stats.misses++;
      this.updateStats();
      return null;
    }
  }

  /**
   * Response'u cache'e kaydet
   */
  async set(key: string, response: LaxiosResponse, ttl?: number): Promise<void> {
    if (!this.isCacheableResponse(response)) {
      return;
    }

    try {
      const cachedResponse: CachedResponse = {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: Object.keys(response.headers).reduce((acc, key) => {
          acc[key] = String(response.headers[key] || '');
          return acc;
        }, {} as Record<string, string>),
        config: { ...response.config },
        timestamp: Date.now(),
        ttl: ttl || this.config.ttl
      };

      await this.storage.set(key, cachedResponse, ttl || this.config.ttl);
      this.stats.sets++;
      this.emit('set', key, cachedResponse);
      this.updateStats();
    } catch (error) {
      // Cache set hatası - sessizce devam et
    }
  }

  /**
   * Cache'den entry sil
   */
  async delete(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
      this.stats.deletes++;
      this.emit('delete', key);
      this.updateStats();
    } catch (error) {
      // Silme hatası - sessizce devam et
    }
  }

  /**
   * Tüm cache'i temizle
   */
  async clear(): Promise<void> {
    try {
      await this.storage.clear();
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        size: 0,
        hitRate: 0
      };
      this.emit('clear');
    } catch (error) {
      // Temizleme hatası - sessizce devam et
    }
  }

  /**
   * Cache'de key var mı kontrol et
   */
  async has(key: string): Promise<boolean> {
    try {
      return await this.storage.has(key);
    } catch (error) {
      return false;
    }
  }

  /**
   * Cache istatistiklerini al
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Cache konfigürasyonunu al
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Cache konfigürasyonunu güncelle
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Event listener ekle
   */
  on<K extends keyof CacheEvents>(event: K, listener: CacheEvents[K]): void {
    this.events[event] = listener;
  }

  /**
   * Event listener kaldır
   */
  off<K extends keyof CacheEvents>(event: K): void {
    delete this.events[event];
  }

  /**
   * Event emit et
   */
  private emit<K extends keyof CacheEvents>(event: K, ...args: Parameters<CacheEvents[K]>): void {
    const listener = this.events[event];
    if (listener) {
      (listener as any)(...args);
    }
  }

  /**
   * İstatistikleri güncelle
   */
  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    // Storage size'ı güncelle (eğer mümkünse)
    if (this.storage instanceof MemoryStorage) {
      this.stats.size = this.storage.size;
    }
  }

  /**
   * Stale-while-revalidate stratejisi
   */
  async getStaleWhileRevalidate(
    key: string, 
    refreshFn: () => Promise<LaxiosResponse>
  ): Promise<CachedResponse | null> {
    const cached = await this.get(key);
    
    if (cached && this.config.staleWhileRevalidate) {
      // Arka planda refresh et
      refreshFn()
        .then(response => this.set(key, response))
        .catch(() => {
          // Refresh hatası - sessizce devam et
        });
      
      return cached;
    }
    
    return cached;
  }

  /**
   * Cache'i invalidate et (pattern ile)
   */
  async invalidatePattern(pattern: string | RegExp): Promise<void> {
    if (this.storage instanceof MemoryStorage) {
      const keys = Array.from(this.storage.keys());
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      
      for (const key of keys) {
        if (regex.test(key)) {
          await this.delete(key);
        }
      }
    }
  }

  /**
   * Cache warm-up (önceden cache'le)
   */
  async warmUp(requests: Array<{ config: LaxiosRequestConfig; fetcher: () => Promise<LaxiosResponse> }>): Promise<void> {
    const promises = requests.map(async ({ config, fetcher }) => {
      if (this.isCacheable(config)) {
        try {
          const response = await fetcher();
          const key = this.generateKey(config);
          await this.set(key, response);
        } catch (error) {
          // Warm-up hatası - sessizce devam et
        }
      }
    });

    await Promise.allSettled(promises);
  }
}