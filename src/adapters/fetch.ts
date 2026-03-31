import { 
  LaxiosRequestConfig, 
  LaxiosResponse, 
  LaxiosAdapter,
  LaxiosHeaders,
  LaxiosProgressEvent
} from '../types';
import { createError, ERROR_CODES } from '../core/LaxiosError';
import { Cancel } from '../core/Cancel';
import { 
  buildURL, 
  isFormData, 
  isURLSearchParams, 
  isArrayBuffer, 
  isArrayBufferView,
  createTimeoutPromise
} from '../utils';
import { CacheManager } from '../cache/CacheManager';
import { createCacheKey, isCacheableResponse, parseCacheControlTTL } from '../cache/utils';

// Global cache manager instance
let globalCacheManager: CacheManager | null = null;

/**
 * Global cache manager'ı ayarla
 */
export function setGlobalCacheManager(cacheManager: CacheManager): void {
  globalCacheManager = cacheManager;
}

/**
 * Global cache manager'ı al
 */
export function getGlobalCacheManager(): CacheManager | null {
  return globalCacheManager;
}

/**
 * Fetch tabanlı HTTP adapter (cache desteği ile)
 */
export const fetchAdapter: LaxiosAdapter = async (config: LaxiosRequestConfig): Promise<LaxiosResponse> => {
  return new Promise(async (resolve, reject) => {
    const {
      url = '',
      method = 'GET',
      data,
      headers = {},
      params,
      paramsSerializer,
      timeout = 0,
      timeoutErrorMessage,
      withCredentials = false,
      responseType = 'json',
      validateStatus = (status: number) => status >= 200 && status < 300,
      cancelToken,
      signal,
      onUploadProgress,
      onDownloadProgress,
      maxContentLength,
      maxBodyLength
    } = config;

    try {
      // Cache konfigürasyonunu al
      let cacheManager: CacheManager | null = null;
      let cacheConfig: any = null;
      
      if (config.cache) {
        if (typeof config.cache === 'boolean' && config.cache) {
          // Cache enabled, use global manager or create new one
          cacheManager = globalCacheManager || new CacheManager({ enabled: true });
        } else if (typeof config.cache === 'object') {
          // Custom cache config
          cacheConfig = config.cache;
          cacheManager = globalCacheManager || new CacheManager({ ...cacheConfig, enabled: true });
        }
      } else if (globalCacheManager && globalCacheManager.isEnabled()) {
        // Use global cache manager if available and enabled
        cacheManager = globalCacheManager;
      }

      // URL oluştur
      const fullURL = buildURL(url, params, paramsSerializer);
      
      // Cache key oluştur
      let cacheKey: string | null = null;
      if (cacheManager && cacheManager.isCacheable(config)) {
        cacheKey = createCacheKey({ ...config, url: fullURL });
        
        // Cache'den kontrol et
        const cachedResponse = await cacheManager.get(cacheKey);
        if (cachedResponse) {
          // Cache hit - cached response'u döndür
          const response: LaxiosResponse = {
            data: cachedResponse.data,
            status: cachedResponse.status,
            statusText: cachedResponse.statusText,
            headers: cachedResponse.headers,
            config: cachedResponse.config,
            request: null
          };
          
          resolve(response);
          return;
        }
      }

      // AbortController oluştur
      const controller = new AbortController();
      let abortSignal = controller.signal;

      // Mevcut signal varsa birleştir
      if (signal) {
        if (signal.aborted) {
          controller.abort();
        } else {
          signal.addEventListener('abort', () => controller.abort());
        }
      }

      // Cancel token kontrolü
      if (cancelToken) {
        if (cancelToken.reason) {
          throw cancelToken.reason;
        }
        
        (cancelToken as any).subscribe((_cancel: Cancel) => {
          controller.abort();
          reject(createError('Request canceled', ERROR_CODES.ERR_CANCELED, config, null, undefined));
        });
      }

      // Headers'ı hazırla
      const fetchHeaders = new Headers();
      Object.keys(headers).forEach(key => {
        const value = headers[key];
        if (value !== null && value !== undefined) {
          fetchHeaders.set(key, String(value));
        }
      });

      // Request body'yi hazırla
      let body: any = data;
      
      if (data !== null && data !== undefined) {
        if (isFormData(data) || isURLSearchParams(data) || 
            isArrayBuffer(data) || isArrayBufferView(data) || 
            typeof data === 'string') {
          // Bu tipleri olduğu gibi gönder
        } else if (typeof data === 'object') {
          // JSON olarak serialize et
          body = JSON.stringify(data);
          if (!fetchHeaders.has('Content-Type')) {
            fetchHeaders.set('Content-Type', 'application/json');
          }
        }
      }

      // Content-Length kontrolü
      if (maxBodyLength && maxBodyLength > 0 && body) {
        const contentLength = getContentLength(body);
        if (contentLength > maxBodyLength) {
          throw createError(
            `Request body larger than maxBodyLength limit`,
            ERROR_CODES.ERR_BAD_REQUEST,
            config
          );
        }
      }

      // Fetch options
      const fetchOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: fetchHeaders,
        body: ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : body,
        credentials: withCredentials ? 'include' : 'same-origin',
        signal: abortSignal
      };

      // Upload progress tracking
      if (onUploadProgress && body) {
        // Not: Fetch API upload progress'i desteklemiyor
        // Bu özellik için XMLHttpRequest kullanılması gerekebilir
      }

      // Timeout promise
      const promises: Promise<any>[] = [fetch(fullURL, fetchOptions)];
      
      if (timeout > 0) {
        promises.push(createTimeoutPromise(timeout, timeoutErrorMessage));
      }

      // Request'i gönder
      const response = await Promise.race(promises) as Response;

      // Response headers'ını dönüştür
      const responseHeaders: LaxiosHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Content-Length kontrolü
      if (maxContentLength && maxContentLength > 0) {
        const contentLength = parseInt(responseHeaders['content-length'] as string || '0', 10);
        if (contentLength > maxContentLength) {
          throw createError(
            `Response larger than maxContentLength limit`,
            ERROR_CODES.ERR_BAD_RESPONSE,
            config,
            null,
            {
              data: null,
              status: response.status,
              statusText: response.statusText,
              headers: responseHeaders,
              config
            }
          );
        }
      }

      // Response data'yı parse et
      let responseData: any;
      
      try {
        switch (responseType) {
          case 'arraybuffer':
            responseData = await response.arrayBuffer();
            break;
          case 'blob':
            responseData = await response.blob();
            break;
          case 'text':
            responseData = await response.text();
            break;
          case 'json':
            const text = await response.text();
            responseData = text ? JSON.parse(text) : null;
            break;
          case 'stream':
            responseData = response.body;
            break;
          default:
            responseData = await response.text();
        }
      } catch (error) {
        throw createError(
          'Response parsing failed',
          ERROR_CODES.ERR_BAD_RESPONSE,
          config,
          null,
          {
            data: null,
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            config
          }
        );
      }

      // Download progress tracking
      if (onDownloadProgress && responseData) {
        const contentLength = parseInt(responseHeaders['content-length'] as string || '0', 10);
        const progressEvent: LaxiosProgressEvent = {
          loaded: getContentLength(responseData),
          total: contentLength || undefined,
          bytes: getContentLength(responseData),
          download: true
        };
        
        if (progressEvent.total) {
          progressEvent.progress = progressEvent.loaded / progressEvent.total;
        }
        
        onDownloadProgress(progressEvent);
      }

      const laxiosResponse: LaxiosResponse = {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        config,
        request: response
      };

      // Status validation
      if (validateStatus(response.status)) {
        // Cache'e kaydet (eğer cache manager varsa ve cacheable ise)
        if (cacheManager && cacheKey && isCacheableResponse(
          response.status, 
          responseHeaders, 
          method
        )) {
          // Cache-Control header'ından TTL'yi parse et
          const headerTtl = parseCacheControlTTL(responseHeaders);
          const ttl = headerTtl || (cacheConfig?.ttl);
          
          await cacheManager.set(cacheKey, laxiosResponse, ttl);
        }
        
        resolve(laxiosResponse);
      } else {
        reject(createError(
          `Request failed with status code ${response.status}`,
          ERROR_CODES.ERR_BAD_REQUEST,
          config,
          response,
          laxiosResponse
        ));
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        reject(createError('Request canceled', ERROR_CODES.ERR_CANCELED, config, null, undefined));
      } else if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
        reject(createError('Network Error', ERROR_CODES.ERR_NETWORK, config, null, undefined));
      } else if (error instanceof Cancel) {
        reject(error);
      } else if (error.isLaxiosError) {
        reject(error);
      } else {
        reject(createError('Network error', ERROR_CODES.ERR_NETWORK, config, null, undefined));
      }
    }
  });
};

/**
 * Content length hesaplayan yardımcı fonksiyon
 */
function getContentLength(data: any): number {
  if (!data) return 0;
  
  if (typeof data === 'string') {
    return new Blob([data]).size;
  }
  
  if (data instanceof ArrayBuffer) {
    return data.byteLength;
  }
  
  if (data instanceof Blob) {
    return data.size;
  }
  
  if (data.byteLength !== undefined) {
    return data.byteLength;
  }
  
  return 0;
}

export default fetchAdapter;