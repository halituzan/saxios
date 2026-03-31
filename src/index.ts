import { Laxios } from './core/Laxios';
import { LaxiosError, isLaxiosError } from './core/LaxiosError';
import { Cancel, CancelToken, isCancel } from './core/Cancel';
import {
  LaxiosRequestConfig,
  LaxiosInstance,
  LaxiosStatic,
  GenericFormData,
  GenericHTMLFormElement,
  FormSerializerOptions
} from './types';
import { isObject } from './utils';

/**
 * Laxios instance oluşturan fonksiyon
 */
function createInstance(defaultConfig?: LaxiosRequestConfig): LaxiosInstance {
  const context = new Laxios(defaultConfig);
  
  // Callable instance oluştur
  const instance = function(configOrUrl: any, config?: any) {
    return context.request(configOrUrl, config);
  } as LaxiosInstance;

  // Laxios prototype'ını kopyala
  Object.setPrototypeOf(instance, Laxios.prototype);
  
  // Context'i instance'a kopyala
  Object.assign(instance, context);

  return instance;
}

/**
 * Default laxios instance
 */
const laxios = createInstance();

// Static metodları ekle
(laxios as any).Laxios = Laxios;
(laxios as any).LaxiosError = LaxiosError;
(laxios as any).Cancel = Cancel;
(laxios as any).CancelToken = CancelToken;
(laxios as any).VERSION = '1.0.0';

/**
 * Yeni instance oluştur
 */
(laxios as any).create = function create(instanceConfig?: LaxiosRequestConfig): LaxiosInstance {
  return createInstance(instanceConfig);
};

/**
 * Cancel kontrolü
 */
(laxios as any).isCancel = isCancel;

/**
 * LaxiosError kontrolü
 */
(laxios as any).isLaxiosError = isLaxiosError;

/**
 * Promise.all wrapper
 */
(laxios as any).all = function all<T>(promises: Array<T | Promise<T>>): Promise<T[]> {
  return Promise.all(promises);
};

/**
 * Spread helper
 */
(laxios as any).spread = function spread<T, R>(callback: (...args: T[]) => R) {
  return function wrap(arr: T[]): R {
    return callback.apply(null, arr);
  };
};

/**
 * FormData'ya dönüştüren fonksiyon
 */
(laxios as any).toFormData = function toFormData(
  sourceObj: object,
  targetFormData?: GenericFormData,
  options?: FormSerializerOptions
): GenericFormData {
  const formData = targetFormData || new FormData();
  const stack: Array<{ data: any; key: string; path: (string | number)[] }> = [];
  
  const visit = (source: any, key: string, path: (string | number)[] = []) => {
    if (source === null || source === undefined) {
      return;
    }

    if (typeof source === 'object') {
      if (stack.indexOf(source) !== -1) {
        throw new Error('Circular reference detected');
      }

      stack.push(source);

      if (source instanceof Date) {
        formData.append(key, source.toISOString());
      } else if (source instanceof File || source instanceof Blob) {
        formData.append(key, source);
      } else if (Array.isArray(source)) {
        source.forEach((item, index) => {
          const arrayKey = options?.indexes === false ? key : `${key}[${index}]`;
          visit(item, arrayKey, [...path, index]);
        });
      } else if (isObject(source)) {
        Object.keys(source).forEach(prop => {
          const nestedKey = options?.dots ? `${key}.${prop}` : `${key}[${prop}]`;
          visit((source as any)[prop], nestedKey, [...path, prop]);
        });
      } else {
        formData.append(key, String(source));
      }

      stack.pop();
    } else {
      formData.append(key, String(source));
    }
  };

  Object.keys(sourceObj).forEach(key => {
    visit((sourceObj as any)[key], key);
  });

  return formData;
};

/**
 * Form'u JSON'a dönüştüren fonksiyon
 */
(laxios as any).formToJSON = function formToJSON(form: GenericFormData | GenericHTMLFormElement): object {
  const result: any = {};
  
  if (form instanceof FormData) {
    form.forEach((value, key) => {
      if (result[key]) {
        if (!Array.isArray(result[key])) {
          result[key] = [result[key]];
        }
        result[key].push(value);
      } else {
        result[key] = value;
      }
    });
  } else if (form && typeof form === 'object' && 'elements' in form) {
    // HTML Form element
    const elements = (form as any).elements;
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (element.name && !element.disabled) {
        if (element.type === 'checkbox' || element.type === 'radio') {
          if (element.checked) {
            result[element.name] = element.value;
          }
        } else {
          result[element.name] = element.value;
        }
      }
    }
  }

  return result;
};

// Type assertion
const laxiosStatic = laxios as LaxiosStatic;

// Export edilecek tüm öğeler
export default laxiosStatic;

export {
  Laxios,
  LaxiosError,
  Cancel,
  CancelToken,
  isCancel,
  isLaxiosError,
  laxiosStatic as laxios
};

export * from './types';
export * from './cache';
export * from './features';

// CommonJS compatibility
module.exports = laxiosStatic;
module.exports.default = laxiosStatic;