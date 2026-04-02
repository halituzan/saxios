import saxios from '../src';
import { CacheManager } from '../src/cache/CacheManager';
import { MemoryStorage } from '../src/cache/MemoryStorage';

// Mock fetch
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('saxios Cache System', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Cache Configuration', () => {
    it('should create instance with cache disabled by default', () => {
      const instance = saxios.create();
      expect(instance.cache.isEnabled()).toBe(false);
    });

    it('should create instance with cache enabled when cache: true', () => {
      const instance = saxios.create({
        cache: true
      });
      expect(instance.cache.isEnabled()).toBe(true);
    });

    it('should create instance with custom cache config', () => {
      const instance = saxios.create({
        cache: {
          enabled: true,
          ttl: 60000,
          maxSize: 50
        }
      });
      
      expect(instance.cache.isEnabled()).toBe(true);
      expect(instance.cache.getConfig().ttl).toBe(60000);
      expect(instance.cache.getConfig().maxSize).toBe(50);
    });
  });

  describe('Cache Functionality', () => {
    it('should cache GET requests when cache is enabled', async () => {
      const instance = saxios.create({
        cache: true
      });

      // Ensure cache is enabled
      expect(instance.cache.isEnabled()).toBe(true);

      const responseData = { id: 1, name: 'Test User' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve(JSON.stringify(responseData))
      } as Response);

      // First request — cache miss
      const response1 = await instance.get('https://api.example.com/users/1');
      expect(response1.data).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second request — cache hit
      const response2 = await instance.get('https://api.example.com/users/1');
      expect(response2.data).toEqual(responseData);
      
      // Stats should show one hit
      const stats = instance.cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
      
      expect(mockFetch).toHaveBeenCalledTimes(1); // fetch not called again
    });

    it('should not cache POST requests by default', async () => {
      const instance = saxios.create({
        cache: true
      });

      const responseData = { id: 1, name: 'Created User' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve(JSON.stringify(responseData))
      } as Response);

      // Two POST requests
      await instance.post('https://api.example.com/users', { name: 'Test' });
      await instance.post('https://api.example.com/users', { name: 'Test' });

      expect(mockFetch).toHaveBeenCalledTimes(2); // both hit network
    });

    it('should respect cache TTL', async () => {
      const instance = saxios.create({
        cache: {
          enabled: true,
          ttl: 100 // 100 ms TTL
        }
      });

      const responseData = { id: 1, name: 'Test User' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve(JSON.stringify(responseData))
      } as Response);

      // First request
      await instance.get('https://api.example.com/users/1');
      let stats = instance.cache.getStats();
      expect(stats.sets).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Immediate second request — cache hit
      await instance.get('https://api.example.com/users/1');
      stats = instance.cache.getStats();
      expect(stats.hits).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Wait past TTL
      await new Promise(resolve => setTimeout(resolve, 150));

      // After TTL — cache miss
      await instance.get('https://api.example.com/users/1');
      stats = instance.cache.getStats();
      expect(stats.misses).toBe(2); // initial miss + post-TTL miss
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle different cache keys for different URLs', async () => {
      const instance = saxios.create({
        cache: true
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{}')
      } as Response);

      // Different URLs
      await instance.get('https://api.example.com/users/1');
      await instance.get('https://api.example.com/users/2');
      await instance.get('https://api.example.com/users/1'); // hit
      await instance.get('https://api.example.com/users/2'); // hit

      const stats = instance.cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.sets).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2); // only first two miss network
    });

    it('should handle different cache keys for different params', async () => {
      const instance = saxios.create({
        cache: true
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{}')
      } as Response);

      // Different query params
      await instance.get('https://api.example.com/users', { params: { page: 1 } });
      await instance.get('https://api.example.com/users', { params: { page: 2 } });
      await instance.get('https://api.example.com/users', { params: { page: 1 } }); // hit

      const stats = instance.cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Manager', () => {
    it('should provide cache statistics', async () => {
      const cacheManager = new CacheManager({ enabled: true });
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should clear cache', async () => {
      const instance = saxios.create({
        cache: true
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{}')
      } as Response);

      // Populate cache
      await instance.get('https://api.example.com/users/1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      await instance.cache.clear();

      // Same URL again — miss after clear
      await instance.get('https://api.example.com/users/1');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should enable/disable cache dynamically', async () => {
      const instance = saxios.create({
        cache: true
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{}')
      } as Response);

      // Cache on — first request
      await instance.get('https://api.example.com/users/1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call — hit
      await instance.get('https://api.example.com/users/1');
      let stats = instance.cache.getStats();
      expect(stats.hits).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Disable cache
      instance.cache.disable();

      // Cache off — network again
      await instance.get('https://api.example.com/users/1');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Memory Storage', () => {
    it('should store and retrieve data', () => {
      const storage = new MemoryStorage();
      const data = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        timestamp: Date.now()
      };

      storage.set('test-key', data);
      const retrieved = storage.get('test-key');
      
      expect(retrieved).toEqual(data);
    });

    it('should handle TTL expiration', async () => {
      const storage = new MemoryStorage();
      const data = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        timestamp: Date.now()
      };

      storage.set('test-key', data, 50); // 50 ms TTL
      
      // Should exist immediately
      expect(storage.get('test-key')).toEqual(data);
      
      // Wait past TTL
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Expired — gone
      expect(storage.get('test-key')).toBeNull();
    });

    it('should respect max size limit', () => {
      const storage = new MemoryStorage(2); // max 2 entries
      
      const data1 = { data: '1', status: 200, statusText: 'OK', headers: {}, config: {}, timestamp: Date.now() };
      const data2 = { data: '2', status: 200, statusText: 'OK', headers: {}, config: {}, timestamp: Date.now() };
      const data3 = { data: '3', status: 200, statusText: 'OK', headers: {}, config: {}, timestamp: Date.now() };

      storage.set('key1', data1);
      storage.set('key2', data2);
      storage.set('key3', data3); // should evict key1

      expect(storage.get('key1')).toBeNull();
      expect(storage.get('key2')).toEqual(data2);
      expect(storage.get('key3')).toEqual(data3);
    });
  });

  describe('Request-level cache control', () => {
    it('should override instance cache config with request-level config', async () => {
      const instance = saxios.create({
        cache: false // instance-level cache off
      });

      // Instance cache should stay disabled
      expect(instance.cache.isEnabled()).toBe(false);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{}')
      } as Response);

      // Per-request cache: new manager each time in this path
      await instance.get('https://api.example.com/users/1', {
        cache: true
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second request — same per-request cache behavior
      await instance.get('https://api.example.com/users/1', {
        cache: true
      });
      
      // Each call uses a fresh cache manager — no cross-request hits
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});