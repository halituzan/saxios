import { Cancel as ICancel, Canceler, CancelToken as ICancelToken, CancelTokenSource } from '../types';

/**
 * Cancellation reason (axios-compatible)
 */
export class Cancel implements ICancel {
  public message: string;

  constructor(message?: string) {
    this.message = message || 'Operation canceled';
  }

  public toString(): string {
    return 'Cancel' + (this.message ? ': ' + this.message : '');
  }
}

/**
 * CancelToken (axios-compatible)
 */
export class CancelToken implements ICancelToken {
  public promise: Promise<Cancel>;
  public reason?: Cancel;

  private _listeners: Array<(cancel: Cancel) => void> = [];

  constructor(executor?: (cancel: Canceler) => void) {
    let resolvePromise: (cancel: Cancel) => void;

    this.promise = new Promise<Cancel>((resolve) => {
      resolvePromise = resolve;
    });

    this.promise.then((cancel) => {
      let i = 0;
      let l = this._listeners.length;

      for (; i < l; i++) {
        this._listeners[i](cancel);
      }
      this._listeners = [];
    });

    if (executor) {
      executor((message?: string) => {
        if (this.reason) {
          // Already canceled
          return;
        }

        this.reason = new Cancel(message);
        resolvePromise(this.reason);
      });
    }
  }

  /**
   * Throws if cancellation was requested
   */
  public throwIfRequested(): void {
    if (this.reason) {
      throw this.reason;
    }
  }

  /**
   * Subscribe to cancellation
   */
  public subscribe(listener: (cancel: Cancel) => void): void {
    if (this.reason) {
      listener(this.reason);
      return;
    }

    this._listeners.push(listener);
  }

  /**
   * Unsubscribe a listener
   */
  public unsubscribe(listener: (cancel: Cancel) => void): void {
    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }

  /**
   * Factory for token + cancel function
   */
  public static source(): CancelTokenSource {
    let cancel: Canceler;
    const token = new CancelToken((c) => {
      cancel = c;
    });

    return {
      token,
      cancel: cancel!
    };
  }
}

/**
 * Type guard for Cancel
 */
export function isCancel(value: any): value is Cancel {
  return value instanceof Cancel;
}