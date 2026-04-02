import { OfflineConfig, QueuedRequest } from '../types';
import { SaxiosRequestConfig, SaxiosResponse } from '../../types';

/**
 * Offline queue and reconnect sync (browser-oriented)
 */
export class OfflineManager {
  private config: Required<OfflineConfig>;
  private requestQueue: QueuedRequest[] = [];
  private isOnline: boolean = true;
  private storage?: Storage;

  constructor(config: OfflineConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      storage: config.storage ?? 'localStorage',
      syncOnReconnect: config.syncOnReconnect ?? true,
      queueFailedRequests: config.queueFailedRequests ?? true,
      maxQueueSize: config.maxQueueSize ?? 100,
      retryQueuedRequests: config.retryQueuedRequests ?? true
    };

    if (this.config.enabled) {
      this.initOfflineSupport();
    }
  }

  /**
   * Wire storage, listeners, and persisted queue
   */
  private initOfflineSupport(): void {
    this.initStorage();

    this.setupNetworkListeners();

    this.loadQueue();

    this.checkNetworkStatus();
  }

  /**
   * Resolve Web Storage backend
   */
  private initStorage(): void {
    if (typeof window === 'undefined') return;

    switch (this.config.storage) {
      case 'localStorage':
        this.storage = window.localStorage;
        break;
      case 'sessionStorage':
        this.storage = window.sessionStorage;
        break;
      case 'indexedDB':
        console.warn('IndexedDB storage not implemented yet, falling back to localStorage');
        this.storage = window.localStorage;
        break;
      case 'memory':
        break;
    }
  }

  /**
   * Subscribe to online / offline events
   */
  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.handleOnline();
    });

    window.addEventListener('offline', () => {
      this.handleOffline();
    });
  }

  /**
   * Read initial navigator.onLine
   */
  private checkNetworkStatus(): void {
    if (typeof navigator !== 'undefined') {
      this.isOnline = navigator.onLine;
    }
  }

  /**
   * Browser went online
   */
  private handleOnline(): void {
    this.isOnline = true;
    
    if (this.config.syncOnReconnect) {
      this.syncQueuedRequests();
    }
  }

  /**
   * Browser went offline
   */
  private handleOffline(): void {
    this.isOnline = false;
  }

  /**
   * Queue or execute depending on connectivity
   */
  async handleOfflineRequest(
    config: SaxiosRequestConfig,
    requestFn: () => Promise<SaxiosResponse>
  ): Promise<SaxiosResponse> {
    if (!this.config.enabled) {
      return requestFn();
    }

    if (this.isOnline) {
      try {
        return await requestFn();
      } catch (error: any) {
        if (this.isNetworkError(error) && this.config.queueFailedRequests) {
          this.queueRequest(config);
          throw new Error('Request queued due to network error');
        }
        throw error;
      }
    }

    if (this.config.queueFailedRequests) {
      this.queueRequest(config);
      throw new Error('Request queued - device is offline');
    }

    throw new Error('Device is offline and request queueing is disabled');
  }

  /**
   * Enqueue config for later replay
   */
  private queueRequest(config: SaxiosRequestConfig): void {
    if (this.requestQueue.length >= this.config.maxQueueSize) {
      this.requestQueue.shift();
    }

    const queuedRequest: QueuedRequest = {
      config: { ...config },
      timestamp: Date.now(),
      attempts: 0
    };

    this.requestQueue.push(queuedRequest);
    this.saveQueue();
  }

  /**
   * Replay queued items after reconnect
   */
  private async syncQueuedRequests(): Promise<void> {
    if (!this.config.retryQueuedRequests || this.requestQueue.length === 0) {
      return;
    }

    const requestsToRetry = [...this.requestQueue];
    this.requestQueue = [];

    for (const queuedRequest of requestsToRetry) {
      try {
        await this.retryQueuedRequest(queuedRequest);
      } catch (error) {
        queuedRequest.attempts++;
        
        if (queuedRequest.attempts < 3) {
          this.requestQueue.push(queuedRequest);
        }
      }
    }

    this.saveQueue();
  }

  /**
   * Stub replay — integrate with real HTTP client in production
   */
  private async retryQueuedRequest(queuedRequest: QueuedRequest): Promise<void> {
    console.log('Retrying queued request:', queuedRequest.config.url);
  }

  /**
   * Heuristic network failure detection
   */
  private isNetworkError(error: any): boolean {
    return (
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.message?.includes('Network Error') ||
      error.message?.includes('fetch')
    );
  }

  /**
   * Persist queue JSON
   */
  private saveQueue(): void {
    if (!this.storage) return;

    try {
      const queueData = JSON.stringify(this.requestQueue);
      this.storage.setItem('saxios_offline_queue', queueData);
    } catch (error) {
      console.warn('Failed to save offline queue:', error);
    }
  }

  /**
   * Hydrate queue from storage
   */
  private loadQueue(): void {
    if (!this.storage) return;

    try {
      const queueData = this.storage.getItem('saxios_offline_queue');
      if (queueData) {
        this.requestQueue = JSON.parse(queueData);
      }
    } catch (error) {
      console.warn('Failed to load offline queue:', error);
      this.requestQueue = [];
    }
  }

  /**
   * Drop all queued items
   */
  clearQueue(): void {
    this.requestQueue = [];
    this.saveQueue();
  }

  /**
   * Inspect queue and connectivity
   */
  getQueueStatus(): {
    size: number;
    requests: QueuedRequest[];
    isOnline: boolean;
  } {
    return {
      size: this.requestQueue.length,
      requests: [...this.requestQueue],
      isOnline: this.isOnline
    };
  }

  /**
   * Online durumunu manuel set et
   */
  setOnlineStatus(isOnline: boolean): void {
    const wasOnline = this.isOnline;
    this.isOnline = isOnline;

    if (!wasOnline && isOnline && this.config.syncOnReconnect) {
      this.syncQueuedRequests();
    }
  }

  /**
   * Merge config and optionally init
   */
  updateConfig(newConfig: Partial<OfflineConfig>): void {
    const wasEnabled = this.config.enabled;
    Object.assign(this.config, newConfig);

    if (!wasEnabled && this.config.enabled) {
      this.initOfflineSupport();
    }
  }

  /**
   * Enable offline module
   */
  enable(): void {
    this.config.enabled = true;
    this.initOfflineSupport();
  }

  /**
   * Disable module and clear queue
   */
  disable(): void {
    this.config.enabled = false;
    this.clearQueue();
  }

  /**
   * Whether offline handling is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}