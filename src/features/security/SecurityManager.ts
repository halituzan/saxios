import { SecurityConfig } from '../types';
import { SaxiosRequestConfig, SaxiosHeaders } from '../../types';

/**
 * Optional CSRF, signing, and redaction helpers
 */
export class SecurityManager {
  private config: Required<SecurityConfig>;
  private csrfToken?: string;

  constructor(config: SecurityConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      csrfProtection: config.csrfProtection ?? false,
      requestSigning: config.requestSigning ?? false,
      encryptSensitiveData: config.encryptSensitiveData ?? [],
      sanitizeHeaders: config.sanitizeHeaders ?? ['authorization', 'cookie', 'x-api-key'],
      validateCertificates: config.validateCertificates ?? true,
      allowedOrigins: config.allowedOrigins ?? []
    };

    if (this.config.csrfProtection) {
      this.initCSRFProtection();
    }
  }

  /**
   * Apply enabled security transformations
   */
  async secureRequest(config: SaxiosRequestConfig): Promise<SaxiosRequestConfig> {
    if (!this.config.enabled) return config;

    let securedConfig = { ...config };

    // Allowed origin list
    if (this.config.allowedOrigins.length > 0) {
      securedConfig = this.validateOrigin(securedConfig);
    }

    // CSRF protection
    if (this.config.csrfProtection) {
      securedConfig = this.addCSRFToken(securedConfig);
    }

    // Request signing
    if (this.config.requestSigning) {
      securedConfig = await this.signRequest(securedConfig);
    }

    // Sensitive data encryption
    if (this.config.encryptSensitiveData.length > 0) {
      securedConfig = this.encryptSensitiveData(securedConfig);
    }

    // Header sanitization
    securedConfig = this.sanitizeHeaders(securedConfig);

    return securedConfig;
  }

  /**
   * Origin validation
   */
  private validateOrigin(config: SaxiosRequestConfig): SaxiosRequestConfig {
    if (!config.url) return config;

    try {
      const url = new URL(config.url, config.baseURL);
      const origin = url.origin;

      if (!this.config.allowedOrigins.includes(origin)) {
        throw new Error(`Origin not allowed: ${origin}`);
      }
    } catch (error) {
      if (error instanceof TypeError) {
        // Relative URL - allow it
        return config;
      }
      throw error;
    }

    return config;
  }

  /**
   * Inject CSRF header
   */
  private addCSRFToken(config: SaxiosRequestConfig): SaxiosRequestConfig {
    if (!this.csrfToken) {
      this.csrfToken = this.generateCSRFToken();
    }

    const headers: SaxiosHeaders = {
      ...config.headers,
      'X-CSRF-Token': this.csrfToken
    };

    return { ...config, headers };
  }

  /**
   * Attach signature headers
   */
  private async signRequest(config: SaxiosRequestConfig): Promise<SaxiosRequestConfig> {
    const timestamp = Date.now().toString();
    const nonce = this.generateNonce();
    
    const payload = this.createSignaturePayload(config, timestamp, nonce);
    
    // Production code should use HMAC-SHA256
    const signature = await this.calculateSignature(payload);

    const headers: SaxiosHeaders = {
      ...config.headers,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Signature': signature
    };

    return { ...config, headers };
  }

  /**
   * Demo XOR on selected body fields
   */
  private encryptSensitiveData(config: SaxiosRequestConfig): SaxiosRequestConfig {
    if (!config.data || typeof config.data !== 'object') {
      return config;
    }

    const encryptedData = { ...config.data };

    this.config.encryptSensitiveData.forEach(field => {
      if (encryptedData[field]) {
        encryptedData[field] = this.encrypt(encryptedData[field]);
      }
    });

    return { ...config, data: encryptedData };
  }

  /**
   * Redact configured sensitive headers
   */
  private sanitizeHeaders(config: SaxiosRequestConfig): SaxiosRequestConfig {
    if (!config.headers) return config;

    const sanitizedHeaders: SaxiosHeaders = {};

    Object.keys(config.headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      
      if (this.config.sanitizeHeaders.includes(lowerKey)) {
        // Replace with placeholder
        sanitizedHeaders[key] = '[REDACTED]';
      } else {
        sanitizedHeaders[key] = config.headers![key];
      }
    });

    return { ...config, headers: sanitizedHeaders };
  }

  /**
   * Load CSRF token from DOM when available
   */
  private initCSRFProtection(): void {
    // `<meta name="csrf-token">`
    if (typeof document !== 'undefined') {
      const metaTag = document.querySelector('meta[name="csrf-token"]');
      if (metaTag) {
        this.csrfToken = metaTag.getAttribute('content') || undefined;
      }
    }

    // Fallback: XSRF-TOKEN cookie
    if (typeof document !== 'undefined' && !this.csrfToken) {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'XSRF-TOKEN') {
          this.csrfToken = decodeURIComponent(value);
          break;
        }
      }
    }
  }

  /**
   * Generate random CSRF token
   */
  private generateCSRFToken(): string {
    const array = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Random nonce for signing
   */
  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Canonical string for HMAC input
   */
  private createSignaturePayload(
    config: SaxiosRequestConfig, 
    timestamp: string, 
    nonce: string
  ): string {
    const method = (config.method || 'GET').toUpperCase();
    const url = config.url || '';
    const data = config.data ? JSON.stringify(config.data) : '';
    
    return `${method}|${url}|${data}|${timestamp}|${nonce}`;
  }

  /**
   * Stub hash — replace with HMAC in production
   */
  private async calculateSignature(payload: string): Promise<string> {
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32-bit int
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Demo XOR — use AES-GCM in production
   */
  private encrypt(data: string): string {
    const key = 'saxios-security-key';
    let encrypted = '';
    
    for (let i = 0; i < data.length; i++) {
      const keyChar = key.charCodeAt(i % key.length);
      const dataChar = data.charCodeAt(i);
      encrypted += String.fromCharCode(dataChar ^ keyChar);
    }
    
    return btoa(encrypted); // Base64 encode
  }

  /**
   * Manually set CSRF token
   */
  setCSRFToken(token: string): void {
    this.csrfToken = token;
  }

  /**
   * Current CSRF token if any
   */
  getCSRFToken(): string | undefined {
    return this.csrfToken;
  }

  /**
   * Merge partial security config
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    Object.assign(this.config, newConfig);
    
    if (this.config.csrfProtection && !this.csrfToken) {
      this.initCSRFProtection();
    }
  }

  /**
   * Enable security pipeline
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable security pipeline
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Whether security pipeline is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}