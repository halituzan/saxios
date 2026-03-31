import { CacheStorage, CachedResponse } from './types';

/**
 * Memory tabanlı cache storage
 */
export class MemoryStorage implements CacheStorage {
  private cache = new Map<string, CachedResponse>();
  private timers = new Map<string, NodeJS.Timeout>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Cache'den veri al
   */
  get(key: string): CachedResponse | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // TTL kontrolü
    if (item.ttl && Date.now() - item.timestamp > item.ttl) {
      this.delete(key);
      return null;
    }

    return item;
  }

  /**
   * Cache'e veri kaydet
   */
  set(key: string, value: CachedResponse, ttl?: number): void {
    // Max size kontrolü
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // LRU eviction - en eski item'ı sil
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.delete(firstKey);
      }
    }

    // Mevcut timer'ı temizle
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // TTL ayarla
    const finalTtl = ttl || value.ttl;
    if (finalTtl) {
      value.ttl = finalTtl;
      
      // Auto-expire timer
      const timer = setTimeout(() => {
        this.delete(key);
      }, finalTtl);
      
      this.timers.set(key, timer);
    }

    this.cache.set(key, value);
  }

  /**
   * Cache'den veri sil
   */
  delete(key: string): void {
    this.cache.delete(key);
    
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Tüm cache'i temizle
   */
  clear(): void {
    this.cache.clear();
    
    // Tüm timer'ları temizle
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Key'in cache'de olup olmadığını kontrol et
   */
  has(key: string): boolean {
    return this.cache.has(key) && this.get(key) !== null;
  }

  /**
   * Cache boyutu
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Tüm key'leri döndür
   */
  keys(): IterableIterator<string> {
    return this.cache.keys();
  }

  /**
   * Cache'i JSON'a serialize et
   */
  toJSON(): Record<string, CachedResponse> {
    const result: Record<string, CachedResponse> = {};
    for (const [key, value] of this.cache.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * JSON'dan cache'i restore et
   */
  fromJSON(data: Record<string, CachedResponse>): void {
    this.clear();
    for (const [key, value] of Object.entries(data)) {
      this.set(key, value);
    }
  }
}