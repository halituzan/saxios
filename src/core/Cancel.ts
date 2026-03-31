import { Cancel as ICancel, Canceler, CancelToken as ICancelToken, CancelTokenSource } from '../types';

/**
 * Cancel sınıfı
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
 * CancelToken sınıfı
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
          // Zaten cancel edilmiş
          return;
        }

        this.reason = new Cancel(message);
        resolvePromise(this.reason);
      });
    }
  }

  /**
   * Cancel edilmişse hata fırlatır
   */
  public throwIfRequested(): void {
    if (this.reason) {
      throw this.reason;
    }
  }

  /**
   * Cancel listener ekler
   */
  public subscribe(listener: (cancel: Cancel) => void): void {
    if (this.reason) {
      listener(this.reason);
      return;
    }

    this._listeners.push(listener);
  }

  /**
   * Cancel listener kaldırır
   */
  public unsubscribe(listener: (cancel: Cancel) => void): void {
    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }

  /**
   * CancelTokenSource oluşturur
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
 * Cancel olup olmadığını kontrol eden fonksiyon
 */
export function isCancel(value: any): value is Cancel {
  return value instanceof Cancel;
}