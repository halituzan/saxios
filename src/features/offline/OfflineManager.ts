import { OfflineConfig, QueuedRequest } from '../types';
import { SaxiosRequestConfig, SaxiosResponse } from '../../types';

/**
 * Offline Manager - Offline support ve request queue
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
   * Offline support başlat
   */
  private initOfflineSupport(): void {
    // Storage'ı başlat
    this.initStorage();

    // Network durumunu dinle
    this.setupNetworkListeners();

    // Mevcut queue'yu yükle
    this.loadQueue();

    // İlk network durumunu kontrol et
    this.checkNetworkStatus();
  }

  /**
   * Storage'ı başlat
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
        // IndexedDB implementasyonu daha karmaşık olacak
        console.warn('IndexedDB storage not implemented yet, falling back to localStorage');
        this.storage = window.localStorage;
        break;
      case 'memory':
        // Memory storage - sadece runtime'da kalır
        break;
    }
  }

  /**
   * Network listener'ları kur
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
   * Network durumunu kontrol et
   */
  private checkNetworkStatus(): void {
    if (typeof navigator !== 'undefined') {
      this.isOnline = navigator.onLine;
    }
  }

  /**
   * Online durumunu handle et
   */
  private handleOnline(): void {
    this.isOnline = true;
    
    if (this.config.syncOnReconnect) {
      this.syncQueuedRequests();
    }
  }

  /**
   * Offline durumunu handle et
   */
  private handleOffline(): void {
    this.isOnline = false;
  }

  /**
   * Request'i offline durumda handle et
   */
  async handleOfflineRequest(
    config: SaxiosRequestConfig,
    requestFn: () => Promise<SaxiosResponse>
  ): Promise<SaxiosResponse> {
    if (!this.config.enabled) {
      return requestFn();
    }

    // Online ise normal request gönder
    if (this.isOnline) {
      try {
        return await requestFn();
      } catch (error: any) {
        // Network error ise queue'ya ekle
        if (this.isNetworkError(error) && this.config.queueFailedRequests) {
          this.queueRequest(config);
          throw new Error('Request queued due to network error');
        }
        throw error;
      }
    }

    // Offline ise queue'ya ekle
    if (this.config.queueFailedRequests) {
      this.queueRequest(config);
      throw new Error('Request queued - device is offline');
    }

    throw new Error('Device is offline and request queueing is disabled');
  }

  /**
   * Request'i queue'ya ekle
   */
  private queueRequest(config: SaxiosRequestConfig): void {
    // Queue size kontrolü
    if (this.requestQueue.length >= this.config.maxQueueSize) {
      // En eski request'i çıkar (FIFO)
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
   * Queue'daki request'leri sync et
   */
  private async syncQueuedRequests(): Promise<void> {
    if (!this.config.retryQueuedRequests || this.requestQueue.length === 0) {
      return;
    }

    const requestsToRetry = [...this.requestQueue];
    this.requestQueue = [];

    for (const queuedRequest of requestsToRetry) {
      try {
        // Request'i tekrar dene
        await this.retryQueuedRequest(queuedRequest);
      } catch (error) {
        // Retry başarısız - tekrar queue'ya ekle
        queuedRequest.attempts++;
        
        // Max attempt kontrolü
        if (queuedRequest.attempts < 3) {
          this.requestQueue.push(queuedRequest);
        }
      }
    }

    this.saveQueue();
  }

  /**
   * Queue'daki request'i tekrar dene
   */
  private async retryQueuedRequest(queuedRequest: QueuedRequest): Promise<void> {
    // Bu kısım gerçek implementasyonda fetch ile yapılacak
    // Şimdilik mock response döndür
    console.log('Retrying queued request:', queuedRequest.config.url);
  }

  /**
   * Network error kontrolü
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
   * Queue'yu storage'a kaydet
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
   * Queue'yu storage'dan yükle
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
   * Queue'yu temizle
   */
  clearQueue(): void {
    this.requestQueue = [];
    this.saveQueue();
  }

  /**
   * Queue durumunu al
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
   * Konfigürasyonu güncelle
   */
  updateConfig(newConfig: Partial<OfflineConfig>): void {
    const wasEnabled = this.config.enabled;
    Object.assign(this.config, newConfig);

    if (!wasEnabled && this.config.enabled) {
      this.initOfflineSupport();
    }
  }

  /**
   * Offline support'ı etkinleştir
   */
  enable(): void {
    this.config.enabled = true;
    this.initOfflineSupport();
  }

  /**
   * Offline support'ı devre dışı bırak
   */
  disable(): void {
    this.config.enabled = false;
    this.clearQueue();
  }

  /**
   * Etkin mi kontrol et
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}