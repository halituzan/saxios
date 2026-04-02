import { SaxiosHeaders, SaxiosRequestConfig } from '../types';

/**
 * URL'leri birleştiren yardımcı fonksiyon
 */
export function combineURLs(baseURL: string, relativeURL: string): string {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
}

/**
 * Absolute URL olup olmadığını kontrol eden fonksiyon
 */
export function isAbsoluteURL(url: string): boolean {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

/**
 * URL oluşturan fonksiyon
 */
export function buildURL(url: string, params?: any, paramsSerializer?: (params: any) => string): string {
  if (!params) {
    return url;
  }

  let serializedParams: string;
  
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else {
    const parts: string[] = [];
    
    Object.keys(params).forEach(key => {
      const val = params[key];
      
      if (val === null || val === undefined) {
        return;
      }
      
      let values;
      if (Array.isArray(val)) {
        key = key + '[]';
        values = val;
      } else {
        values = [val];
      }
      
      values.forEach((v: any) => {
        if (v instanceof Date) {
          v = v.toISOString();
        } else if (v !== null && typeof v === 'object') {
          v = JSON.stringify(v);
        }
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
      });
    });
    
    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    const hashmarkIndex = url.indexOf('#');
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }
    
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
}

/**
 * Full URL oluşturan fonksiyon
 */
export function buildFullPath(baseURL?: string, requestedURL?: string): string {
  if (baseURL && !isAbsoluteURL(requestedURL || '')) {
    return combineURLs(baseURL, requestedURL || '');
  }
  return requestedURL || '';
}

/**
 * Headers'ı normalize eden fonksiyon
 */
export function normalizeHeaderName(headers: SaxiosHeaders, normalizedName: string): void {
  Object.keys(headers).forEach(name => {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = headers[name];
      delete headers[name];
    }
  });
}

/**
 * Object'i deep merge eden fonksiyon
 */
export function deepMerge(...objects: any[]): any {
  const result: any = {};
  
  objects.forEach(obj => {
    if (obj) {
      Object.keys(obj).forEach(key => {
        const val = obj[key];
        
        if (isObject(result[key]) && isObject(val)) {
          result[key] = deepMerge(result[key], val);
        } else if (isObject(val)) {
          result[key] = deepMerge({}, val);
        } else if (Array.isArray(val)) {
          result[key] = val.slice();
        } else {
          result[key] = val;
        }
      });
    }
  });
  
  return result;
}

/**
 * Object olup olmadığını kontrol eden fonksiyon
 */
export function isObject(thing: any): thing is object {
  return thing !== null && typeof thing === 'object' && !Array.isArray(thing);
}

/**
 * String olup olmadığını kontrol eden fonksiyon
 */
export function isString(thing: any): thing is string {
  return typeof thing === 'string';
}

/**
 * Date olup olmadığını kontrol eden fonksiyon
 */
export function isDate(thing: any): thing is Date {
  return Object.prototype.toString.call(thing) === '[object Date]';
}

/**
 * File olup olmadığını kontrol eden fonksiyon
 */
export function isFile(thing: any): thing is File {
  return Object.prototype.toString.call(thing) === '[object File]';
}

/**
 * Blob olup olmadığını kontrol eden fonksiyon
 */
export function isBlob(thing: any): thing is Blob {
  return Object.prototype.toString.call(thing) === '[object Blob]';
}

/**
 * Function olup olmadığını kontrol eden fonksiyon
 */
export function isFunction(thing: any): thing is Function {
  return typeof thing === 'function';
}

/**
 * Stream olup olmadığını kontrol eden fonksiyon
 */
export function isStream(thing: any): boolean {
  return isObject(thing) && isFunction((thing as any).pipe);
}

/**
 * URLSearchParams olup olmadığını kontrol eden fonksiyon
 */
export function isURLSearchParams(thing: any): thing is URLSearchParams {
  return typeof URLSearchParams !== 'undefined' && thing instanceof URLSearchParams;
}

/**
 * FormData olup olmadığını kontrol eden fonksiyon
 */
export function isFormData(thing: any): thing is FormData {
  return typeof FormData !== 'undefined' && thing instanceof FormData;
}

/**
 * ArrayBuffer olup olmadığını kontrol eden fonksiyon
 */
export function isArrayBuffer(thing: any): thing is ArrayBuffer {
  return Object.prototype.toString.call(thing) === '[object ArrayBuffer]';
}

/**
 * ArrayBufferView olup olmadığını kontrol eden fonksiyon
 */
export function isArrayBufferView(thing: any): boolean {
  let result;
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView) {
    result = ArrayBuffer.isView(thing);
  } else {
    result = thing && thing.buffer && thing.buffer instanceof ArrayBuffer;
  }
  return result;
}

/**
 * Config'leri merge eden fonksiyon
 */
export function mergeConfig(config1: SaxiosRequestConfig, config2: SaxiosRequestConfig): SaxiosRequestConfig {
  const config: SaxiosRequestConfig = {};
  
  const valueFromConfig2Keys = ['url', 'method', 'data'];
  const mergeDeepPropertiesKeys = ['headers', 'auth', 'proxy', 'params'];
  const defaultToConfig2Keys = [
    'baseURL', 'transformRequest', 'transformResponse', 'paramsSerializer',
    'timeout', 'timeoutErrorMessage', 'withCredentials', 'adapter', 'responseType',
    'xsrfCookieName', 'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress',
    'decompress', 'maxContentLength', 'maxBodyLength', 'maxRedirects',
    'transport', 'httpAgent', 'httpsAgent', 'cancelToken', 'socketPath',
    'responseEncoding'
  ];
  const directMergeKeys = ['validateStatus'];

  function getMergedValue(target: any, source: any): any {
    if (isObject(target) && isObject(source)) {
      return deepMerge(target, source);
    } else if (isObject(source)) {
      return deepMerge({}, source);
    } else if (Array.isArray(source)) {
      return source.slice();
    }
    return source;
  }

  valueFromConfig2Keys.forEach(prop => {
    if (config2[prop as keyof SaxiosRequestConfig] !== undefined) {
      config[prop as keyof SaxiosRequestConfig] = config2[prop as keyof SaxiosRequestConfig];
    }
  });

  mergeDeepPropertiesKeys.forEach(prop => {
    if (config2[prop as keyof SaxiosRequestConfig] !== undefined) {
      config[prop as keyof SaxiosRequestConfig] = getMergedValue(
        config1[prop as keyof SaxiosRequestConfig], 
        config2[prop as keyof SaxiosRequestConfig]
      );
    } else if (config1[prop as keyof SaxiosRequestConfig] !== undefined) {
      config[prop as keyof SaxiosRequestConfig] = getMergedValue(
        undefined, 
        config1[prop as keyof SaxiosRequestConfig]
      );
    }
  });

  defaultToConfig2Keys.forEach(prop => {
    if (config2[prop as keyof SaxiosRequestConfig] !== undefined) {
      config[prop as keyof SaxiosRequestConfig] = config2[prop as keyof SaxiosRequestConfig];
    } else if (config1[prop as keyof SaxiosRequestConfig] !== undefined) {
      config[prop as keyof SaxiosRequestConfig] = config1[prop as keyof SaxiosRequestConfig];
    }
  });

  directMergeKeys.forEach(prop => {
    if (config2[prop as keyof SaxiosRequestConfig] !== undefined) {
      config[prop as keyof SaxiosRequestConfig] = config2[prop as keyof SaxiosRequestConfig];
    } else if (config1[prop as keyof SaxiosRequestConfig] !== undefined) {
      config[prop as keyof SaxiosRequestConfig] = config1[prop as keyof SaxiosRequestConfig];
    }
  });

  return config;
}

/**
 * Timeout promise oluşturan fonksiyon
 */
export function createTimeoutPromise(timeout: number, timeoutErrorMessage?: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(timeoutErrorMessage || `timeout of ${timeout}ms exceeded`));
    }, timeout);
  });
}