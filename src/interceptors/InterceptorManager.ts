import { SaxiosInterceptorManager } from '../types';

interface InterceptorHandler<V> {
  fulfilled?: (value: V) => any;
  rejected?: (error: any) => any;
  synchronous?: boolean;
  runWhen?: (config: any) => boolean;
}

/**
 * Interceptor chain manager
 */
export class InterceptorManager<V> implements SaxiosInterceptorManager<V> {
  private handlers: Array<InterceptorHandler<V> | null> = [];

  /**
   * Register an interceptor
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
   * Remove an interceptor by id
   */
  public eject(id: number): void {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  /**
   * Clear all interceptors
   */
  public clear(): void {
    this.handlers = [];
  }

  /**
   * Iterate active handlers
   */
  public forEach(fn: (handler: InterceptorHandler<V>) => void): void {
    this.handlers.forEach((handler) => {
      if (handler !== null) {
        fn(handler);
      }
    });
  }

  /**
   * Raw handler list (may contain null slots)
   */
  public getHandlers(): Array<InterceptorHandler<V> | null> {
    return this.handlers;
  }
}

/**
 * Run fulfilled interceptors in order
 */
export async function runInterceptors<T>(
  interceptors: InterceptorManager<T>,
  value: T,
  isRequest: boolean = false
): Promise<T> {
  let result = value;
  const handlers = interceptors.getHandlers();

  // Request interceptors run in reverse registration order (axios behavior)
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
 * Run response error interceptors
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
        
        // If handler converted error to a new value, propagate as throw
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