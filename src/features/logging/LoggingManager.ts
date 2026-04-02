import { LoggingConfig } from '../types';
import { SaxiosRequestConfig, SaxiosResponse, SaxiosError } from '../../types';

type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  data?: any;
  requestId?: string;
}

/**
 * Structured request/response logging with redaction
 */
export class LoggingManager {
  private config: Required<LoggingConfig>;
  private logs: LogEntry[] = [];
  private requestCounter = 0;

  constructor(config: LoggingConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      level: config.level ?? 'info',
      includeHeaders: config.includeHeaders ?? false,
      includeBody: config.includeBody ?? false,
      logToConsole: config.logToConsole ?? true,
      logToFile: config.logToFile ?? '',
      customLogger: config.customLogger ?? null
    };
  }

  /**
   * Log outgoing request; returns request id
   */
  logRequestStart(config: SaxiosRequestConfig): string {
    if (!this.shouldLog('debug')) return '';

    const requestId = this.generateRequestId();
    const logData: any = {
      requestId,
      method: config.method?.toUpperCase() || 'GET',
      url: config.url,
      baseURL: config.baseURL
    };

    if (this.config.includeHeaders && config.headers) {
      logData.headers = this.sanitizeHeaders(config.headers);
    }

    if (this.config.includeBody && config.data) {
      logData.body = this.sanitizeBody(config.data);
    }

    if (config.params) {
      logData.params = config.params;
    }

    this.log('debug', `→ ${logData.method} ${logData.url}`, logData);
    return requestId;
  }

  /**
   * Log successful response
   */
  logRequestEnd(
    requestId: string,
    config: SaxiosRequestConfig,
    response: SaxiosResponse,
    duration: number
  ): void {
    if (!this.shouldLog('debug')) return;

    const logData: any = {
      requestId,
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`
    };

    if (this.config.includeHeaders && response.headers) {
      logData.responseHeaders = response.headers;
    }

    if (this.config.includeBody && response.data) {
      logData.responseBody = this.sanitizeBody(response.data);
    }

    const level = response.status >= 400 ? 'warn' : 'debug';
    this.log(level, `← ${response.status} ${config.method?.toUpperCase()} ${config.url} (${duration}ms)`, logData);
  }

  /**
   * Log failed request
   */
  logRequestError(
    requestId: string,
    config: SaxiosRequestConfig,
    error: SaxiosError,
    duration?: number
  ): void {
    if (!this.shouldLog('error')) return;

    const logData: any = {
      requestId,
      error: error.message,
      code: error.code,
      duration: duration ? `${duration}ms` : undefined
    };

    if (error.response) {
      logData.status = error.response.status;
      logData.statusText = error.response.statusText;
      
      if (this.config.includeHeaders && error.response.headers) {
        logData.responseHeaders = error.response.headers;
      }
    }

    this.log('error', `✗ ${config.method?.toUpperCase()} ${config.url} - ${error.message}`, logData);
  }

  /**
   * Log retry attempt
   */
  logRetry(requestId: string, config: SaxiosRequestConfig, attemptNumber: number): void {
    if (!this.shouldLog('info')) return;

    const logData = {
      requestId,
      attemptNumber,
      method: config.method?.toUpperCase() || 'GET',
      url: config.url
    };

    this.log('info', `↻ Retry ${attemptNumber} for ${logData.method} ${config.url}`, logData);
  }

  /**
   * Log cache events
   */
  logCacheEvent(requestId: string, config: SaxiosRequestConfig, event: 'hit' | 'miss' | 'set'): void {
    if (!this.shouldLog('debug')) return;

    const logData = {
      requestId,
      cacheEvent: event,
      method: config.method?.toUpperCase() || 'GET',
      url: config.url
    };

    const emoji = event === 'hit' ? '💾' : event === 'miss' ? '🔍' : '💿';
    this.log('debug', `${emoji} Cache ${event} for ${logData.method} ${config.url}`, logData);
  }

  /**
   * Ad-hoc log line
   */
  logCustom(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;
    this.log(level, message, data);
  }

  /**
   * Internal sink: memory ring + console + optional file hook
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.config.enabled || !this.shouldLog(level)) return;

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      data,
      requestId: data?.requestId
    };

    this.logs.push(logEntry);

    if (this.config.logToConsole) {
      this.logToConsole(logEntry);
    }

    if (this.config.customLogger) {
      this.config.customLogger(level, message, data);
    }

    // Optional file sink (Node)
    if (this.config.logToFile && typeof process !== 'undefined') {
      this.logToFile(logEntry);
    }

    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-500);
    }
  }

  /**
   * Format entry for console
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`;

    switch (entry.level) {
      case 'error':
        console.error(`${prefix} ${entry.message}`, entry.data || '');
        break;
      case 'warn':
        console.warn(`${prefix} ${entry.message}`, entry.data || '');
        break;
      case 'info':
        console.info(`${prefix} ${entry.message}`, entry.data || '');
        break;
      case 'debug':
      case 'verbose':
        console.debug(`${prefix} ${entry.message}`, entry.data || '');
        break;
      default:
        console.log(`${prefix} ${entry.message}`, entry.data || '');
    }
  }

  /**
   * Placeholder for fs append (Node)
   */
  private logToFile(_entry: LogEntry): void {
    // Not implemented — browsers have no filesystem API here
    console.log('File logging not implemented for browser environment');
  }

  /**
   * Compare configured level vs message level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['silent', 'error', 'warn', 'info', 'debug', 'verbose'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const requestedLevelIndex = levels.indexOf(level);
    
    return currentLevelIndex >= requestedLevelIndex;
  }

  /**
   * Redact sensitive headers
   */
  private sanitizeHeaders(headers: any): any {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    const sanitized: any = {};

    Object.keys(headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (sensitiveHeaders.includes(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = headers[key];
      }
    });

    return sanitized;
  }

  /**
   * Truncate / redact body fields
   */
  private sanitizeBody(body: any): any {
    if (!body) return body;

    if (typeof body === 'string') {
      return body.length > 1000 ? body.substring(0, 1000) + '...' : body;
    }

    if (typeof body === 'object') {
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
      const sanitized: any = Array.isArray(body) ? [] : {};

      Object.keys(body).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = body[key];
        }
      });

      return sanitized;
    }

    return body;
  }

  /**
   * Monotonic request id
   */
  private generateRequestId(): string {
    return `req_${++this.requestCounter}_${Date.now().toString(36)}`;
  }

  /**
   * Filtered log buffer
   */
  getLogs(filter?: {
    level?: LogLevel;
    requestId?: string;
    since?: number;
    limit?: number;
  }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.level) {
        filteredLogs = filteredLogs.filter(log => log.level === filter.level);
      }
      
      if (filter.requestId) {
        filteredLogs = filteredLogs.filter(log => log.requestId === filter.requestId);
      }
      
      if (filter.since) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.since!);
      }
      
      if (filter.limit) {
        filteredLogs = filteredLogs.slice(-filter.limit);
      }
    }

    return filteredLogs;
  }

  /**
   * Clear in-memory history
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Simple histogram by level
   */
  getLogStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    oldestLog?: number;
    newestLog?: number;
  } {
    const byLevel: Record<LogLevel, number> = {
      silent: 0,
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
      verbose: 0
    };

    this.logs.forEach(log => {
      byLevel[log.level]++;
    });

    return {
      total: this.logs.length,
      byLevel,
      oldestLog: this.logs.length > 0 ? this.logs[0].timestamp : undefined,
      newestLog: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : undefined
    };
  }

  /**
   * Merge partial config
   */
  updateConfig(newConfig: Partial<LoggingConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Enable logging
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable logging
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Whether logging is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}