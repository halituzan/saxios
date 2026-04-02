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
   * Cache'i etkinleştir/devre dışı bırak
   * @default false
   */
  enabled?: boolean;
  
  /**
   * Default TTL (Time To Live) milisaniye cinsinden
   * @default 300000 (5 dakika)
   */
  ttl?: number;
  
  /**
   * Maximum cache size (entry sayısı)
   * @default 100
   */
  maxSize?: number;
  
  /**
   * Cache storage implementasyonu
   * @default MemoryStorage
   */
  storage?: CacheStorage;
  
  /**
   * Cache key oluşturan fonksiyon
   */
  keyGenerator?: (config: SaxiosRequestConfig) => string;
  
  /**
   * Hangi HTTP metodlarının cache'leneceği
   * @default ['GET']
   */
  methods?: string[];
  
  /**
   * Hangi status kodlarının cache'leneceği
   * @default [200, 203, 300, 301, 410]
   */
  statusCodes?: number[];
  
  /**
   * Cache'lenecek response'ları filtreleyen fonksiyon
   */
  filter?: (response: SaxiosResponse) => boolean;
  
  /**
   * Stale-while-revalidate stratejisi
   * Eski cache'i döndürür ve arka planda yeniler
   * @default false
   */
  staleWhileRevalidate?: boolean;
  
  /**
   * Cache miss durumunda retry sayısı
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