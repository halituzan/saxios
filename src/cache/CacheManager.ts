import { SaxiosRequestConfig, SaxiosResponse } from '../types';
import { CacheConfig, CachedResponse, CacheStorage, CacheStats, CacheEvents } from './types';
import { MemoryStorage } from './MemoryStorage';

/**
 * Cache manager
 */
export class CacheManager {
  private config: Required<CacheConfig>;
  private storage: CacheStorage;
  private stats: CacheStats;
  private events: Partial<CacheEvents> = {};

  constructor(config: CacheConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      ttl: config.ttl ?? 300000, // 5 minutes
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
   * Enable caching
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable caching
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Whether caching is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Whether the request may use cache
   */
  isCacheable(config: SaxiosRequestConfig): boolean {
    if (!this.config.enabled) return false;
    
    const method = (config.method || 'GET').toUpperCase();
    return this.config.methods.includes(method);
  }

  /**
   * Whether the response may be stored
   */
  isCacheableResponse(response: SaxiosResponse): boolean {
    if (!this.config.enabled) return false;
    
    return (
      this.config.statusCodes.includes(response.status) &&
      this.config.filter(response)
    );
  }

  /**
   * Build cache key
   */
  generateKey(config: SaxiosRequestConfig): string {
    return this.config.keyGenerator(config);
  }

  /**
   * Default cache key generator
   */
  private defaultKeyGenerator(config: SaxiosRequestConfig): string {
    const method = (config.method || 'GET').toUpperCase();
    const url = config.url || '';
    const params = config.params ? JSON.stringify(config.params) : '';
    const data = config.data ? JSON.stringify(config.data) : '';
    
    return `${method}:${url}:${params}:${data}`;
  }

  /**
   * Read cached response
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
   * Store a response in cache
   */
  async set(key: string, response: SaxiosResponse, ttl?: number): Promise<void> {
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
      // Ignore cache set errors
    }
  }

  /**
   * Remove an entry
   */
  async delete(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
      this.stats.deletes++;
      this.emit('delete', key);
      this.updateStats();
    } catch (error) {
      // Ignore delete errors
    }
  }

  /**
   * Clear all entries
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
      // Ignore clear errors
    }
  }

  /**
   * Whether a key exists
   */
  async has(key: string): Promise<boolean> {
    try {
      return await this.storage.has(key);
    } catch (error) {
      return false;
    }
  }

  /**
   * Snapshot of cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Current configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Subscribe to cache events
   */
  on<K extends keyof CacheEvents>(event: K, listener: CacheEvents[K]): void {
    this.events[event] = listener;
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof CacheEvents>(event: K): void {
    delete this.events[event];
  }

  /**
   * Emit a cache event
   */
  private emit<K extends keyof CacheEvents>(event: K, ...args: Parameters<CacheEvents[K]>): void {
    const listener = this.events[event];
    if (listener) {
      (listener as any)(...args);
    }
  }

  /**
   * Recompute derived stats
   */
  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    // Update storage size when available
    if (this.storage instanceof MemoryStorage) {
      this.stats.size = this.storage.size;
    }
  }

  /**
   * Stale-while-revalidate helper
   */
  async getStaleWhileRevalidate(
    key: string, 
    refreshFn: () => Promise<SaxiosResponse>
  ): Promise<CachedResponse | null> {
    const cached = await this.get(key);
    
    if (cached && this.config.staleWhileRevalidate) {
      // Refresh in background
      refreshFn()
        .then(response => this.set(key, response))
        .catch(() => {
          // Ignore background refresh errors
        });
      
      return cached;
    }
    
    return cached;
  }

  /**
   * Delete keys matching a string or RegExp pattern
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
   * Pre-populate cache (warm-up)
   */
  async warmUp(requests: Array<{ config: SaxiosRequestConfig; fetcher: () => Promise<SaxiosResponse> }>): Promise<void> {
    const promises = requests.map(async ({ config, fetcher }) => {
      if (this.isCacheable(config)) {
        try {
          const response = await fetcher();
          const key = this.generateKey(config);
          await this.set(key, response);
        } catch (error) {
          // Ignore warm-up errors
        }
      }
    });

    await Promise.allSettled(promises);
  }
}