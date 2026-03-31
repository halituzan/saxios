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
export interface LaxiosHeaders {
  [key: string]: string | number | boolean | null | undefined;
}

// Request Configuration
export interface LaxiosRequestConfig<D = any> {
  url?: string;
  method?: Method;
  baseURL?: string;
  transformRequest?: LaxiosTransformer | LaxiosTransformer[];
  transformResponse?: LaxiosTransformer | LaxiosTransformer[];
  headers?: LaxiosHeaders;
  params?: any;
  paramsSerializer?: (params: any) => string;
  data?: D;
  timeout?: number;
  timeoutErrorMessage?: string;
  withCredentials?: boolean;
  adapter?: LaxiosAdapter;
  auth?: LaxiosBasicCredentials;
  responseType?: ResponseType;
  responseEncoding?: string;
  xsrfCookieName?: string;
  xsrfHeaderName?: string;
  onUploadProgress?: (progressEvent: LaxiosProgressEvent) => void;
  onDownloadProgress?: (progressEvent: LaxiosProgressEvent) => void;
  maxContentLength?: number;
  validateStatus?: (status: number) => boolean;
  maxBodyLength?: number;
  maxRedirects?: number;
  socketPath?: string | null;
  httpAgent?: any;
  httpsAgent?: any;
  proxy?: LaxiosProxyConfig | false;
  cancelToken?: CancelToken;
  signal?: AbortSignal;
  decompress?: boolean;
  transitional?: LaxiosTransitionalOptions;
  env?: {
    FormData?: new (...args: any[]) => object;
  };
  formSerializer?: FormSerializerOptions;
  family?: 4 | 6 | undefined;
  lookup?: Function;
  insecureHTTPParser?: boolean;
  beforeRedirect?: (options: Record<string, any>, responseDetails: {headers: Record<string, string>}) => void;
}

// Response Interface
export interface LaxiosResponse<T = any, D = any> {
  data: T;
  status: number;
  statusText: string;
  headers: LaxiosHeaders;
  config: LaxiosRequestConfig<D>;
  request?: any;
}

// Error Interface
export interface LaxiosError<T = unknown, D = any> extends Error {
  config?: LaxiosRequestConfig<D>;
  code?: string;
  request?: any;
  response?: LaxiosResponse<T, D>;
  isLaxiosError: boolean;
  status?: number;
  toJSON: () => object;
}

// Interceptors
export interface LaxiosInterceptorManager<V> {
  use<T = V>(
    onFulfilled?: (value: V) => T | Promise<T>,
    onRejected?: (error: any) => any
  ): number;
  eject(id: number): void;
  clear(): void;
}

// Transformers
export interface LaxiosTransformer {
  (data: any, headers?: LaxiosHeaders): any;
}

// Adapter
export interface LaxiosAdapter {
  (config: LaxiosRequestConfig): LaxiosPromise;
}

// Promise
export interface LaxiosPromise<T = any> extends Promise<LaxiosResponse<T>> {}

// Basic Auth
export interface LaxiosBasicCredentials {
  username: string;
  password: string;
}

// Proxy Config
export interface LaxiosProxyConfig {
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
  protocol?: string;
}

// Progress Event
export interface LaxiosProgressEvent {
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
export interface LaxiosTransitionalOptions {
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
export interface LaxiosInstance extends Laxios {
  <T = any, R = LaxiosResponse<T>, D = any>(config: LaxiosRequestConfig<D>): Promise<R>;
  <T = any, R = LaxiosResponse<T>, D = any>(url: string, config?: LaxiosRequestConfig<D>): Promise<R>;
  
  defaults: Omit<LaxiosRequestConfig, 'url' | 'method' | 'data'>;
  interceptors: {
    request: LaxiosInterceptorManager<LaxiosRequestConfig>;
    response: LaxiosInterceptorManager<LaxiosResponse>;
  };
  
  getUri(config?: LaxiosRequestConfig): string;
  request<T = any, R = LaxiosResponse<T>, D = any>(config: LaxiosRequestConfig<D>): Promise<R>;
  get<T = any, R = LaxiosResponse<T>, D = any>(url: string, config?: LaxiosRequestConfig<D>): Promise<R>;
  delete<T = any, R = LaxiosResponse<T>, D = any>(url: string, config?: LaxiosRequestConfig<D>): Promise<R>;
  head<T = any, R = LaxiosResponse<T>, D = any>(url: string, config?: LaxiosRequestConfig<D>): Promise<R>;
  options<T = any, R = LaxiosResponse<T>, D = any>(url: string, config?: LaxiosRequestConfig<D>): Promise<R>;
  post<T = any, R = LaxiosResponse<T>, D = any>(url: string, data?: D, config?: LaxiosRequestConfig<D>): Promise<R>;
  put<T = any, R = LaxiosResponse<T>, D = any>(url: string, data?: D, config?: LaxiosRequestConfig<D>): Promise<R>;
  patch<T = any, R = LaxiosResponse<T>, D = any>(url: string, data?: D, config?: LaxiosRequestConfig<D>): Promise<R>;
  
  postForm<T = any, R = LaxiosResponse<T>, D = any>(url: string, data?: D, config?: LaxiosRequestConfig<D>): Promise<R>;
  putForm<T = any, R = LaxiosResponse<T>, D = any>(url: string, data?: D, config?: LaxiosRequestConfig<D>): Promise<R>;
  patchForm<T = any, R = LaxiosResponse<T>, D = any>(url: string, data?: D, config?: LaxiosRequestConfig<D>): Promise<R>;
}

// Main Laxios Interface
export interface Laxios {
  <T = any, R = LaxiosResponse<T>, D = any>(config: LaxiosRequestConfig<D>): Promise<R>;
  <T = any, R = LaxiosResponse<T>, D = any>(url: string, config?: LaxiosRequestConfig<D>): Promise<R>;
}

// Static Interface
export interface LaxiosStatic extends LaxiosInstance {
  create(config?: LaxiosRequestConfig): LaxiosInstance;
  Cancel: any;
  CancelToken: any;
  Laxios: any;
  LaxiosError: any;
  readonly VERSION: string;
  isCancel(value: any): value is Cancel;
  all<T>(values: Array<T | Promise<T>>): Promise<T[]>;
  spread<T, R>(callback: (...args: T[]) => R): (array: T[]) => R;
  isLaxiosError<T = any, D = any>(payload: any): payload is LaxiosError<T, D>;
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

// Default export type - sadece tip tanımı
export default {} as LaxiosStatic;