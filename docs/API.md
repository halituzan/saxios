# Laxios API Dokümantasyonu

## İçindekiler

- [Kurulum](#kurulum)
- [Temel Kullanım](#temel-kullanım)
- [Instance Oluşturma](#instance-oluşturma)
- [Request Konfigürasyonu](#request-konfigürasyonu)
- [Response Schema](#response-schema)
- [Interceptors](#interceptors)
- [Error Handling](#error-handling)
- [Cancel Token](#cancel-token)
- [Utility Fonksiyonları](#utility-fonksiyonları)

## Kurulum

```bash
npm install laxios
```

## Temel Kullanım

### GET Request
```typescript
import laxios from 'laxios';

const response = await laxios.get('/users');
console.log(response.data);
```

### POST Request
```typescript
const response = await laxios.post('/users', {
  name: 'John Doe',
  email: 'john@example.com'
});
```

### Diğer HTTP Metodları
```typescript
await laxios.put('/users/1', userData);
await laxios.patch('/users/1', partialData);
await laxios.delete('/users/1');
await laxios.head('/users');
await laxios.options('/users');
```

## Instance Oluşturma

```typescript
const api = laxios.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Authorization': 'Bearer token'
  }
});
```

## Request Konfigürasyonu

```typescript
interface LaxiosRequestConfig {
  url?: string;
  method?: Method;
  baseURL?: string;
  headers?: LaxiosHeaders;
  params?: any;
  data?: any;
  timeout?: number;
  withCredentials?: boolean;
  responseType?: ResponseType;
  validateStatus?: (status: number) => boolean;
  maxContentLength?: number;
  maxBodyLength?: number;
  cancelToken?: CancelToken;
  signal?: AbortSignal;
  onUploadProgress?: (progressEvent: LaxiosProgressEvent) => void;
  onDownloadProgress?: (progressEvent: LaxiosProgressEvent) => void;
}
```

## Response Schema

```typescript
interface LaxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: LaxiosHeaders;
  config: LaxiosRequestConfig;
  request?: any;
}
```

## Interceptors

### Request Interceptor
```typescript
laxios.interceptors.request.use(
  (config) => {
    // Request'i değiştir
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
```

### Response Interceptor
```typescript
laxios.interceptors.response.use(
  (response) => {
    // Response'u değiştir
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);
```

## Error Handling

```typescript
try {
  const response = await laxios.get('/api/data');
} catch (error) {
  if (laxios.isLaxiosError(error)) {
    console.log('Status:', error.response?.status);
    console.log('Data:', error.response?.data);
  } else {
    console.log('Network error:', error.message);
  }
}
```

## Cancel Token

### CancelToken ile
```typescript
const source = laxios.CancelToken.source();

const request = laxios.get('/api/data', {
  cancelToken: source.token
});

// İptal et
source.cancel('Operation cancelled');
```

### AbortSignal ile
```typescript
const controller = new AbortController();

const request = laxios.get('/api/data', {
  signal: controller.signal
});

// İptal et
controller.abort();
```

## Utility Fonksiyonları

### toFormData
```typescript
const formData = laxios.toFormData({
  name: 'John',
  file: fileInput.files[0]
});
```

### formToJSON
```typescript
const formElement = document.getElementById('myForm');
const jsonData = laxios.formToJSON(formElement);
```

### Type Guards
```typescript
if (laxios.isLaxiosError(error)) {
  // LaxiosError
}

if (laxios.isCancel(error)) {
  // Cancel error
}
```

## TypeScript Desteği

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// Tip güvenli request
const response = await laxios.get<User[]>('/users');
const users: User[] = response.data;

// Tip güvenli POST
const newUser = await laxios.post<User>('/users', {
  name: 'John',
  email: 'john@example.com'
});
```

## Konfigürasyon Örnekleri

### Timeout
```typescript
const api = laxios.create({
  timeout: 10000 // 10 saniye
});
```

### Custom Headers
```typescript
const api = laxios.create({
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  }
});
```

### Base URL
```typescript
const api = laxios.create({
  baseURL: 'https://api.example.com/v1'
});

// /v1/users'a request gönderir
await api.get('/users');
```

### Credentials
```typescript
const api = laxios.create({
  withCredentials: true // Cookies gönder
});
```

### Response Type
```typescript
const response = await laxios.get('/file.pdf', {
  responseType: 'blob'
});
```

### Progress Tracking
```typescript
await laxios.post('/upload', formData, {
  onUploadProgress: (progressEvent) => {
    const percent = Math.round(
      (progressEvent.loaded * 100) / (progressEvent.total || 1)
    );
    console.log(`Upload: ${percent}%`);
  }
});
```