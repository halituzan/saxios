import laxios from '../src';
import { RetryManager } from '../src/features/retry/RetryManager';
import { DeduplicationManager } from '../src/features/deduplication/DeduplicationManager';
import { AnalyticsManager } from '../src/features/analytics/AnalyticsManager';
import { LoggingManager } from '../src/features/logging/LoggingManager';

// Mock fetch
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Laxios Advanced Features', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Retry System', () => {
    it('should retry failed requests', async () => {
      const instance = laxios.create({
        features: {
          retry: {
            enabled: true,
            attempts: 2,
            delay: 10
          }
        }
      });

      // İlk iki call fail, üçüncü success
      mockFetch
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          text: () => Promise.resolve('{"success": true}')
        } as Response);

      const response = await instance.get('https://api.example.com/users');
      expect(response.data).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should respect retry configuration', () => {
      const retryManager = new RetryManager({
        enabled: true,
        attempts: 5,
        delay: 2000,
        exponentialBackoff: false
      });

      expect(retryManager.isEnabled()).toBe(true);
      expect(retryManager.getConfig().attempts).toBe(5);
      expect(retryManager.getConfig().delay).toBe(2000);
      expect(retryManager.getConfig().exponentialBackoff).toBe(false);
    });
  });

  describe('Request Deduplication', () => {
    it('should deduplicate identical requests', async () => {
      const instance = laxios.create({
        features: {
          deduplication: {
            enabled: true
          }
        }
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve('{"data": "test"}')
      } as Response);

      // Aynı anda 3 aynı request gönder
      const promises = [
        instance.get('https://api.example.com/users'),
        instance.get('https://api.example.com/users'),
        instance.get('https://api.example.com/users')
      ];

      const responses = await Promise.all(promises);

      // Hepsi aynı response'u almalı
      responses.forEach(response => {
        expect(response.data).toEqual({ data: 'test' });
      });

      // Sadece bir fetch call'u olmalı
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle deduplication manager', () => {
      const dedupManager = new DeduplicationManager({
        enabled: true,
        ttl: 30000
      });

      expect(dedupManager.isEnabled()).toBe(true);
      expect(dedupManager.getPendingCount()).toBe(0);
    });
  });

  describe('Analytics System', () => {
    it('should track request metrics', () => {
      const analyticsManager = new AnalyticsManager({
        enabled: true,
        trackPerformance: true,
        trackErrors: true
      });

      expect(analyticsManager.isEnabled()).toBe(true);

      // Request start track et
      const metricId = analyticsManager.trackRequestStart({
        url: '/test',
        method: 'GET'
      });

      expect(metricId).toBeTruthy();

      // Analytics al
      const analytics = analyticsManager.getAnalytics();
      expect(analytics.totalRequests).toBe(0); // Henüz complete olmadı
    });
  });

  describe('Security Features', () => {
    it('should create instance with security features', () => {
      const instance = laxios.create({
        features: {
          security: {
            enabled: true,
            csrfProtection: true,
            requestSigning: true
          }
        }
      });

      expect(instance.features.security.isEnabled()).toBe(true);
    });
  });

  describe('Offline Support', () => {
    it('should create instance with offline support', () => {
      const instance = laxios.create({
        features: {
          offline: {
            enabled: true,
            queueFailedRequests: true,
            maxQueueSize: 50
          }
        }
      });

      expect(instance.features.offline.isEnabled()).toBe(true);
      
      const queueStatus = instance.features.offline.getQueueStatus();
      expect(queueStatus.size).toBe(0);
    });
  });

  describe('Request Batching', () => {
    it('should create instance with batching', () => {
      const instance = laxios.create({
        features: {
          batching: {
            enabled: true,
            maxBatchSize: 5,
            batchDelay: 100
          }
        }
      });

      expect(instance.features.batching.isEnabled()).toBe(true);
      
      const batchStatus = instance.features.batching.getBatchStatus();
      expect(batchStatus.totalBatches).toBe(0);
    });
  });

  describe('Logging System', () => {
    it('should log requests when enabled', () => {
      const loggingManager = new LoggingManager({
        enabled: true,
        level: 'debug',
        logToConsole: false // Test ortamında console'a log atma
      });

      expect(loggingManager.isEnabled()).toBe(true);

      // Custom log
      loggingManager.logCustom('info', 'Test log message', { test: true });

      // Log'ları al
      const logs = loggingManager.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe('Test log message');
      expect(logs[0].level).toBe('info');
    });

    it('should respect log levels', () => {
      const loggingManager = new LoggingManager({
        enabled: true,
        level: 'warn', // Sadece warn ve error log'ları
        logToConsole: false
      });

      loggingManager.logCustom('debug', 'Debug message'); // Loglanmamalı
      loggingManager.logCustom('info', 'Info message');   // Loglanmamalı
      loggingManager.logCustom('warn', 'Warning message'); // Loglanmalı
      loggingManager.logCustom('error', 'Error message');  // Loglanmalı

      const logs = loggingManager.getLogs();
      expect(logs.length).toBe(2); // Sadece warn ve error
      expect(logs[0].level).toBe('warn');
      expect(logs[1].level).toBe('error');
    });
  });

  describe('Feature Integration', () => {
    it('should create instance with multiple features', () => {
      const instance = laxios.create({
        features: {
          retry: { enabled: true, attempts: 3 },
          deduplication: { enabled: true },
          analytics: { enabled: true },
          logging: { enabled: true, level: 'info' },
          security: { enabled: true },
          offline: { enabled: true },
          batching: { enabled: true }
        }
      });

      // Tüm feature'ların etkin olduğunu kontrol et
      const status = instance.features.getFeatureStatus();
      expect(status.retry.enabled).toBe(true);
      expect(status.deduplication.enabled).toBe(true);
      expect(status.analytics.enabled).toBe(true);
      expect(status.logging.enabled).toBe(true);
      expect(status.security.enabled).toBe(true);
      expect(status.offline.enabled).toBe(true);
      expect(status.batching.enabled).toBe(true);
    });

    it('should update feature configurations', () => {
      const instance = laxios.create({
        features: {
          retry: { enabled: false }
        }
      });

      expect(instance.features.retry.isEnabled()).toBe(false);

      // Konfigürasyonu güncelle
      instance.features.updateConfig({
        retry: { enabled: true, attempts: 5 }
      });

      expect(instance.features.retry.isEnabled()).toBe(true);
      expect(instance.features.retry.getConfig().attempts).toBe(5);
    });

    it('should enable/disable all features', () => {
      const instance = laxios.create();

      // Tüm feature'ları etkinleştir
      instance.features.enableAll();
      
      const statusEnabled = instance.features.getFeatureStatus();
      expect(statusEnabled.retry.enabled).toBe(true);
      expect(statusEnabled.analytics.enabled).toBe(true);

      // Tüm feature'ları devre dışı bırak
      instance.features.disableAll();
      
      const statusDisabled = instance.features.getFeatureStatus();
      expect(statusDisabled.retry.enabled).toBe(false);
      expect(statusDisabled.analytics.enabled).toBe(false);
    });
  });

  describe('Feature Events', () => {
    it('should handle feature events', () => {
      const instance = laxios.create({
        features: {
          logging: { enabled: true, logToConsole: false }
        }
      });

      let requestStarted = false;
      let requestEnded = false;

      // Event listener'ları ekle
      instance.features.on('request:start', () => {
        requestStarted = true;
      });

      instance.features.on('request:end', () => {
        requestEnded = true;
      });

      // Mock response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve('{}')
      } as Response);

      // Request gönder ve event'lerin tetiklendiğini kontrol et
      return instance.get('https://api.example.com/test').then(() => {
        expect(requestStarted).toBe(true);
        expect(requestEnded).toBe(true);
      });
    });
  });
});