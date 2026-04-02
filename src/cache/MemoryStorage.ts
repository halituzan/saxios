import { CacheStorage, CachedResponse } from './types';

/**
 * In-memory cache storage
 */
export class MemoryStorage implements CacheStorage {
  private cache = new Map<string, CachedResponse>();
  private timers = new Map<string, NodeJS.Timeout>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Read from cache
   */
  get(key: string): CachedResponse | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // TTL check
    if (item.ttl && Date.now() - item.timestamp > item.ttl) {
      this.delete(key);
      return null;
    }

    return item;
  }

  /**
   * Write to cache
   */
  set(key: string, value: CachedResponse, ttl?: number): void {
    // Max size enforcement
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // LRU eviction — drop oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.delete(firstKey);
      }
    }

    // Clear existing expiry timer
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Apply TTL
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
   * Delete a cache entry
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
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    
    // Clear all expiry timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Whether a valid entry exists for key
   */
  has(key: string): boolean {
    return this.cache.has(key) && this.get(key) !== null;
  }

  /**
   * Number of entries
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Iterator over cache keys
   */
  keys(): IterableIterator<string> {
    return this.cache.keys();
  }

  /**
   * Serialize cache to a plain object
   */
  toJSON(): Record<string, CachedResponse> {
    const result: Record<string, CachedResponse> = {};
    for (const [key, value] of this.cache.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Restore cache from serialized data
   */
  fromJSON(data: Record<string, CachedResponse>): void {
    this.clear();
    for (const [key, value] of Object.entries(data)) {
      this.set(key, value);
    }
  }
}