import { LaxiosRequestConfig, LaxiosResponse, LaxiosError } from '../types';

// ===== RETRY SYSTEM =====
export interface RetryConfig {
  enabled?: boolean;
  attempts?: number;
  delay?: number;
  exponentialBackoff?: boolean;
  maxDelay?: number;
  retryCondition?: (error: LaxiosError) => boolean;
  onRetry?: (attemptNumber: number, error: LaxiosError) => void;
}

// ===== DEDUPLICATION =====
export interface DeduplicationConfig {
  enabled?: boolean;
  keyGenerator?: (config: LaxiosRequestConfig) => string;
  ttl?: number; // How long to keep deduplication cache
}

// ===== ANALYTICS & METRICS =====
export interface AnalyticsConfig {
  enabled?: boolean;
  trackPerformance?: boolean;
  trackErrors?: boolean;
  trackRetries?: boolean;
  endpoint?: string;
  batchSize?: number;
  flushInterval?: number;
  customMetrics?: Record<string, (config: LaxiosRequestConfig, response?: LaxiosResponse) => any>;
}

export interface RequestMetrics {
  url: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  error?: string;
  retryCount?: number;
  cacheHit?: boolean;
}

// ===== SECURITY =====
export interface SecurityConfig {
  enabled?: boolean;
  csrfProtection?: boolean;
  requestSigning?: boolean;
  encryptSensitiveData?: string[];
  sanitizeHeaders?: string[];
  validateCertificates?: boolean;
  allowedOrigins?: string[];
}

// ===== OFFLINE SUPPORT =====
export interface OfflineConfig {
  enabled?: boolean;
  storage?: 'localStorage' | 'sessionStorage' | 'indexedDB' | 'memory';
  syncOnReconnect?: boolean;
  queueFailedRequests?: boolean;
  maxQueueSize?: number;
  retryQueuedRequests?: boolean;
}

export interface QueuedRequest {
  config: LaxiosRequestConfig;
  timestamp: number;
  attempts: number;
}

// ===== REQUEST BATCHING =====
export interface BatchingConfig {
  enabled?: boolean;
  maxBatchSize?: number;
  batchDelay?: number;
  batchEndpoint?: string;
  batchKey?: (config: LaxiosRequestConfig) => string;
}

// ===== GRAPHQL =====
export interface GraphQLConfig {
  enabled?: boolean;
  endpoint?: string;
  introspection?: boolean;
  subscriptions?: boolean;
  wsEndpoint?: string;
}

export interface GraphQLQuery {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

// ===== WEBSOCKET =====
export interface WebSocketConfig {
  enabled?: boolean;
  url?: string;
  fallbackToHTTP?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  protocols?: string[];
}

// ===== MOCK & TESTING =====
export interface MockConfig {
  enabled?: boolean;
  scenarios?: Record<string, MockScenario>;
  delay?: number;
  errorRate?: number;
}

export interface MockScenario {
  method?: string;
  url?: string | RegExp;
  response?: any;
  status?: number;
  headers?: Record<string, string>;
  delay?: number;
}

// ===== LOGGING & DEBUGGING =====
export interface LoggingConfig {
  enabled?: boolean;
  level?: 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  includeHeaders?: boolean;
  includeBody?: boolean;
  logToConsole?: boolean;
  logToFile?: string;
  customLogger?: ((level: string, message: string, data?: any) => void) | null;
}

// ===== VALIDATION =====
export interface ValidationConfig {
  enabled?: boolean;
  schemas?: Record<string, any>;
  validateRequest?: boolean;
  validateResponse?: boolean;
  onValidationError?: (error: ValidationError) => void;
}

export interface ValidationError extends Error {
  type: 'request' | 'response';
  path: string;
  errors: any[];
}

// ===== TRANSFORMATION =====
export interface TransformationConfig {
  enabled?: boolean;
  request?: TransformFunction[];
  response?: TransformFunction[];
}

export interface TransformFunction {
  (data: any, headers?: Record<string, any>): any;
}

// ===== PERFORMANCE MONITORING =====
export interface PerformanceConfig {
  enabled?: boolean;
  slowRequestThreshold?: number;
  memoryUsageTracking?: boolean;
  onSlowRequest?: (config: LaxiosRequestConfig, duration: number) => void;
  onMemoryWarning?: (usage: MemoryUsage) => void;
}

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
}

// ===== MIDDLEWARE =====
export interface MiddlewareConfig {
  enabled?: boolean;
  pipeline?: MiddlewareFunction[];
}

export interface MiddlewareFunction {
  (config: LaxiosRequestConfig, next: () => Promise<LaxiosResponse>): Promise<LaxiosResponse>;
}

// ===== MAIN FEATURES CONFIG =====
export interface LaxiosFeaturesConfig {
  retry?: RetryConfig;
  deduplication?: DeduplicationConfig;
  analytics?: AnalyticsConfig;
  security?: SecurityConfig;
  offline?: OfflineConfig;
  batching?: BatchingConfig;
  graphql?: GraphQLConfig;
  websocket?: WebSocketConfig;
  mock?: MockConfig;
  logging?: LoggingConfig;
  validation?: ValidationConfig;
  transformation?: TransformationConfig;
  performance?: PerformanceConfig;
  middleware?: MiddlewareConfig;
}

// ===== EVENTS =====
export interface LaxiosEvents {
  'request:start': (config: LaxiosRequestConfig) => void;
  'request:end': (config: LaxiosRequestConfig, response: LaxiosResponse) => void;
  'request:error': (config: LaxiosRequestConfig, error: LaxiosError) => void;
  'request:retry': (config: LaxiosRequestConfig, attempt: number) => void;
  'request:cached': (config: LaxiosRequestConfig, response: LaxiosResponse) => void;
  'request:queued': (config: LaxiosRequestConfig) => void;
  'batch:created': (requests: LaxiosRequestConfig[]) => void;
  'offline:detected': () => void;
  'online:detected': () => void;
}