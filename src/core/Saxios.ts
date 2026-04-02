import {
  SaxiosRequestConfig,
  SaxiosResponse,
  SaxiosHeaders,
  Method,
  SaxiosTransformer
} from '../types';
import { InterceptorManager, runInterceptors, runErrorInterceptors } from '../interceptors/InterceptorManager';
import { createError, ERROR_CODES } from './SaxiosError';
import fetchAdapter, { setGlobalCacheManager } from '../adapters/fetch';
import { CacheManager } from '../cache/CacheManager';
import { FeatureManager } from '../features/FeatureManager';
import {
  mergeConfig,
  buildFullPath,
  normalizeHeaderName,
  deepMerge,
  isString,
  isObject,
  isFormData,
  isURLSearchParams
} from '../utils';

/**
 * Default transformers
 */
const DEFAULT_TRANSFORMERS = {
  request: [
    function transformRequest(data: any, headers: SaxiosHeaders): any {
      normalizeHeaderName(headers, 'Accept');
      normalizeHeaderName(headers, 'Content-Type');

      if (isFormData(data) || isURLSearchParams(data) || 
          typeof data === 'string' || data instanceof ArrayBuffer) {
        return data;
      }

      if (isObject(data)) {
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json;charset=utf-8';
        }
        return JSON.stringify(data);
      }

      return data;
    }
  ] as SaxiosTransformer[],

  response: [
    function transformResponse(data: any): any {
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch (e) {
          // JSON parse edilemezse string olarak döndür
        }
      }
      return data;
    }
  ] as SaxiosTransformer[]
};

/**
 * Default headers
 */
const DEFAULT_HEADERS = {
  common: {
    'Accept': 'application/json, text/plain, */*'
  },
  delete: {},
  get: {},
  head: {},
  post: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  put: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  patch: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
};

/**
 * Ana Saxios sınıfı
 */
export class Saxios {
  public defaults: SaxiosRequestConfig;
  public interceptors: {
    request: InterceptorManager<SaxiosRequestConfig>;
    response: InterceptorManager<SaxiosResponse>;
  };
  public cache: CacheManager;
  public features: FeatureManager;

  constructor(instanceConfig?: SaxiosRequestConfig) {
    this.defaults = {
      adapter: fetchAdapter,
      transformRequest: DEFAULT_TRANSFORMERS.request,
      transformResponse: DEFAULT_TRANSFORMERS.response,
      timeout: 0,
      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',
      maxContentLength: -1,
      maxBodyLength: -1,
      validateStatus: (status: number) => status >= 200 && status < 300,
      headers: deepMerge(DEFAULT_HEADERS.common, DEFAULT_HEADERS.get, {})
    };

    if (instanceConfig) {
      this.defaults = mergeConfig(this.defaults, instanceConfig);
    }

    this.interceptors = {
      request: new InterceptorManager<SaxiosRequestConfig>(),
      response: new InterceptorManager<SaxiosResponse>()
    };

    // Cache manager'ı başlat
    const cacheConfig = instanceConfig?.cache;
    if (cacheConfig) {
      if (typeof cacheConfig === 'boolean' && cacheConfig) {
        this.cache = new CacheManager({ enabled: true });
      } else if (typeof cacheConfig === 'object') {
        this.cache = new CacheManager({ ...cacheConfig, enabled: true });
      } else {
        this.cache = new CacheManager({ enabled: false });
      }
    } else {
      this.cache = new CacheManager({ enabled: false });
    }

    // Global cache manager'ı ayarla
    setGlobalCacheManager(this.cache);

    // Feature manager'ı başlat
    this.features = new FeatureManager(instanceConfig?.features);
  }

  /**
   * Request gönderen ana fonksiyon
   */
  public async request<T = any, R = SaxiosResponse<T>, D = any>(
    configOrUrl: SaxiosRequestConfig<D> | string,
    config?: SaxiosRequestConfig<D>
  ): Promise<R> {
    // Config'i normalize et
    let mergedConfig: SaxiosRequestConfig<D>;
    
    if (isString(configOrUrl)) {
      mergedConfig = mergeConfig(this.defaults, { url: configOrUrl, ...config });
    } else {
      mergedConfig = mergeConfig(this.defaults, configOrUrl);
    }

    // Method'u normalize et
    if (mergedConfig.method) {
      mergedConfig.method = mergedConfig.method.toLowerCase() as Method;
    } else {
      mergedConfig.method = 'get';
    }

    // Headers'ı merge et
    mergedConfig.headers = this.mergeHeaders(mergedConfig);

    // URL'i oluştur
    mergedConfig.url = buildFullPath(mergedConfig.baseURL, mergedConfig.url);

    try {
      // Request interceptorları çalıştır
      const processedConfig = await runInterceptors(
        this.interceptors.request, 
        mergedConfig, 
        true
      );

      // Cancel token kontrolü
      if (processedConfig.cancelToken) {
        processedConfig.cancelToken.throwIfRequested();
      }

      // Request transformerları uygula
      if (processedConfig.transformRequest && processedConfig.data !== undefined) {
        const transformers = Array.isArray(processedConfig.transformRequest) 
          ? processedConfig.transformRequest 
          : [processedConfig.transformRequest];

        transformers.forEach(transformer => {
          processedConfig.data = transformer(processedConfig.data, processedConfig.headers || {});
        });
      }

      // Feature manager ile request'i process et
      const adapter = processedConfig.adapter || this.defaults.adapter;
      if (!adapter) {
        throw createError('No adapter available', ERROR_CODES.ERR_NOT_SUPPORT, processedConfig);
      }

      let response = await this.features.processRequest(processedConfig, () => adapter(processedConfig));

      // Response transformerları uygula
      if (response.data !== undefined && processedConfig.transformResponse) {
        const transformers = Array.isArray(processedConfig.transformResponse) 
          ? processedConfig.transformResponse 
          : [processedConfig.transformResponse];

        transformers.forEach(transformer => {
          response.data = transformer(response.data);
        });
      }

      // Response interceptorları çalıştır
      response = await runInterceptors(this.interceptors.response, response, false);

      return response as R;

    } catch (error: any) {
      try {
        // Error interceptorları çalıştır
        const processedError = await runErrorInterceptors(this.interceptors.response, error);
        return processedError;
      } catch (finalError) {
        throw finalError;
      }
    }
  }

  /**
   * GET request
   */
  public get<T = any, R = SaxiosResponse<T>, D = any>(
    url: string, 
    config?: SaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'get', url });
  }

  /**
   * DELETE request
   */
  public delete<T = any, R = SaxiosResponse<T>, D = any>(
    url: string, 
    config?: SaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'delete', url });
  }

  /**
   * HEAD request
   */
  public head<T = any, R = SaxiosResponse<T>, D = any>(
    url: string, 
    config?: SaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'head', url });
  }

  /**
   * OPTIONS request
   */
  public options<T = any, R = SaxiosResponse<T>, D = any>(
    url: string, 
    config?: SaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'options', url });
  }

  /**
   * POST request
   */
  public post<T = any, R = SaxiosResponse<T>, D = any>(
    url: string, 
    data?: D, 
    config?: SaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'post', url, data });
  }

  /**
   * PUT request
   */
  public put<T = any, R = SaxiosResponse<T>, D = any>(
    url: string, 
    data?: D, 
    config?: SaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'put', url, data });
  }

  /**
   * PATCH request
   */
  public patch<T = any, R = SaxiosResponse<T>, D = any>(
    url: string, 
    data?: D, 
    config?: SaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'patch', url, data });
  }

  /**
   * POST Form request
   */
  public postForm<T = any, R = SaxiosResponse<T>, D = any>(
    url: string, 
    data?: D, 
    config?: SaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({
      ...config,
      method: 'post',
      url,
      data,
      headers: {
        ...config?.headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  }

  /**
   * PUT Form request
   */
  public putForm<T = any, R = SaxiosResponse<T>, D = any>(
    url: string, 
    data?: D, 
    config?: SaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({
      ...config,
      method: 'put',
      url,
      data,
      headers: {
        ...config?.headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  }

  /**
   * PATCH Form request
   */
  public patchForm<T = any, R = SaxiosResponse<T>, D = any>(
    url: string, 
    data?: D, 
    config?: SaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({
      ...config,
      method: 'patch',
      url,
      data,
      headers: {
        ...config?.headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  }

  /**
   * URI oluşturan fonksiyon
   */
  public getUri(config?: SaxiosRequestConfig): string {
    const mergedConfig = mergeConfig(this.defaults, config || {});
    return buildFullPath(mergedConfig.baseURL, mergedConfig.url);
  }

  /**
   * Headers'ı merge eden yardımcı fonksiyon
   */
  private mergeHeaders(config: SaxiosRequestConfig): SaxiosHeaders {
    const method = config.method || 'get';
    const headers: SaxiosHeaders = {};

    // Common headers'ı ekle
    Object.assign(headers, this.defaults.headers?.common || {});

    // Method specific headers'ı ekle
    if (this.defaults.headers && this.defaults.headers[method]) {
      Object.assign(headers, this.defaults.headers[method]);
    }

    // Instance headers'ı ekle
    if (this.defaults.headers) {
      Object.assign(headers, this.defaults.headers);
    }

    // Config headers'ı ekle
    if (config.headers) {
      Object.assign(headers, config.headers);
    }

    return headers;
  }
}