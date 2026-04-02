import { SaxiosRequestConfig } from '../types';

/**
 * Cache key oluşturan utility fonksiyon
 */
export function createCacheKey(config: SaxiosRequestConfig): string {
  const method = (config.method || 'GET').toUpperCase();
  const url = config.url || '';
  
  // URL'i normalize et
  let normalizedUrl = url;
  if (config.baseURL && !url.startsWith('http')) {
    normalizedUrl = config.baseURL.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
  }
  
  // Params'ı sırala ve serialize et
  let paramsString = '';
  if (config.params) {
    const sortedParams = Object.keys(config.params)
      .sort()
      .reduce((result: Record<string, any>, key) => {
        result[key] = config.params[key];
        return result;
      }, {});
    paramsString = JSON.stringify(sortedParams);
  }
  
  // Data'yı serialize et (sadece GET dışındaki metodlar için)
  let dataString = '';
  if (method !== 'GET' && config.data) {
    if (typeof config.data === 'object') {
      try {
        dataString = JSON.stringify(config.data);
      } catch (error) {
        dataString = String(config.data);
      }
    } else {
      dataString = String(config.data);
    }
  }
  
  // Headers'dan cache'i etkileyebilecek olanları al
  const relevantHeaders: Record<string, string> = {};
  if (config.headers) {
    const cacheRelevantHeaders = ['authorization', 'accept', 'content-type'];
    Object.keys(config.headers).forEach(key => {
      if (cacheRelevantHeaders.includes(key.toLowerCase())) {
        relevantHeaders[key.toLowerCase()] = String(config.headers![key]);
      }
    });
  }
  const headersString = Object.keys(relevantHeaders).length > 0 
    ? JSON.stringify(relevantHeaders) 
    : '';
  
  // Cache key'i oluştur
  const parts = [method, normalizedUrl, paramsString, dataString, headersString];
  return parts.filter(Boolean).join('|');
}

/**
 * HTTP metodunun cache'lenebilir olup olmadığını kontrol et
 */
export function isCacheableMethod(method: string): boolean {
  const cacheableMethods = ['GET', 'HEAD', 'OPTIONS'];
  return cacheableMethods.includes(method.toUpperCase());
}

/**
 * HTTP status kodunun cache'lenebilir olup olmadığını kontrol et
 */
export function isCacheableStatus(status: number): boolean {
  const cacheableStatuses = [
    200, // OK
    203, // Non-Authoritative Information
    300, // Multiple Choices
    301, // Moved Permanently
    302, // Found
    304, // Not Modified
    307, // Temporary Redirect
    308, // Permanent Redirect
    410, // Gone
    414, // URI Too Long
    501  // Not Implemented
  ];
  
  return cacheableStatuses.includes(status);
}

/**
 * Cache TTL'yi hesapla (Cache-Control header'ından)
 */
export function parseCacheControlTTL(headers: Record<string, any>): number | null {
  const cacheControl = headers['cache-control'] || headers['Cache-Control'];
  
  if (!cacheControl || typeof cacheControl !== 'string') {
    return null;
  }
  
  // max-age directive'ini ara
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  if (maxAgeMatch) {
    return parseInt(maxAgeMatch[1], 10) * 1000; // saniyeyi milisaniyeye çevir
  }
  
  return null;
}

/**
 * Response'un cache'lenebilir olup olmadığını kontrol et
 */
export function isCacheableResponse(
  status: number, 
  headers: Record<string, any>, 
  method: string
): boolean {
  // Method kontrolü
  if (!isCacheableMethod(method)) {
    return false;
  }
  
  // Status kontrolü
  if (!isCacheableStatus(status)) {
    return false;
  }
  
  // Cache-Control kontrolü
  const cacheControl = headers['cache-control'] || headers['Cache-Control'];
  if (cacheControl && typeof cacheControl === 'string') {
    const lowerCacheControl = cacheControl.toLowerCase();
    
    // no-cache veya no-store varsa cache'leme
    if (lowerCacheControl.includes('no-cache') || lowerCacheControl.includes('no-store')) {
      return false;
    }
    
    // private varsa cache'leme (sadece browser cache'i için)
    if (lowerCacheControl.includes('private')) {
      return false;
    }
  }
  
  return true;
}

/**
 * Cache key'i hash'le (uzun key'ler için)
 */
export function hashCacheKey(key: string): string {
  if (key.length <= 250) {
    return key; // Kısa key'leri olduğu gibi kullan
  }
  
  // Basit hash fonksiyonu
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32-bit integer'a çevir
  }
  
  return `hash_${Math.abs(hash).toString(36)}`;
}

/**
 * Cache entry'nin expired olup olmadığını kontrol et
 */
export function isCacheExpired(timestamp: number, ttl: number): boolean {
  return Date.now() - timestamp > ttl;
}

/**
 * Cache entry'nin stale olup olmadığını kontrol et
 */
export function isCacheStale(timestamp: number, staleTtl: number): boolean {
  return Date.now() - timestamp > staleTtl;
}