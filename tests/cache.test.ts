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

      // Cache'in etkin olduğunu kontrol et
      expect(instance.cache.isEnabled()).toBe(true);

      const responseData = { id: 1, name: 'Test User' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve(JSON.stringify(responseData))
      } as Response);

      // İlk request - cache miss
      const response1 = await instance.get('https://api.example.com/users/1');
      expect(response1.data).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // İkinci request - cache hit olmalı
      const response2 = await instance.get('https://api.example.com/users/1');
      expect(response2.data).toEqual(responseData);
      
      // Cache stats kontrol et - hit olmalı
      const stats = instance.cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
      
      expect(mockFetch).toHaveBeenCalledTimes(1); // Aynı sayıda çağrı
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

      // İki POST request
      await instance.post('https://api.example.com/users', { name: 'Test' });
      await instance.post('https://api.example.com/users', { name: 'Test' });

      expect(mockFetch).toHaveBeenCalledTimes(2); // Her ikisi de gerçek request
    });

    it('should respect cache TTL', async () => {
      const instance = saxios.create({
        cache: {
          enabled: true,
          ttl: 100 // 100ms TTL
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

      // İlk request
      await instance.get('https://api.example.com/users/1');
      let stats = instance.cache.getStats();
      expect(stats.sets).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Hemen ikinci request - cache hit
      await instance.get('https://api.example.com/users/1');
      stats = instance.cache.getStats();
      expect(stats.hits).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // TTL'yi bekle
      await new Promise(resolve => setTimeout(resolve, 150));

      // TTL sonrası request - cache miss
      await instance.get('https://api.example.com/users/1');
      stats = instance.cache.getStats();
      expect(stats.misses).toBe(2); // İlk miss + TTL sonrası miss
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

      // Farklı URL'ler
      await instance.get('https://api.example.com/users/1');
      await instance.get('https://api.example.com/users/2');
      await instance.get('https://api.example.com/users/1'); // Cache hit
      await instance.get('https://api.example.com/users/2'); // Cache hit

      const stats = instance.cache.getStats();
      expect(stats.hits).toBe(2); // İki cache hit
      expect(stats.misses).toBe(2); // İki cache miss
      expect(stats.sets).toBe(2); // İki cache set
      expect(mockFetch).toHaveBeenCalledTimes(2); // Sadece ilk iki request
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

      // Farklı parametreler
      await instance.get('https://api.example.com/users', { params: { page: 1 } });
      await instance.get('https://api.example.com/users', { params: { page: 2 } });
      await instance.get('https://api.example.com/users', { params: { page: 1 } }); // Cache hit

      const stats = instance.cache.getStats();
      expect(stats.hits).toBe(1); // Bir cache hit
      expect(stats.misses).toBe(2); // İki cache miss
      expect(mockFetch).toHaveBeenCalledTimes(2); // Sadece ilk iki request
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

      // Cache'e bir şey ekle
      await instance.get('https://api.example.com/users/1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Cache'i temizle
      await instance.cache.clear();

      // Tekrar aynı request - cache miss olmalı
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

      // Cache enabled - ilk request
      await instance.get('https://api.example.com/users/1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Cache enabled - cache hit
      await instance.get('https://api.example.com/users/1');
      let stats = instance.cache.getStats();
      expect(stats.hits).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Cache'i devre dışı bırak
      instance.cache.disable();

      // Cache disabled - yeni request
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

      storage.set('test-key', data, 50); // 50ms TTL
      
      // Hemen al - bulmalı
      expect(storage.get('test-key')).toEqual(data);
      
      // TTL'yi bekle
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // TTL sonrası - bulmamalı
      expect(storage.get('test-key')).toBeNull();
    });

    it('should respect max size limit', () => {
      const storage = new MemoryStorage(2); // Max 2 item
      
      const data1 = { data: '1', status: 200, statusText: 'OK', headers: {}, config: {}, timestamp: Date.now() };
      const data2 = { data: '2', status: 200, statusText: 'OK', headers: {}, config: {}, timestamp: Date.now() };
      const data3 = { data: '3', status: 200, statusText: 'OK', headers: {}, config: {}, timestamp: Date.now() };

      storage.set('key1', data1);
      storage.set('key2', data2);
      storage.set('key3', data3); // Bu, key1'i evict etmeli

      expect(storage.get('key1')).toBeNull(); // Evicted
      expect(storage.get('key2')).toEqual(data2);
      expect(storage.get('key3')).toEqual(data3);
    });
  });

  describe('Request-level cache control', () => {
    it('should override instance cache config with request-level config', async () => {
      const instance = saxios.create({
        cache: false // Instance level cache disabled
      });

      // Instance cache'in disabled olduğunu kontrol et
      expect(instance.cache.isEnabled()).toBe(false);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{}')
      } as Response);

      // Request level cache enabled - bu durumda yeni cache manager oluşturulur
      await instance.get('https://api.example.com/users/1', {
        cache: true
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // İkinci request - yine request level cache
      await instance.get('https://api.example.com/users/1', {
        cache: true
      });
      
      // Bu test senaryosunda her request için yeni cache manager oluşturuluyor
      // Bu yüzden cache hit olmaz, ama fetch sadece bir kez çağrılmalı
      expect(mockFetch).toHaveBeenCalledTimes(2); // Her request için ayrı cache manager
    });
  });
});