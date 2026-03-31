import {
  LaxiosRequestConfig,
  LaxiosResponse,
  LaxiosInstance,
  LaxiosHeaders,
  Method,
  LaxiosTransformer
} from '../types';
import { InterceptorManager, runInterceptors, runErrorInterceptors } from '../interceptors/InterceptorManager';
import { createError, ERROR_CODES } from './LaxiosError';
import fetchAdapter from '../adapters/fetch';
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
    function transformRequest(data: any, headers: LaxiosHeaders): any {
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
  ] as LaxiosTransformer[],

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
  ] as LaxiosTransformer[]
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
 * Ana Laxios sınıfı
 */
export class Laxios implements LaxiosInstance {
  public defaults: LaxiosRequestConfig;
  public interceptors: {
    request: InterceptorManager<LaxiosRequestConfig>;
    response: InterceptorManager<LaxiosResponse>;
  };

  constructor(instanceConfig?: LaxiosRequestConfig) {
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
      request: new InterceptorManager<LaxiosRequestConfig>(),
      response: new InterceptorManager<LaxiosResponse>()
    };
  }

  /**
   * Request gönderen ana fonksiyon
   */
  public async request<T = any, R = LaxiosResponse<T>, D = any>(
    configOrUrl: LaxiosRequestConfig<D> | string,
    config?: LaxiosRequestConfig<D>
  ): Promise<R> {
    // Config'i normalize et
    let mergedConfig: LaxiosRequestConfig<D>;
    
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

      // Adapter ile request gönder
      const adapter = processedConfig.adapter || this.defaults.adapter;
      if (!adapter) {
        throw createError('No adapter available', ERROR_CODES.ERR_NOT_SUPPORT, processedConfig);
      }

      let response = await adapter(processedConfig);

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
  public get<T = any, R = LaxiosResponse<T>, D = any>(
    url: string, 
    config?: LaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'get', url });
  }

  /**
   * DELETE request
   */
  public delete<T = any, R = LaxiosResponse<T>, D = any>(
    url: string, 
    config?: LaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'delete', url });
  }

  /**
   * HEAD request
   */
  public head<T = any, R = LaxiosResponse<T>, D = any>(
    url: string, 
    config?: LaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'head', url });
  }

  /**
   * OPTIONS request
   */
  public options<T = any, R = LaxiosResponse<T>, D = any>(
    url: string, 
    config?: LaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'options', url });
  }

  /**
   * POST request
   */
  public post<T = any, R = LaxiosResponse<T>, D = any>(
    url: string, 
    data?: D, 
    config?: LaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'post', url, data });
  }

  /**
   * PUT request
   */
  public put<T = any, R = LaxiosResponse<T>, D = any>(
    url: string, 
    data?: D, 
    config?: LaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'put', url, data });
  }

  /**
   * PATCH request
   */
  public patch<T = any, R = LaxiosResponse<T>, D = any>(
    url: string, 
    data?: D, 
    config?: LaxiosRequestConfig<D>
  ): Promise<R> {
    return this.request<T, R, D>({ ...config, method: 'patch', url, data });
  }

  /**
   * POST Form request
   */
  public postForm<T = any, R = LaxiosResponse<T>, D = any>(
    url: string, 
    data?: D, 
    config?: LaxiosRequestConfig<D>
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
  public putForm<T = any, R = LaxiosResponse<T>, D = any>(
    url: string, 
    data?: D, 
    config?: LaxiosRequestConfig<D>
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
  public patchForm<T = any, R = LaxiosResponse<T>, D = any>(
    url: string, 
    data?: D, 
    config?: LaxiosRequestConfig<D>
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
  public getUri(config?: LaxiosRequestConfig): string {
    const mergedConfig = mergeConfig(this.defaults, config || {});
    return buildFullPath(mergedConfig.baseURL, mergedConfig.url);
  }

  /**
   * Headers'ı merge eden yardımcı fonksiyon
   */
  private mergeHeaders(config: LaxiosRequestConfig): LaxiosHeaders {
    const method = config.method || 'get';
    const headers: LaxiosHeaders = {};

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

// Callable interface implementation
export interface Laxios {
  <T = any, R = LaxiosResponse<T>, D = any>(config: LaxiosRequestConfig<D>): Promise<R>;
  <T = any, R = LaxiosResponse<T>, D = any>(url: string, config?: LaxiosRequestConfig<D>): Promise<R>;
}