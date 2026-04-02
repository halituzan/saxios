import { Saxios } from './core/Saxios';
import { SaxiosError, isSaxiosError } from './core/SaxiosError';
import { Cancel, CancelToken, isCancel } from './core/Cancel';
import {
  SaxiosRequestConfig,
  SaxiosInstance,
  SaxiosStatic,
  GenericFormData,
  GenericHTMLFormElement,
  FormSerializerOptions
} from './types';
import { isObject } from './utils';

/**
 * Creates a saxios instance
 */
function createInstance(defaultConfig?: SaxiosRequestConfig): SaxiosInstance {
  const context = new Saxios(defaultConfig);
  
  // Build callable instance
  const instance = function(configOrUrl: any, config?: any) {
    return context.request(configOrUrl, config);
  } as SaxiosInstance;

  // Copy Saxios prototype
  Object.setPrototypeOf(instance, Saxios.prototype);
  
  // Copy context onto instance
  Object.assign(instance, context);

  return instance;
}

/**
 * Default saxios instance (npm package name: saxios, lowercase)
 */
const saxios = createInstance();

// Attach static methods
(saxios as any).Saxios = Saxios;
(saxios as any).SaxiosError = SaxiosError;
(saxios as any).Cancel = Cancel;
(saxios as any).CancelToken = CancelToken;
(saxios as any).VERSION = '2.0.0';

/**
 * Create a new instance
 */
(saxios as any).create = function create(instanceConfig?: SaxiosRequestConfig): SaxiosInstance {
  return createInstance(instanceConfig);
};

/**
 * Whether the value is a cancel
 */
(saxios as any).isCancel = isCancel;

/**
 * Whether the value is a SaxiosError
 */
(saxios as any).isSaxiosError = isSaxiosError;

/**
 * Promise.all wrapper
 */
(saxios as any).all = function all<T>(promises: Array<T | Promise<T>>): Promise<T[]> {
  return Promise.all(promises);
};

/**
 * Spread helper
 */
(saxios as any).spread = function spread<T, R>(callback: (...args: T[]) => R) {
  return function wrap(arr: T[]): R {
    return callback.apply(null, arr);
  };
};

/**
 * Converts a plain object to FormData
 */
(saxios as any).toFormData = function toFormData(
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
 * Converts a form to a JSON object
 */
(saxios as any).formToJSON = function formToJSON(form: GenericFormData | GenericHTMLFormElement): object {
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

const saxiosStatic = saxios as SaxiosStatic;

export default saxiosStatic;

export {
  Saxios,
  SaxiosError,
  Cancel,
  CancelToken,
  isCancel,
  isSaxiosError,
  saxiosStatic as saxios
};

export * from './types';
export * from './cache';
export * from './features';

module.exports = saxiosStatic;
module.exports.default = saxiosStatic;
