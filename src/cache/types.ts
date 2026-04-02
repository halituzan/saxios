import { SaxiosResponse, SaxiosRequestConfig } from '../types';

/**
 * Cache storage interface
 */
export interface CacheStorage {
  get(key: string): Promise<CachedResponse | null> | CachedResponse | null;
  set(key: string, value: CachedResponse, ttl?: number): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
  has(key: string): Promise<boolean> | boolean;
}

/**
 * Cached response data
 */
export interface CachedResponse {
  data: any;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: SaxiosRequestConfig;
  timestamp: number;
  ttl?: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /**
   * Enable or disable caching
   * @default false
   */
  enabled?: boolean;
  
  /**
   * Default TTL in milliseconds
   * @default 300000 (5 minutes)
   */
  ttl?: number;
  
  /**
   * Maximum number of cache entries
   * @default 100
   */
  maxSize?: number;
  
  /**
   * Storage backend
   * @default MemoryStorage
   */
  storage?: CacheStorage;
  
  /**
   * Custom cache key factory
   */
  keyGenerator?: (config: SaxiosRequestConfig) => string;
  
  /**
   * HTTP methods that may be cached
   * @default ['GET']
   */
  methods?: string[];
  
  /**
   * Status codes eligible for caching
   * @default [200, 203, 300, 301, 410]
   */
  statusCodes?: number[];
  
  /**
   * Optional filter for responses to cache
   */
  filter?: (response: SaxiosResponse) => boolean;
  
  /**
   * Stale-while-revalidate: return stale entry and refresh in background
   * @default false
   */
  staleWhileRevalidate?: boolean;
  
  /**
   * Retries on cache miss
   * @default 0
   */
  retryOnCacheMiss?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  hitRate: number;
}

/**
 * Cache events
 */
export interface CacheEvents {
  hit: (key: string, response: CachedResponse) => void;
  miss: (key: string) => void;
  set: (key: string, response: CachedResponse) => void;
  delete: (key: string) => void;
  clear: () => void;
  evict: (key: string, reason: 'ttl' | 'size') => void;
}