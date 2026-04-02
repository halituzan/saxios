import { RetryConfig } from '../types';
import { SaxiosRequestConfig, SaxiosResponse, SaxiosError } from '../../types';

/**
 * Configurable retry wrapper for failed requests
 */
export class RetryManager {
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      attempts: config.attempts ?? 3,
      delay: config.delay ?? 1000,
      exponentialBackoff: config.exponentialBackoff ?? true,
      maxDelay: config.maxDelay ?? 30000,
      retryCondition: config.retryCondition ?? this.defaultRetryCondition,
      onRetry: config.onRetry ?? (() => {})
    };
  }

  /**
   * Execute request with retry / backoff
   */
  async executeWithRetry<T = any>(
    requestFn: () => Promise<SaxiosResponse<T>>,
    _requestConfig: SaxiosRequestConfig
  ): Promise<SaxiosResponse<T>> {
    if (!this.config.enabled) {
      return requestFn();
    }

    let lastError: SaxiosError;
    let attempt = 0;

    while (attempt <= this.config.attempts) {
      try {
        const response = await requestFn();
        return response;
      } catch (error: any) {
        lastError = error;
        attempt++;

        // Last attempt — will throw below
        if (attempt > this.config.attempts) {
          break;
        }

        // User-defined retry predicate
        if (!this.config.retryCondition(error)) {
          break;
        }

        // Retry callback
        this.config.onRetry(attempt, error);

        // Wait before next attempt
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Compute delay for attempt N
   */
  private calculateDelay(attempt: number): number {
    if (!this.config.exponentialBackoff) {
      return this.config.delay;
    }

    // Exponential backoff: delay * (2 ^ (attempt - 1))
    const exponentialDelay = this.config.delay * Math.pow(2, attempt - 1);
    
    // Add jitter
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    const totalDelay = exponentialDelay + jitter;
    
    // Cap at maxDelay
    return Math.min(totalDelay, this.config.maxDelay);
  }

  /**
   * Default retry condition
   */
  private defaultRetryCondition(error: SaxiosError): boolean {
    // Network errors
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
      return true;
    }

    // Timeout errors
    if (error.code === 'ERR_TIMEOUT' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // Server errors (5xx)
    if (error.response && error.response.status >= 500) {
      return true;
    }

    // Rate limiting (429)
    if (error.response && error.response.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Merge partial config
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Current retry settings
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Enable retries
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable retries
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Whether retry is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}