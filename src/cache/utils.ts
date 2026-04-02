import { SaxiosRequestConfig } from '../types';

/**
 * Builds a deterministic cache key from request config
 */
export function createCacheKey(config: SaxiosRequestConfig): string {
  const method = (config.method || 'GET').toUpperCase();
  const url = config.url || '';
  
  // Normalize URL
  let normalizedUrl = url;
  if (config.baseURL && !url.startsWith('http')) {
    normalizedUrl = config.baseURL.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
  }
  
  // Sort and serialize params
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
  
  // Serialize body for non-GET methods
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
  
  // Headers that affect cache identity
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
  
  // Assemble cache key
  const parts = [method, normalizedUrl, paramsString, dataString, headersString];
  return parts.filter(Boolean).join('|');
}

/**
 * Whether the HTTP method may be cached
 */
export function isCacheableMethod(method: string): boolean {
  const cacheableMethods = ['GET', 'HEAD', 'OPTIONS'];
  return cacheableMethods.includes(method.toUpperCase());
}

/**
 * Whether the HTTP status may be cached
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
 * Parse TTL from Cache-Control header
 */
export function parseCacheControlTTL(headers: Record<string, any>): number | null {
  const cacheControl = headers['cache-control'] || headers['Cache-Control'];
  
  if (!cacheControl || typeof cacheControl !== 'string') {
    return null;
  }
  
  // Look for max-age directive
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  if (maxAgeMatch) {
    return parseInt(maxAgeMatch[1], 10) * 1000; // seconds to ms
  }
  
  return null;
}

/**
 * Whether the response may be stored in cache
 */
export function isCacheableResponse(
  status: number, 
  headers: Record<string, any>, 
  method: string
): boolean {
  // Method check
  if (!isCacheableMethod(method)) {
    return false;
  }
  
  // Status check
  if (!isCacheableStatus(status)) {
    return false;
  }
  
  // Cache-Control check
  const cacheControl = headers['cache-control'] || headers['Cache-Control'];
  if (cacheControl && typeof cacheControl === 'string') {
    const lowerCacheControl = cacheControl.toLowerCase();
    
    // Do not cache when no-cache or no-store
    if (lowerCacheControl.includes('no-cache') || lowerCacheControl.includes('no-store')) {
      return false;
    }
    
    // private — skip client cache (browser semantics)
    if (lowerCacheControl.includes('private')) {
      return false;
    }
  }
  
  return true;
}

/**
 * Hash very long cache keys
 */
export function hashCacheKey(key: string): string {
  if (key.length <= 250) {
    return key; // Short keys unchanged
  }
  
  // Simple string hash
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // coerce to 32-bit int
  }
  
  return `hash_${Math.abs(hash).toString(36)}`;
}

/**
 * Whether a cache entry has expired
 */
export function isCacheExpired(timestamp: number, ttl: number): boolean {
  return Date.now() - timestamp > ttl;
}

/**
 * Whether a cache entry is stale (revalidate window)
 */
export function isCacheStale(timestamp: number, staleTtl: number): boolean {
  return Date.now() - timestamp > staleTtl;
}