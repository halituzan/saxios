import { SaxiosFeaturesConfig, SaxiosEvents } from './types';
import { SaxiosRequestConfig, SaxiosResponse } from '../types';

// Feature Managers
import { RetryManager } from './retry/RetryManager';
import { DeduplicationManager } from './deduplication/DeduplicationManager';
import { AnalyticsManager } from './analytics/AnalyticsManager';
import { SecurityManager } from './security/SecurityManager';
import { OfflineManager } from './offline/OfflineManager';
import { BatchingManager } from './batching/BatchingManager';
import { LoggingManager } from './logging/LoggingManager';

/**
 * Coordinates optional features (retry, dedup, analytics, etc.)
 */
export class FeatureManager {
  private config: SaxiosFeaturesConfig;
  private eventListeners: Partial<SaxiosEvents> = {};

  // Feature Managers
  public readonly retry: RetryManager;
  public readonly deduplication: DeduplicationManager;
  public readonly analytics: AnalyticsManager;
  public readonly security: SecurityManager;
  public readonly offline: OfflineManager;
  public readonly batching: BatchingManager;
  public readonly logging: LoggingManager;

  constructor(config: SaxiosFeaturesConfig = {}) {
    this.config = config;

    // Initialize feature managers
    this.retry = new RetryManager(config.retry);
    this.deduplication = new DeduplicationManager(config.deduplication);
    this.analytics = new AnalyticsManager(config.analytics);
    this.security = new SecurityManager(config.security);
    this.offline = new OfflineManager(config.offline);
    this.batching = new BatchingManager(config.batching);
    this.logging = new LoggingManager(config.logging);
  }

  /**
   * Run a request through the feature pipeline
   */
  async processRequest<T = any>(
    config: SaxiosRequestConfig,
    requestFn: () => Promise<SaxiosResponse<T>>
  ): Promise<SaxiosResponse<T>> {
    const requestId = this.logging.logRequestStart(config);
    const startTime = Date.now();

    try {
      // Event: request start
      this.emit('request:start', config);

      // Security processing
      let processedConfig = await this.security.secureRequest(config);

      // Build deduplication key
      const dedupKey = this.deduplication.generateKey(processedConfig);

      // Analytics: request start
      const metricId = this.analytics.trackRequestStart(processedConfig);

      // Execute through feature stack
      const response = await this.executeWithFeatures(
        processedConfig,
        requestFn,
        dedupKey,
        requestId
      );

      const duration = Date.now() - startTime;

      // Analytics: request end
      this.analytics.trackRequestEnd(metricId, processedConfig, response, {
        cacheHit: (response as any)._cacheHit
      });

      // Logging: request end
      this.logging.logRequestEnd(requestId, processedConfig, response, duration);

      // Event: request end
      this.emit('request:end', processedConfig, response);

      return response;

    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Analytics: request error
      this.analytics.trackRequestError('', config, error);

      // Logging: request error
      this.logging.logRequestError(requestId, config, error, duration);

      // Event: request error
      this.emit('request:error', config, error);

      throw error;
    }
  }

  /**
   * Compose offline → batching → dedup → retry
   */
  private async executeWithFeatures<T>(
    config: SaxiosRequestConfig,
    requestFn: () => Promise<SaxiosResponse<T>>,
    dedupKey: string,
    _requestId: string
  ): Promise<SaxiosResponse<T>> {
    // Offline handling
    const offlineAwareRequestFn = () => 
      this.offline.handleOfflineRequest(config, requestFn);

    // Batching
    const batchAwareRequestFn = () =>
      this.batching.batchRequest(config, offlineAwareRequestFn);

    // Deduplication
    const dedupAwareRequestFn = () =>
      this.deduplication.deduplicate(dedupKey, batchAwareRequestFn);

    // Retry with all features
    const retryAwareRequestFn = () => {
      return this.retry.executeWithRetry(dedupAwareRequestFn, config);
    };

    return retryAwareRequestFn();
  }

  /**
   * Subscribe to lifecycle events
   */
  on<K extends keyof SaxiosEvents>(event: K, listener: SaxiosEvents[K]): void {
    this.eventListeners[event] = listener;
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof SaxiosEvents>(event: K): void {
    delete this.eventListeners[event];
  }

  /**
   * Emit a lifecycle event
   */
  private emit<K extends keyof SaxiosEvents>(
    event: K, 
    ...args: Parameters<SaxiosEvents[K]>
  ): void {
    const listener = this.eventListeners[event];
    if (listener) {
      (listener as any)(...args);
    }
  }

  /**
   * Snapshot of enabled features and stats
   */
  getFeatureStatus(): {
    retry: { enabled: boolean; config: any };
    deduplication: { enabled: boolean; pendingCount: number };
    analytics: { enabled: boolean; stats: any };
    security: { enabled: boolean };
    offline: { enabled: boolean; queueStatus: any };
    batching: { enabled: boolean; batchStatus: any };
    logging: { enabled: boolean; logStats: any };
  } {
    return {
      retry: {
        enabled: this.retry.isEnabled(),
        config: this.retry.getConfig()
      },
      deduplication: {
        enabled: this.deduplication.isEnabled(),
        pendingCount: this.deduplication.getPendingCount()
      },
      analytics: {
        enabled: this.analytics.isEnabled(),
        stats: this.analytics.getAnalytics()
      },
      security: {
        enabled: this.security.isEnabled()
      },
      offline: {
        enabled: this.offline.isEnabled(),
        queueStatus: this.offline.getQueueStatus()
      },
      batching: {
        enabled: this.batching.isEnabled(),
        batchStatus: this.batching.getBatchStatus()
      },
      logging: {
        enabled: this.logging.isEnabled(),
        logStats: this.logging.getLogStats()
      }
    };
  }

  /**
   * Update feature configuration
   */
  updateConfig(newConfig: Partial<SaxiosFeaturesConfig>): void {
    Object.assign(this.config, newConfig);

    // Propagate to sub-managers
    if (newConfig.retry) {
      this.retry.updateConfig(newConfig.retry);
    }
    if (newConfig.deduplication) {
      this.deduplication.updateConfig(newConfig.deduplication);
    }
    if (newConfig.analytics) {
      this.analytics.updateConfig(newConfig.analytics);
    }
    if (newConfig.security) {
      this.security.updateConfig(newConfig.security);
    }
    if (newConfig.offline) {
      this.offline.updateConfig(newConfig.offline);
    }
    if (newConfig.batching) {
      this.batching.updateConfig(newConfig.batching);
    }
    if (newConfig.logging) {
      this.logging.updateConfig(newConfig.logging);
    }
  }

  /**
   * Enable every feature module
   */
  enableAll(): void {
    this.retry.enable();
    this.deduplication.enable();
    this.analytics.enable();
    this.security.enable();
    this.offline.enable();
    this.batching.enable();
    this.logging.enable();
  }

  /**
   * Disable every feature module
   */
  disableAll(): void {
    this.retry.disable();
    this.deduplication.disable();
    this.analytics.disable();
    this.security.disable();
    this.offline.disable();
    this.batching.disable();
    this.logging.disable();
  }

  /**
   * Tear down listeners and child managers
   */
  destroy(): void {
    this.deduplication.destroy();
    this.analytics.destroy();
    this.batching.destroy();
    this.eventListeners = {};
  }
}