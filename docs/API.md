# saxios API Dokümantasyonu

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
npm install saxios
```

## Temel Kullanım

### GET Request
```typescript
import saxios from 'saxios';

const response = await saxios.get('/users');
console.log(response.data);
```

### POST Request
```typescript
const response = await saxios.post('/users', {
  name: 'John Doe',
  email: 'john@example.com'
});
```

### Diğer HTTP Metodları
```typescript
await saxios.put('/users/1', userData);
await saxios.patch('/users/1', partialData);
await saxios.delete('/users/1');
await saxios.head('/users');
await saxios.options('/users');
```

## Instance Oluşturma

```typescript
const api = saxios.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Authorization': 'Bearer token'
  }
});
```

## Request Konfigürasyonu

```typescript
interface SaxiosRequestConfig {
  url?: string;
  method?: Method;
  baseURL?: string;
  headers?: SaxiosHeaders;
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
  onUploadProgress?: (progressEvent: SaxiosProgressEvent) => void;
  onDownloadProgress?: (progressEvent: SaxiosProgressEvent) => void;
}
```

## Response Schema

```typescript
interface SaxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: SaxiosHeaders;
  config: SaxiosRequestConfig;
  request?: any;
}
```

## Interceptors

### Request Interceptor
```typescript
saxios.interceptors.request.use(
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
saxios.interceptors.response.use(
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
  const response = await saxios.get('/api/data');
} catch (error) {
  if (saxios.isSaxiosError(error)) {
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
const source = saxios.CancelToken.source();

const request = saxios.get('/api/data', {
  cancelToken: source.token
});

// İptal et
source.cancel('Operation cancelled');
```

### AbortSignal ile
```typescript
const controller = new AbortController();

const request = saxios.get('/api/data', {
  signal: controller.signal
});

// İptal et
controller.abort();
```

## Utility Fonksiyonları

### toFormData
```typescript
const formData = saxios.toFormData({
  name: 'John',
  file: fileInput.files[0]
});
```

### formToJSON
```typescript
const formElement = document.getElementById('myForm');
const jsonData = saxios.formToJSON(formElement);
```

### Type Guards
```typescript
if (saxios.isSaxiosError(error)) {
  // SaxiosError
}

if (saxios.isCancel(error)) {
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
const response = await saxios.get<User[]>('/users');
const users: User[] = response.data;

// Tip güvenli POST
const newUser = await saxios.post<User>('/users', {
  name: 'John',
  email: 'john@example.com'
});
```

## Konfigürasyon Örnekleri

### Timeout
```typescript
const api = saxios.create({
  timeout: 10000 // 10 saniye
});
```

### Custom Headers
```typescript
const api = saxios.create({
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  }
});
```

### Base URL
```typescript
const api = saxios.create({
  baseURL: 'https://api.example.com/v1'
});

// /v1/users'a request gönderir
await api.get('/users');
```

### Credentials
```typescript
const api = saxios.create({
  withCredentials: true // Cookies gönder
});
```

### Response Type
```typescript
const response = await saxios.get('/file.pdf', {
  responseType: 'blob'
});
```

### Progress Tracking
```typescript
await saxios.post('/upload', formData, {
  onUploadProgress: (progressEvent) => {
    const percent = Math.round(
      (progressEvent.loaded * 100) / (progressEvent.total || 1)
    );
    console.log(`Upload: ${percent}%`);
  }
});
```