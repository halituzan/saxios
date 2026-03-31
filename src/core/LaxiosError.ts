import { LaxiosRequestConfig, LaxiosResponse, LaxiosError as ILaxiosError } from '../types';

/**
 * Laxios Error sınıfı
 */
export class LaxiosError<T = unknown, D = any> extends Error implements ILaxiosError<T, D> {
  public isLaxiosError: boolean = true;
  public config?: LaxiosRequestConfig<D>;
  public code?: string;
  public request?: any;
  public response?: LaxiosResponse<T, D>;
  public status?: number;

  constructor(
    message?: string,
    code?: string,
    config?: LaxiosRequestConfig<D>,
    request?: any,
    response?: LaxiosResponse<T, D>
  ) {
    super(message);
    
    this.name = 'LaxiosError';
    this.code = code;
    this.config = config;
    this.request = request;
    this.response = response;
    this.status = response?.status;

    // Error stack trace'ini düzelt
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON(): object {
    return {
      message: this.message,
      name: this.name,
      description: this.description,
      number: this.number,
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      config: this.config,
      code: this.code,
      status: this.status
    };
  }

  // Compatibility properties
  public get description(): string | undefined {
    return this.message;
  }

  public get number(): number | undefined {
    return undefined;
  }

  public get fileName(): string | undefined {
    return undefined;
  }

  public get lineNumber(): number | undefined {
    return undefined;
  }

  public get columnNumber(): number | undefined {
    return undefined;
  }
}

/**
 * LaxiosError oluşturan factory fonksiyonu
 */
export function createError<T = unknown, D = any>(
  message: string,
  code?: string,
  config?: LaxiosRequestConfig<D>,
  request?: any,
  response?: LaxiosResponse<T, D>
): LaxiosError<T, D> {
  return new LaxiosError<T, D>(message, code, config, request, response);
}

/**
 * LaxiosError olup olmadığını kontrol eden fonksiyon
 */
export function isLaxiosError<T = any, D = any>(payload: any): payload is LaxiosError<T, D> {
  return payload && payload.isLaxiosError === true;
}

// Error kodları
export const ERROR_CODES = {
  ERR_FR_TOO_MANY_REDIRECTS: 'ERR_FR_TOO_MANY_REDIRECTS',
  ERR_UNESCAPED_CHARACTERS: 'ERR_UNESCAPED_CHARACTERS',
  ERR_INVALID_URL: 'ERR_INVALID_URL',
  ERR_NETWORK: 'ERR_NETWORK',
  ERR_TIMEOUT: 'ERR_TIMEOUT',
  ERR_CANCELED: 'ERR_CANCELED',
  ERR_BAD_OPTION_VALUE: 'ERR_BAD_OPTION_VALUE',
  ERR_BAD_OPTION: 'ERR_BAD_OPTION',
  ERR_DEPRECATED: 'ERR_DEPRECATED',
  ERR_BAD_RESPONSE: 'ERR_BAD_RESPONSE',
  ERR_BAD_REQUEST: 'ERR_BAD_REQUEST',
  ERR_NOT_SUPPORT: 'ERR_NOT_SUPPORT',
  ERR_INVALID_HEADER: 'ERR_INVALID_HEADER',
  ERR_INVALID_PROTOCOL: 'ERR_INVALID_PROTOCOL',
  ERR_INVALID_PROXY_PROTOCOL: 'ERR_INVALID_PROXY_PROTOCOL',
  ECONNABORTED: 'ECONNABORTED',
  ETIMEDOUT: 'ETIMEDOUT',
  ERR_CONNECT_TIMEOUT: 'ERR_CONNECT_TIMEOUT'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];