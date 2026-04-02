# saxios

Modern, TypeScript-first HTTP client with an axios-compatible API.

**Languages:** [English](README.md) · [Türkçe / Turkish](README.tr.md)

[![npm version](https://badge.fury.io/js/saxios.svg)](https://badge.fury.io/js/saxios)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Test Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen.svg)](./coverage)

## Features

### Core

- **Axios-compatible API**: Familiar surface for existing axios code
- **TypeScript-first**: Strong typing across requests and responses
- **Fetch-based**: Uses the native Fetch API under the hood
- **Lightweight**: Small dependency footprint
- **Interceptors**: Request and response interceptors
- **Cancellation**: `CancelToken` and `AbortSignal` support
- **Progress hooks**: Upload / download progress callbacks (where the environment allows)
- **Errors**: Structured `SaxiosError` handling

### Beyond axios (optional modules)

- **Caching**: Pluggable cache with TTL and LRU eviction
- **Auto retry**: Configurable retries and backoff
- **Request deduplication**: Coalesce identical in-flight calls
- **Analytics hooks**: Collect timing and error metrics
- **Security helpers**: CSRF, signing hooks, redaction (see implementation notes in source)
- **Offline queue**: Browser-oriented queue / reconnect sync (experimental)
- **Batching**: Group compatible GETs (experimental)
- **Logging**: Verbose request/response logging with redaction

## Installation

```bash
npm install saxios
```

```bash
yarn add saxios
```

```bash
pnpm add saxios
```

## Quick start

### Basic usage

```typescript
import saxios from 'saxios';

const response = await saxios.get('https://api.example.com/users');
console.log(response.data);

const newUser = await saxios.post('https://api.example.com/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

const updatedUser = await saxios.put('https://api.example.com/users/1', {
  name: 'Jane Doe'
});

await saxios.delete('https://api.example.com/users/1');
```

### Creating an instance

```typescript
import saxios from 'saxios';

const api = saxios.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    Authorization: 'Bearer your-token',
    'Content-Type': 'application/json'
  }
});

const users = await api.get('/users');
const user = await api.post('/users', userData);
```

### Caching (saxios extension)

```typescript
import saxios from 'saxios';

const api = saxios.create({
  baseURL: 'https://api.example.com',
  cache: true
});

const users1 = await api.get('/users');
const users2 = await api.get('/users'); // served from cache when eligible

const apiWithCustomCache = saxios.create({
  baseURL: 'https://api.example.com',
  cache: {
    enabled: true,
    ttl: 60000,
    maxSize: 100
  }
});

const freshData = await api.get('/users', { cache: false });

const cachedData = await api.get('/products', {
  cache: {
    enabled: true,
    ttl: 300000
  }
});
```

## Detailed usage

### Request configuration

```typescript
const config = {
  url: '/users',
  method: 'GET',
  baseURL: 'https://api.example.com',
  headers: {
    Authorization: 'Bearer token',
    'Content-Type': 'application/json'
  },
  params: { page: 1, limit: 10 },
  timeout: 5000,
  withCredentials: true,
  responseType: 'json'
};

const response = await saxios.request(config);
```

### Interceptors

**Request**

```typescript
saxios.interceptors.request.use(
  (config) => {
    config.headers.Authorization = `Bearer ${getToken()}`;
    return config;
  },
  (error) => Promise.reject(error)
);
```

**Response**

```typescript
saxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Error handling

```typescript
import { isSaxiosError } from 'saxios';

try {
  await saxios.get('/api/users');
} catch (error) {
  if (isSaxiosError(error)) {
    console.log(error.response?.status, error.response?.data);
  } else {
    console.log('Network error:', (error as Error).message);
  }
}
```

### CancelToken

```typescript
import { CancelToken } from 'saxios';

const source = CancelToken.source();

const request = saxios.get('/api/data', {
  cancelToken: source.token
});

source.cancel('Operation cancelled by user');

try {
  await request;
} catch (error) {
  if (saxios.isCancel(error)) {
    console.log('Cancelled:', error.message);
  }
}
```

### AbortSignal

```typescript
const controller = new AbortController();

const request = saxios.get('/api/data', {
  signal: controller.signal
});

setTimeout(() => controller.abort(), 5000);
```

### Progress

```typescript
await saxios.post('/api/upload', formData, {
  onUploadProgress: (e) => {
    const pct = Math.round((e.loaded * 100) / (e.total || 1));
    console.log(`Upload: ${pct}%`);
  },
  onDownloadProgress: (e) => {
    const pct = Math.round((e.loaded * 100) / (e.total || 1));
    console.log(`Download: ${pct}%`);
  }
});
```

### Form data helpers

```typescript
const formData = saxios.toFormData({
  name: 'John',
  file: fileInput.files[0],
  tags: ['tag1', 'tag2']
});

await saxios.post('/api/upload', formData);

const formElement = document.getElementById('myForm') as HTMLFormElement;
const jsonData = saxios.formToJSON(formElement);
```

### Cache API

```typescript
const api = saxios.create({ cache: true });

await api.get('/users');
await api.get('/users');

const api2 = saxios.create({
  cache: {
    enabled: true,
    ttl: 300000,
    maxSize: 100,
    methods: ['GET', 'HEAD'],
    statusCodes: [200, 203, 300, 301, 410],
    keyGenerator: (config) =>
      `${config.method}:${config.url}:${JSON.stringify(config.params)}`,
    filter: (response) => Boolean(response.data && !response.data.sensitive)
  }
});

const stats = api.cache.getStats();
await api.cache.clear();
await api.cache.delete('cache-key');
api.cache.disable();
api.cache.enable();

api.cache.on('hit', (key) => console.log('hit', key));
api.cache.on('miss', (key) => console.log('miss', key));
```

### TypeScript

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
}

const res = await saxios.get<User[]>('/api/users');
const users: User[] = res.data;

const created = await saxios.post<User, CreateUserRequest>('/api/users', {
  name: 'John',
  email: 'john@example.com'
});
```

## Configuration reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | — | Request URL |
| `method` | `Method` | `'GET'` | HTTP method |
| `baseURL` | `string` | — | Base URL |
| `headers` | `object` | `{}` | Request headers |
| `params` | `object` | — | Query parameters |
| `data` | `any` | — | Request body |
| `timeout` | `number` | `0` | Timeout (ms), `0` = none |
| `withCredentials` | `boolean` | `false` | Send cookies |
| `responseType` | `ResponseType` | `'json'` | How to parse the body |
| `validateStatus` | `function` | `status >= 200 && status < 300` | Treat as success |
| `maxContentLength` | `number` | `-1` | Response size limit |
| `maxBodyLength` | `number` | `-1` | Request body size limit |
| `cancelToken` | `CancelToken` | — | Legacy cancel API |
| `signal` | `AbortSignal` | — | AbortController signal |
| `cache` | `boolean \| CacheConfig` | `false` | Cache options |

## Scripts

```bash
npm test
npm run test:coverage
npm run test:watch
npm run build
npm run dev
npm run type-check
npm run lint
```

## Performance

- Tree-shakeable ESM/CJS builds
- Small gzipped footprint (varies with features enabled)
- Fetch and HTTP/2 where the runtime supports them
- Optional cache reduces duplicate traffic; LRU bounds memory use

## Migrating from axios

Change the import; the call shape stays the same:

```typescript
// Before
import axios from 'axios';

// After
import saxios from 'saxios';

// Optional: keep the name `axios`
import { default as axios } from 'saxios';

const response = await saxios.get('/api/users');
```

### Comparison (illustrative)

| Area | axios | saxios |
|------|-------|--------|
| Cache | — | Built-in (opt-in) |
| Retry / dedup / analytics | DIY | Optional feature flags |
| Transport | XHR (classic axios) | Fetch |
| Bundle | Depends on build | Depends on features enabled |

## Optional feature modules

### Retry

```typescript
const api = saxios.create({
  features: {
    retry: {
      enabled: true,
      attempts: 3,
      delay: 1000,
      exponentialBackoff: true,
      retryCondition: (error) => error.code === 'ERR_NETWORK'
    }
  }
});
```

### Deduplication

```typescript
const api = saxios.create({
  features: {
    deduplication: {
      enabled: true,
      ttl: 60000
    }
  }
});

await Promise.all([
  api.get('/api/users'),
  api.get('/api/users'),
  api.get('/api/users')
]);
```

### Analytics

```typescript
const api = saxios.create({
  features: {
    analytics: {
      enabled: true,
      trackPerformance: true,
      trackErrors: true
    }
  }
});

const stats = api.features.analytics.getAnalytics();
```

### Security (demo-level helpers — review before production)

```typescript
const api = saxios.create({
  features: {
    security: {
      enabled: true,
      csrfProtection: true,
      requestSigning: true,
      encryptSensitiveData: ['password', 'token']
    }
  }
});
```

### Offline

```typescript
const api = saxios.create({
  features: {
    offline: {
      enabled: true,
      queueFailedRequests: true,
      syncOnReconnect: true
    }
  }
});
```

### Batching

```typescript
const api = saxios.create({
  features: {
    batching: {
      enabled: true,
      maxBatchSize: 10,
      batchDelay: 50
    }
  }
});
```

### Logging

```typescript
const api = saxios.create({
  features: {
    logging: {
      enabled: true,
      level: 'debug',
      includeHeaders: true,
      includeBody: true
    }
  }
});

const logs = api.features.logging.getLogs();
```

## Contributing

1. Fork the repository
2. Create a branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push and open a pull request

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgements

- [axios](https://github.com/axios/axios)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

## Support

- [Issues](https://github.com/yourusername/saxios/issues)
- [Discussions](https://github.com/yourusername/saxios/discussions)

Replace `yourusername` in URLs with your GitHub org or username before publishing.
