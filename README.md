# 🚀 Laxios

Modern, TypeScript-first HTTP client library with full axios compatibility

[![npm version](https://badge.fury.io/js/laxios.svg)](https://badge.fury.io/js/laxios)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Test Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen.svg)](./coverage)

## ✨ Özellikler

- 🎯 **Axios Uyumluluğu**: Axios ile %100 uyumlu API
- 🔒 **TypeScript First**: Tam TypeScript desteği ve tip güvenliği
- 🌐 **Modern Fetch API**: Altında modern fetch API kullanır
- ⚡ **Hafif ve Hızlı**: Minimal bağımlılık, maksimum performans
- 🔄 **Interceptors**: Request ve response interceptor desteği
- ❌ **Cancel Support**: Request iptal etme desteği
- 📊 **Progress Tracking**: Upload/download progress takibi
- 🛡️ **Error Handling**: Gelişmiş hata yönetimi
- 🔧 **Configurable**: Esnek konfigürasyon seçenekleri

## 📦 Kurulum

```bash
npm install laxios
```

```bash
yarn add laxios
```

```bash
pnpm add laxios
```

## 🚀 Hızlı Başlangıç

### Temel Kullanım

```typescript
import laxios from 'laxios';

// GET request
const response = await laxios.get('https://api.example.com/users');
console.log(response.data);

// POST request
const newUser = await laxios.post('https://api.example.com/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// PUT request
const updatedUser = await laxios.put('https://api.example.com/users/1', {
  name: 'Jane Doe'
});

// DELETE request
await laxios.delete('https://api.example.com/users/1');
```

### Instance Oluşturma

```typescript
import laxios from 'laxios';

const api = laxios.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  }
});

// Instance ile request
const users = await api.get('/users');
const user = await api.post('/users', userData);
```

## 📚 Detaylı Kullanım

### Request Konfigürasyonu

```typescript
const config = {
  url: '/users',
  method: 'GET',
  baseURL: 'https://api.example.com',
  headers: {
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  },
  params: {
    page: 1,
    limit: 10
  },
  timeout: 5000,
  withCredentials: true,
  responseType: 'json'
};

const response = await laxios.request(config);
```

### Interceptors

#### Request Interceptors

```typescript
// Request interceptor ekle
laxios.interceptors.request.use(
  (config) => {
    // Request gönderilmeden önce
    config.headers.Authorization = `Bearer ${getToken()}`;
    console.log('Request gönderiliyor:', config);
    return config;
  },
  (error) => {
    // Request error
    return Promise.reject(error);
  }
);
```

#### Response Interceptors

```typescript
// Response interceptor ekle
laxios.interceptors.response.use(
  (response) => {
    // Başarılı response
    console.log('Response alındı:', response);
    return response;
  },
  (error) => {
    // Response error
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Error Handling

```typescript
import { isLaxiosError } from 'laxios';

try {
  const response = await laxios.get('/api/users');
} catch (error) {
  if (isLaxiosError(error)) {
    console.log('Status:', error.response?.status);
    console.log('Data:', error.response?.data);
    console.log('Headers:', error.response?.headers);
  } else {
    console.log('Network error:', error.message);
  }
}
```

### Cancel Token

```typescript
import { CancelToken } from 'laxios';

// Cancel token oluştur
const source = CancelToken.source();

// Request gönder
const request = laxios.get('/api/data', {
  cancelToken: source.token
});

// Request'i iptal et
source.cancel('İşlem kullanıcı tarafından iptal edildi');

try {
  const response = await request;
} catch (error) {
  if (laxios.isCancel(error)) {
    console.log('Request iptal edildi:', error.message);
  }
}
```

### AbortSignal ile Cancel

```typescript
const controller = new AbortController();

const request = laxios.get('/api/data', {
  signal: controller.signal
});

// 5 saniye sonra iptal et
setTimeout(() => {
  controller.abort();
}, 5000);
```

### Progress Tracking

```typescript
const response = await laxios.post('/api/upload', formData, {
  onUploadProgress: (progressEvent) => {
    const percentCompleted = Math.round(
      (progressEvent.loaded * 100) / (progressEvent.total || 1)
    );
    console.log(`Upload: ${percentCompleted}%`);
  },
  onDownloadProgress: (progressEvent) => {
    const percentCompleted = Math.round(
      (progressEvent.loaded * 100) / (progressEvent.total || 1)
    );
    console.log(`Download: ${percentCompleted}%`);
  }
});
```

### Form Data

```typescript
// Object'i FormData'ya dönüştür
const formData = laxios.toFormData({
  name: 'John',
  file: fileInput.files[0],
  tags: ['tag1', 'tag2']
});

const response = await laxios.post('/api/upload', formData);

// Form element'ini JSON'a dönüştür
const formElement = document.getElementById('myForm') as HTMLFormElement;
const jsonData = laxios.formToJSON(formElement);
```

### TypeScript Desteği

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

// Tip güvenli request
const response = await laxios.get<User[]>('/api/users');
const users: User[] = response.data;

// Tip güvenli POST
const newUser = await laxios.post<User, CreateUserRequest>('/api/users', {
  name: 'John',
  email: 'john@example.com'
});
```

## 🔧 Konfigürasyon Seçenekleri

| Seçenek | Tip | Varsayılan | Açıklama |
|---------|-----|------------|----------|
| `url` | `string` | - | Request URL'i |
| `method` | `Method` | `'GET'` | HTTP method |
| `baseURL` | `string` | - | Base URL |
| `headers` | `object` | `{}` | Request headers |
| `params` | `object` | - | URL parametreleri |
| `data` | `any` | - | Request body |
| `timeout` | `number` | `0` | Timeout (ms) |
| `withCredentials` | `boolean` | `false` | Credentials gönder |
| `responseType` | `ResponseType` | `'json'` | Response tipi |
| `validateStatus` | `function` | `status => status >= 200 && status < 300` | Status validator |
| `maxContentLength` | `number` | `-1` | Max content length |
| `maxBodyLength` | `number` | `-1` | Max body length |
| `cancelToken` | `CancelToken` | - | Cancel token |
| `signal` | `AbortSignal` | - | Abort signal |

## 🧪 Test

```bash
# Testleri çalıştır
npm test

# Test coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 🏗️ Build

```bash
# Build
npm run build

# Development build (watch mode)
npm run dev

# Type check
npm run type-check

# Lint
npm run lint
```

## 📈 Performance

Laxios, modern fetch API kullanarak yüksek performans sağlar:

- ✅ Tree-shakeable
- ✅ Minimal bundle size (~15KB gzipped)
- ✅ Modern browser desteği
- ✅ HTTP/2 desteği
- ✅ Streaming desteği

## 🔄 Axios'tan Geçiş

Laxios, Axios ile %100 uyumlu API sunar. Mevcut Axios kodunuz minimal değişiklikle çalışacaktır:

```typescript
// Axios
import axios from 'axios';

// Laxios - sadece import değiştirin
import laxios from 'laxios';

// Aynı API, aynı kullanım
const response = await laxios.get('/api/users');
```

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: add amazing feature'`)
4. Branch'i push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 🙏 Teşekkürler

- [Axios](https://github.com/axios/axios) - İlham kaynağı
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) - Altyapı
- Tüm katkıda bulunanlar

## 📞 Destek

- 🐛 [Issues](https://github.com/yourusername/laxios/issues)
- 💬 [Discussions](https://github.com/yourusername/laxios/discussions)
- 📧 Email: support@laxios.dev

---

**Laxios ile modern HTTP client deneyimini yaşayın! 🚀**