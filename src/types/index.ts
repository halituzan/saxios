// Cache imports
export * from '../cache/types';

// Feature imports
export * from '../features/types';

// HTTP Methods
export type Method = 
  | 'GET' | 'get'
  | 'DELETE' | 'delete' 
  | 'HEAD' | 'head'
  | 'OPTIONS' | 'options'
  | 'POST' | 'post'
  | 'PUT' | 'put'
  | 'PATCH' | 'patch'
  | 'PURGE' | 'purge'
  | 'LINK' | 'link'
  | 'UNLINK' | 'unlink';

// Response Types
export type ResponseType = 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream';

// Request/Response Headers
export interface SaxiosHeaders {
  [key: string]: string | number | boolean | null | undefined;
}

// Request Configuration
export interface SaxiosRequestConfig<D = any> {
  url?: string;
  method?: Method;
  baseURL?: string;
  transformRequest?: SaxiosTransformer | SaxiosTransformer[];
  transformResponse?: SaxiosTransformer | SaxiosTransformer[];
  headers?: SaxiosHeaders;
  params?: any;
  paramsSerializer?: (params: any) => string;
  data?: D;
  timeout?: number;
  timeoutErrorMessage?: string;
  withCredentials?: boolean;
  adapter?: SaxiosAdapter;
  auth?: SaxiosBasicCredentials;
  responseType?: ResponseType;
  responseEncoding?: string;
  xsrfCookieName?: string;
  xsrfHeaderName?: string;
  onUploadProgress?: (progressEvent: SaxiosProgressEvent) => void;
  onDownloadProgress?: (progressEvent: SaxiosProgressEvent) => void;
  maxContentLength?: number;
  validateStatus?: (status: number) => boolean;
  maxBodyLength?: number;
  maxRedirects?: number;
  socketPath?: string | null;
  httpAgent?: any;
  httpsAgent?: any;
  proxy?: SaxiosProxyConfig | false;
  cancelToken?: CancelToken;
  signal?: AbortSignal;
  decompress?: boolean;
  transitional?: SaxiosTransitionalOptions;
  env?: {
    FormData?: new (...args: any[]) => object;
  };
  formSerializer?: FormSerializerOptions;
  family?: 4 | 6 | undefined;
  lookup?: Function;
  insecureHTTPParser?: boolean;
  beforeRedirect?: (options: Record<string, any>, responseDetails: {headers: Record<string, string>}) => void;
  // Cache configuration
  cache?: boolean | any;
  // Features configuration
  features?: any;
}

// Response Interface
export interface SaxiosResponse<T = any, D = any> {
  data: T;
  status: number;
  statusText: string;
  headers: SaxiosHeaders;
  config: SaxiosRequestConfig<D>;
  request?: any;
}

// Error Interface
export interface SaxiosError<T = unknown, D = any> extends Error {
  config?: SaxiosRequestConfig<D>;
  code?: string;
  request?: any;
  response?: SaxiosResponse<T, D>;
  isSaxiosError: boolean;
  status?: number;
  toJSON: () => object;
}

// Interceptors
export interface SaxiosInterceptorManager<V> {
  use<T = V>(
    onFulfilled?: (value: V) => T | Promise<T>,
    onRejected?: (error: any) => any
  ): number;
  eject(id: number): void;
  clear(): void;
}

// Transformers
export interface SaxiosTransformer {
  (data: any, headers?: SaxiosHeaders): any;
}

// Adapter
export interface SaxiosAdapter {
  (config: SaxiosRequestConfig): SaxiosPromise;
}

// Promise
export interface SaxiosPromise<T = any> extends Promise<SaxiosResponse<T>> {}

// Basic Auth
export interface SaxiosBasicCredentials {
  username: string;
  password: string;
}

// Proxy Config
export interface SaxiosProxyConfig {
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
  protocol?: string;
}

// Progress Event
export interface SaxiosProgressEvent {
  loaded: number;
  total?: number;
  progress?: number;
  bytes: number;
  rate?: number;
  estimated?: number;
  upload?: boolean;
  download?: boolean;
}

// Cancel Token
export interface CancelToken {
  promise: Promise<Cancel>;
  reason?: Cancel;
  throwIfRequested(): void;
}

export interface Cancel {
  message: string;
}

export interface Canceler {
  (message?: string): void;
}

export interface CancelTokenSource {
  token: CancelToken;
  cancel: Canceler;
}

// Transitional Options
export interface SaxiosTransitionalOptions {
  silentJSONParsing?: boolean;
  forcedJSONParsing?: boolean;
  clarifyTimeoutError?: boolean;
}

// Form Serializer Options
export interface FormSerializerOptions {
  visitor?: (value: any, key: string | number, path: (string | number)[], helpers: FormSerializerHelpers) => boolean;
  dots?: boolean;
  metaTokens?: boolean;
  indexes?: boolean | null;
}

export interface FormSerializerHelpers {
  defaultVisitor: (value: any, key: string | number, path: (string | number)[]) => boolean;
  convertValue: (value: any) => any;
  isVisitable: (value: any) => boolean;
}

// Instance Interface
export interface SaxiosInstance extends SaxiosCallable {
  <T = any, R = SaxiosResponse<T>, D = any>(config: SaxiosRequestConfig<D>): Promise<R>;
  <T = any, R = SaxiosResponse<T>, D = any>(url: string, config?: SaxiosRequestConfig<D>): Promise<R>;
  
  defaults: Omit<SaxiosRequestConfig, 'url' | 'method' | 'data'>;
  interceptors: {
    request: SaxiosInterceptorManager<SaxiosRequestConfig>;
    response: SaxiosInterceptorManager<SaxiosResponse>;
  };
  cache: any; // CacheManager type will be resolved at runtime
  features: any; // FeatureManager type will be resolved at runtime
  
  getUri(config?: SaxiosRequestConfig): string;
  request<T = any, R = SaxiosResponse<T>, D = any>(config: SaxiosRequestConfig<D>): Promise<R>;
  get<T = any, R = SaxiosResponse<T>, D = any>(url: string, config?: SaxiosRequestConfig<D>): Promise<R>;
  delete<T = any, R = SaxiosResponse<T>, D = any>(url: string, config?: SaxiosRequestConfig<D>): Promise<R>;
  head<T = any, R = SaxiosResponse<T>, D = any>(url: string, config?: SaxiosRequestConfig<D>): Promise<R>;
  options<T = any, R = SaxiosResponse<T>, D = any>(url: string, config?: SaxiosRequestConfig<D>): Promise<R>;
  post<T = any, R = SaxiosResponse<T>, D = any>(url: string, data?: D, config?: SaxiosRequestConfig<D>): Promise<R>;
  put<T = any, R = SaxiosResponse<T>, D = any>(url: string, data?: D, config?: SaxiosRequestConfig<D>): Promise<R>;
  patch<T = any, R = SaxiosResponse<T>, D = any>(url: string, data?: D, config?: SaxiosRequestConfig<D>): Promise<R>;
  
  postForm<T = any, R = SaxiosResponse<T>, D = any>(url: string, data?: D, config?: SaxiosRequestConfig<D>): Promise<R>;
  putForm<T = any, R = SaxiosResponse<T>, D = any>(url: string, data?: D, config?: SaxiosRequestConfig<D>): Promise<R>;
  patchForm<T = any, R = SaxiosResponse<T>, D = any>(url: string, data?: D, config?: SaxiosRequestConfig<D>): Promise<R>;
}

/** Callable HTTP client signature (matches default export `saxios`) */
export interface SaxiosCallable {
  <T = any, R = SaxiosResponse<T>, D = any>(config: SaxiosRequestConfig<D>): Promise<R>;
  <T = any, R = SaxiosResponse<T>, D = any>(url: string, config?: SaxiosRequestConfig<D>): Promise<R>;
}

// Static Interface
export interface SaxiosStatic extends SaxiosInstance {
  create(config?: SaxiosRequestConfig): SaxiosInstance;
  Cancel: any;
  CancelToken: any;
  Saxios: any;
  SaxiosError: any;
  readonly VERSION: string;
  isCancel(value: any): value is Cancel;
  all<T>(values: Array<T | Promise<T>>): Promise<T[]>;
  spread<T, R>(callback: (...args: T[]) => R): (array: T[]) => R;
  isSaxiosError<T = any, D = any>(payload: any): payload is SaxiosError<T, D>;
  toFormData(sourceObj: object, targetFormData?: GenericFormData, options?: FormSerializerOptions): GenericFormData;
  formToJSON(form: GenericFormData | GenericHTMLFormElement): object;
}

// Generic Form Data
export interface GenericFormData {
  append(name: string, value: any, options?: any): any;
}

export interface GenericHTMLFormElement {
  name: string;
  method: string;
  submit(): void;
}

// Default export type — type-only stub
export default {} as SaxiosStatic;