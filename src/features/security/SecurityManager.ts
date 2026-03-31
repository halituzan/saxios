import { SecurityConfig } from '../types';
import { LaxiosRequestConfig, LaxiosHeaders } from '../../types';

/**
 * Security Manager - Güvenlik özellikleri
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
   * Request'i güvenlik kontrollerinden geçir
   */
  async secureRequest(config: LaxiosRequestConfig): Promise<LaxiosRequestConfig> {
    if (!this.config.enabled) return config;

    let securedConfig = { ...config };

    // Origin kontrolü
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
  private validateOrigin(config: LaxiosRequestConfig): LaxiosRequestConfig {
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
   * CSRF token ekle
   */
  private addCSRFToken(config: LaxiosRequestConfig): LaxiosRequestConfig {
    if (!this.csrfToken) {
      this.csrfToken = this.generateCSRFToken();
    }

    const headers: LaxiosHeaders = {
      ...config.headers,
      'X-CSRF-Token': this.csrfToken
    };

    return { ...config, headers };
  }

  /**
   * Request imzala
   */
  private async signRequest(config: LaxiosRequestConfig): Promise<LaxiosRequestConfig> {
    const timestamp = Date.now().toString();
    const nonce = this.generateNonce();
    
    // Signature payload oluştur
    const payload = this.createSignaturePayload(config, timestamp, nonce);
    
    // Signature hesapla (gerçek implementasyonda HMAC-SHA256 kullanılır)
    const signature = await this.calculateSignature(payload);

    const headers: LaxiosHeaders = {
      ...config.headers,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Signature': signature
    };

    return { ...config, headers };
  }

  /**
   * Sensitive data'yı şifrele
   */
  private encryptSensitiveData(config: LaxiosRequestConfig): LaxiosRequestConfig {
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
   * Header'ları sanitize et
   */
  private sanitizeHeaders(config: LaxiosRequestConfig): LaxiosRequestConfig {
    if (!config.headers) return config;

    const sanitizedHeaders: LaxiosHeaders = {};

    Object.keys(config.headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      
      if (this.config.sanitizeHeaders.includes(lowerKey)) {
        // Sensitive header'ı log'lama
        sanitizedHeaders[key] = '[REDACTED]';
      } else {
        sanitizedHeaders[key] = config.headers![key];
      }
    });

    return { ...config, headers: sanitizedHeaders };
  }

  /**
   * CSRF protection başlat
   */
  private initCSRFProtection(): void {
    // Meta tag'den CSRF token al
    if (typeof document !== 'undefined') {
      const metaTag = document.querySelector('meta[name="csrf-token"]');
      if (metaTag) {
        this.csrfToken = metaTag.getAttribute('content') || undefined;
      }
    }

    // Cookie'den CSRF token al
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
   * CSRF token oluştur
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
   * Nonce oluştur
   */
  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Signature payload oluştur
   */
  private createSignaturePayload(
    config: LaxiosRequestConfig, 
    timestamp: string, 
    nonce: string
  ): string {
    const method = (config.method || 'GET').toUpperCase();
    const url = config.url || '';
    const data = config.data ? JSON.stringify(config.data) : '';
    
    return `${method}|${url}|${data}|${timestamp}|${nonce}`;
  }

  /**
   * Signature hesapla
   */
  private async calculateSignature(payload: string): Promise<string> {
    // Gerçek implementasyonda HMAC-SHA256 kullanılır
    // Şimdilik basit hash
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32-bit integer'a çevir
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Basit şifreleme (gerçek implementasyonda AES kullanılır)
   */
  private encrypt(data: string): string {
    // Basit XOR şifreleme (demo amaçlı)
    const key = 'laxios-security-key';
    let encrypted = '';
    
    for (let i = 0; i < data.length; i++) {
      const keyChar = key.charCodeAt(i % key.length);
      const dataChar = data.charCodeAt(i);
      encrypted += String.fromCharCode(dataChar ^ keyChar);
    }
    
    return btoa(encrypted); // Base64 encode
  }

  /**
   * CSRF token'ı manuel set et
   */
  setCSRFToken(token: string): void {
    this.csrfToken = token;
  }

  /**
   * CSRF token'ı al
   */
  getCSRFToken(): string | undefined {
    return this.csrfToken;
  }

  /**
   * Konfigürasyonu güncelle
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    Object.assign(this.config, newConfig);
    
    if (this.config.csrfProtection && !this.csrfToken) {
      this.initCSRFProtection();
    }
  }

  /**
   * Security'yi etkinleştir
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Security'yi devre dışı bırak
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Etkin mi kontrol et
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}