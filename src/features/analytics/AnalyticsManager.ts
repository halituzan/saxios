import { AnalyticsConfig, RequestMetrics } from '../types';
import { SaxiosRequestConfig, SaxiosResponse, SaxiosError } from '../../types';

/**
 * Analytics Manager - Request metrics ve analytics toplama
 */
export class AnalyticsManager {
  private config: Required<AnalyticsConfig>;
  private metrics: RequestMetrics[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: AnalyticsConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      trackPerformance: config.trackPerformance ?? true,
      trackErrors: config.trackErrors ?? true,
      trackRetries: config.trackRetries ?? true,
      endpoint: config.endpoint ?? '/analytics',
      batchSize: config.batchSize ?? 50,
      flushInterval: config.flushInterval ?? 30000, // 30 saniye
      customMetrics: config.customMetrics ?? {}
    };

    if (this.config.enabled) {
      this.startFlushTimer();
    }
  }

  /**
   * Request başlangıcını track et
   */
  trackRequestStart(config: SaxiosRequestConfig): string {
    if (!this.config.enabled) return '';

    const metricId = this.generateMetricId();
    const metric: RequestMetrics = {
      url: config.url || '',
      method: (config.method || 'GET').toUpperCase(),
      startTime: Date.now()
    };

    this.metrics.push(metric);
    return metricId;
  }

  /**
   * Request bitişini track et
   */
  trackRequestEnd(
    _metricId: string,
    config: SaxiosRequestConfig,
    response: SaxiosResponse,
    options: {
      cacheHit?: boolean;
      retryCount?: number;
    } = {}
  ): void {
    if (!this.config.enabled || !this.config.trackPerformance) return;

    const metric = this.findMetricByUrl(config.url || '');
    if (metric) {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.status = response.status;
      metric.cacheHit = options.cacheHit;
      metric.retryCount = options.retryCount || 0;

      // Custom metrics çalıştır
      Object.keys(this.config.customMetrics).forEach(key => {
        try {
          (metric as any)[key] = this.config.customMetrics[key](config, response);
        } catch (error) {
          // Custom metric hatası - sessizce devam et
        }
      });
    }

    this.checkFlushCondition();
  }

  /**
   * Request hatasını track et
   */
  trackRequestError(
    _metricId: string,
    config: SaxiosRequestConfig,
    error: SaxiosError,
    options: {
      retryCount?: number;
    } = {}
  ): void {
    if (!this.config.enabled || !this.config.trackErrors) return;

    const metric = this.findMetricByUrl(config.url || '');
    if (metric) {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.error = error.message;
      metric.status = error.response?.status;
      metric.retryCount = options.retryCount || 0;
    }

    this.checkFlushCondition();
  }

  /**
   * Retry'ı track et
   */
  trackRetry(config: SaxiosRequestConfig, attemptNumber: number): void {
    if (!this.config.enabled || !this.config.trackRetries) return;

    const metric = this.findMetricByUrl(config.url || '');
    if (metric) {
      metric.retryCount = attemptNumber;
    }
  }

  /**
   * Custom event track et
   */
  trackCustomEvent(eventName: string, data: any): void {
    if (!this.config.enabled) return;

    const customMetric: RequestMetrics = {
      url: `custom:${eventName}`,
      method: 'CUSTOM',
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      ...data
    };

    this.metrics.push(customMetric);
    this.checkFlushCondition();
  }

  /**
   * Metrics'leri analiz et
   */
  getAnalytics(): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
    slowestRequests: RequestMetrics[];
    errorsByStatus: Record<number, number>;
    requestsByMethod: Record<string, number>;
  } {
    const completedMetrics = this.metrics.filter(m => m.endTime && m.duration !== undefined);
    
    const totalRequests = completedMetrics.length;
    const averageResponseTime = totalRequests > 0 
      ? completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / totalRequests 
      : 0;
    
    const errorCount = completedMetrics.filter(m => m.error).length;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
    
    const cacheHits = completedMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;
    
    const slowestRequests = completedMetrics
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);
    
    const errorsByStatus: Record<number, number> = {};
    const requestsByMethod: Record<string, number> = {};
    
    completedMetrics.forEach(metric => {
      if (metric.status) {
        errorsByStatus[metric.status] = (errorsByStatus[metric.status] || 0) + 1;
      }
      requestsByMethod[metric.method] = (requestsByMethod[metric.method] || 0) + 1;
    });

    return {
      totalRequests,
      averageResponseTime,
      errorRate,
      cacheHitRate,
      slowestRequests,
      errorsByStatus,
      requestsByMethod
    };
  }

  /**
   * Metrics'leri flush et
   */
  async flush(): Promise<void> {
    if (!this.config.enabled || this.metrics.length === 0) return;

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    try {
      // Analytics endpoint'ine gönder
      if (this.config.endpoint) {
        await this.sendToEndpoint(metricsToSend);
      }
    } catch (error) {
      // Analytics gönderme hatası - metrics'leri geri koy
      this.metrics.unshift(...metricsToSend);
    }
  }

  /**
   * Metrics'leri endpoint'e gönder
   */
  private async sendToEndpoint(metrics: RequestMetrics[]): Promise<void> {
    // Bu kısım gerçek implementasyonda fetch ile yapılacak
    // Şimdilik console'a log at
    console.log('Analytics metrics sent:', {
      endpoint: this.config.endpoint,
      count: metrics.length,
      metrics: metrics.slice(0, 5) // İlk 5 metric'i göster
    });
  }

  /**
   * Flush timer başlat
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Flush condition kontrol et
   */
  private checkFlushCondition(): void {
    if (this.metrics.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Metric ID oluştur
   */
  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * URL'e göre metric bul
   */
  private findMetricByUrl(url: string): RequestMetrics | undefined {
    // Son eklenen metric'i bul (genelde aynı request olur)
    for (let i = this.metrics.length - 1; i >= 0; i--) {
      const metric = this.metrics[i];
      if (metric.url === url && !metric.endTime) {
        return metric;
      }
    }
    return undefined;
  }

  /**
   * Konfigürasyonu güncelle
   */
  updateConfig(newConfig: Partial<AnalyticsConfig>): void {
    const wasEnabled = this.config.enabled;
    Object.assign(this.config, newConfig);

    // Timer yönetimi
    if (!wasEnabled && this.config.enabled) {
      this.startFlushTimer();
    } else if (wasEnabled && !this.config.enabled) {
      this.stopFlushTimer();
    }
  }

  /**
   * Flush timer'ı durdur
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Analytics'i etkinleştir
   */
  enable(): void {
    this.config.enabled = true;
    this.startFlushTimer();
  }

  /**
   * Analytics'i devre dışı bırak
   */
  disable(): void {
    this.config.enabled = false;
    this.stopFlushTimer();
  }

  /**
   * Etkin mi kontrol et
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Temizlik yap
   */
  destroy(): void {
    this.stopFlushTimer();
    this.flush(); // Son metrics'leri gönder
  }
}