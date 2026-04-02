import { 
  SaxiosRequestConfig, 
  SaxiosResponse, 
  SaxiosAdapter,
  SaxiosHeaders,
  SaxiosProgressEvent
} from '../types';
import { createError, ERROR_CODES } from '../core/SaxiosError';
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
 * Set the global cache manager
 */
export function setGlobalCacheManager(cacheManager: CacheManager): void {
  globalCacheManager = cacheManager;
}

/**
 * Get the global cache manager
 */
export function getGlobalCacheManager(): CacheManager | null {
  return globalCacheManager;
}

/**
 * Fetch-based HTTP adapter (with cache support)
 */
export const fetchAdapter: SaxiosAdapter = async (config: SaxiosRequestConfig): Promise<SaxiosResponse> => {
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
      // Resolve cache configuration
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

      // Build URL
      const fullURL = buildURL(url, params, paramsSerializer);
      
      // Build cache key
      let cacheKey: string | null = null;
      if (cacheManager && cacheManager.isCacheable(config)) {
        cacheKey = createCacheKey({ ...config, url: fullURL });
        
        // Check cache
        const cachedResponse = await cacheManager.get(cacheKey);
        if (cachedResponse) {
          // Cache hit — return cached response
          const response: SaxiosResponse = {
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

      // Create AbortController
      const controller = new AbortController();
      let abortSignal = controller.signal;

      // Merge with existing signal if present
      if (signal) {
        if (signal.aborted) {
          controller.abort();
        } else {
          signal.addEventListener('abort', () => controller.abort());
        }
      }

      // Cancel token check
      if (cancelToken) {
        if (cancelToken.reason) {
          throw cancelToken.reason;
        }
        
        (cancelToken as any).subscribe((_cancel: Cancel) => {
          controller.abort();
          reject(createError('Request canceled', ERROR_CODES.ERR_CANCELED, config, null, undefined));
        });
      }

      // Prepare headers
      const fetchHeaders = new Headers();
      Object.keys(headers).forEach(key => {
        const value = headers[key];
        if (value !== null && value !== undefined) {
          fetchHeaders.set(key, String(value));
        }
      });

      // Prepare request body
      let body: any = data;
      
      if (data !== null && data !== undefined) {
        if (isFormData(data) || isURLSearchParams(data) || 
            isArrayBuffer(data) || isArrayBufferView(data) || 
            typeof data === 'string') {
          // Send these types as-is
        } else if (typeof data === 'object') {
          // Serialize as JSON
          body = JSON.stringify(data);
          if (!fetchHeaders.has('Content-Type')) {
            fetchHeaders.set('Content-Type', 'application/json');
          }
        }
      }

      // Content-Length check
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
        // Note: Fetch API does not support upload progress
        // XMLHttpRequest may be required for this feature
      }

      // Timeout promise
      const promises: Promise<any>[] = [fetch(fullURL, fetchOptions)];
      
      if (timeout > 0) {
        promises.push(createTimeoutPromise(timeout, timeoutErrorMessage));
      }

      // Send request
      const fetchResponse = await Promise.race(promises) as Response;

      // Normalize response headers
      const responseHeaders: SaxiosHeaders = {};
      fetchResponse.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Content-Length check
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
              status: fetchResponse.status,
              statusText: fetchResponse.statusText,
              headers: responseHeaders,
              config
            }
          );
        }
      }

      // Parse response body
      let responseData: any;
      
      try {
        switch (responseType) {
          case 'arraybuffer':
            responseData = await fetchResponse.arrayBuffer();
            break;
          case 'blob':
            responseData = await fetchResponse.blob();
            break;
          case 'text':
            responseData = await fetchResponse.text();
            break;
          case 'json':
            const text = await fetchResponse.text();
            responseData = text ? JSON.parse(text) : null;
            break;
          case 'stream':
            responseData = fetchResponse.body;
            break;
          default:
            responseData = await fetchResponse.text();
        }
      } catch (error) {
        throw createError(
          'Response parsing failed',
          ERROR_CODES.ERR_BAD_RESPONSE,
          config,
          null,
          {
            data: null,
            status: fetchResponse.status,
            statusText: fetchResponse.statusText,
            headers: responseHeaders,
            config
          }
        );
      }

      // Download progress tracking
      if (onDownloadProgress && responseData) {
        const contentLength = parseInt(responseHeaders['content-length'] as string || '0', 10);
        const progressEvent: SaxiosProgressEvent = {
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

      const saxiosResponse: SaxiosResponse = {
        data: responseData,
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: responseHeaders,
        config,
        request: fetchResponse
      };

      // Status validation
      if (validateStatus(saxiosResponse.status)) {
        // Store in cache when cache manager is present and response is cacheable
        if (cacheManager && cacheKey && isCacheableResponse(
          saxiosResponse.status, 
          responseHeaders, 
          method
        )) {
          // Parse TTL from Cache-Control header
          const headerTtl = parseCacheControlTTL(responseHeaders);
          const ttl = headerTtl || (cacheConfig?.ttl);
          
          await cacheManager.set(cacheKey, saxiosResponse, ttl);
        }
        
        resolve(saxiosResponse);
      } else {
        reject(createError(
          `Request failed with status code ${saxiosResponse.status}`,
          ERROR_CODES.ERR_BAD_REQUEST,
          config,
          fetchResponse,
          saxiosResponse
        ));
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        reject(createError('Request canceled', ERROR_CODES.ERR_CANCELED, config, null, undefined));
      } else if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
        reject(createError('Network Error', ERROR_CODES.ERR_NETWORK, config, null, undefined));
      } else if (error instanceof Cancel) {
        reject(error);
      } else if (error.isSaxiosError) {
        reject(error);
      } else {
        reject(createError('Network error', ERROR_CODES.ERR_NETWORK, config, null, undefined));
      }
    }
  });
};

/**
 * Computes approximate content length for progress tracking
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