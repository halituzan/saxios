import { SaxiosRequestConfig, SaxiosResponse, SaxiosError as ISaxiosError } from '../types';

/**
 * saxios error type
 */
export class SaxiosError<T = unknown, D = any> extends Error implements ISaxiosError<T, D> {
  public isSaxiosError: boolean = true;
  public config?: SaxiosRequestConfig<D>;
  public code?: string;
  public request?: any;
  public response?: SaxiosResponse<T, D>;
  public status?: number;

  constructor(
    message?: string,
    code?: string,
    config?: SaxiosRequestConfig<D>,
    request?: any,
    response?: SaxiosResponse<T, D>
  ) {
    super(message);
    
    this.name = 'SaxiosError';
    this.code = code;
    this.config = config;
    this.request = request;
    this.response = response;
    this.status = response?.status;

    // Preserve correct stack for subclasses
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
 * Factory for SaxiosError instances
 */
export function createError<T = unknown, D = any>(
  message: string,
  code?: string,
  config?: SaxiosRequestConfig<D>,
  request?: any,
  response?: SaxiosResponse<T, D>
): SaxiosError<T, D> {
  return new SaxiosError<T, D>(message, code, config, request, response);
}

/**
 * Type guard for SaxiosError
 */
export function isSaxiosError<T = any, D = any>(payload: any): payload is SaxiosError<T, D> {
  return payload && payload.isSaxiosError === true;
}

// Error codes
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