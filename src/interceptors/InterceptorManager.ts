import { LaxiosInterceptorManager } from '../types';

interface InterceptorHandler<V> {
  fulfilled?: (value: V) => any;
  rejected?: (error: any) => any;
  synchronous?: boolean;
  runWhen?: (config: any) => boolean;
}

/**
 * Interceptor Manager sınıfı
 */
export class InterceptorManager<V> implements LaxiosInterceptorManager<V> {
  private handlers: Array<InterceptorHandler<V> | null> = [];

  /**
   * Interceptor ekler
   */
  public use<T = V>(
    onFulfilled?: (value: V) => T | Promise<T>,
    onRejected?: (error: any) => any,
    options?: {
      synchronous?: boolean;
      runWhen?: (config: any) => boolean;
    }
  ): number {
    this.handlers.push({
      fulfilled: onFulfilled as any,
      rejected: onRejected,
      synchronous: options ? options.synchronous : false,
      runWhen: options ? options.runWhen : undefined
    });

    return this.handlers.length - 1;
  }

  /**
   * Interceptor kaldırır
   */
  public eject(id: number): void {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  /**
   * Tüm interceptorları temizler
   */
  public clear(): void {
    this.handlers = [];
  }

  /**
   * Interceptorları forEach ile dolaşır
   */
  public forEach(fn: (handler: InterceptorHandler<V>) => void): void {
    this.handlers.forEach((handler) => {
      if (handler !== null) {
        fn(handler);
      }
    });
  }

  /**
   * Handlers'ı döndürür
   */
  public getHandlers(): Array<InterceptorHandler<V> | null> {
    return this.handlers;
  }
}

/**
 * Interceptorları çalıştıran fonksiyon
 */
export async function runInterceptors<T>(
  interceptors: InterceptorManager<T>,
  value: T,
  isRequest: boolean = false
): Promise<T> {
  let result = value;
  const handlers = interceptors.getHandlers();

  // Request interceptorları ters sırada çalışır
  const orderedHandlers = isRequest ? handlers.slice().reverse() : handlers;

  for (const handler of orderedHandlers) {
    if (handler && handler.fulfilled) {
      try {
        if (handler.runWhen && isRequest && !handler.runWhen(result)) {
          continue;
        }

        if (handler.synchronous) {
          result = handler.fulfilled(result);
        } else {
          result = await Promise.resolve(handler.fulfilled(result));
        }
      } catch (error) {
        if (handler.rejected) {
          if (handler.synchronous) {
            result = handler.rejected(error);
          } else {
            result = await Promise.resolve(handler.rejected(error));
          }
        } else {
          throw error;
        }
      }
    }
  }

  return result;
}

/**
 * Error interceptorları çalıştıran fonksiyon
 */
export async function runErrorInterceptors<T>(
  interceptors: InterceptorManager<T>,
  error: any
): Promise<never> {
  const handlers = interceptors.getHandlers();

  for (const handler of handlers) {
    if (handler && handler.rejected) {
      try {
        const result = handler.synchronous 
          ? handler.rejected(error)
          : await Promise.resolve(handler.rejected(error));
        
        // Eğer handler error'ı handle etti ve yeni bir değer döndürdü
        if (result !== undefined) {
          throw result;
        }
      } catch (newError) {
        error = newError;
      }
    }
  }

  throw error;
}