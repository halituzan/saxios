import laxios from '../src';

// Temel kullanım örnekleri

async function basicExamples() {
  try {
    // GET request
    console.log('=== GET Request ===');
    const users = await laxios.get('https://jsonplaceholder.typicode.com/users');
    console.log('Users:', users.data.slice(0, 2)); // İlk 2 kullanıcı

    // POST request
    console.log('\n=== POST Request ===');
    const newPost = await laxios.post('https://jsonplaceholder.typicode.com/posts', {
      title: 'Laxios Test Post',
      body: 'Bu Laxios ile oluşturulmuş bir test post\'u',
      userId: 1
    });
    console.log('New Post:', newPost.data);

    // PUT request
    console.log('\n=== PUT Request ===');
    const updatedPost = await laxios.put('https://jsonplaceholder.typicode.com/posts/1', {
      id: 1,
      title: 'Güncellenmiş Post',
      body: 'Bu post Laxios ile güncellendi',
      userId: 1
    });
    console.log('Updated Post:', updatedPost.data);

    // DELETE request
    console.log('\n=== DELETE Request ===');
    const deleteResponse = await laxios.delete('https://jsonplaceholder.typicode.com/posts/1');
    console.log('Delete Response Status:', deleteResponse.status);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Instance kullanımı
async function instanceExample() {
  console.log('\n=== Instance Example ===');
  
  const api = laxios.create({
    baseURL: 'https://jsonplaceholder.typicode.com',
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
      'X-Custom-Header': 'Laxios-Example'
    }
  });

  try {
    const response = await api.get('/posts/1');
    console.log('Post from instance:', response.data);
  } catch (error) {
    console.error('Instance error:', error);
  }
}

// Interceptor örneği
async function interceptorExample() {
  console.log('\n=== Interceptor Example ===');
  
  const api = laxios.create({
    baseURL: 'https://jsonplaceholder.typicode.com'
  });

  // Request interceptor
  api.interceptors.request.use(
    (config) => {
      console.log('Request gönderiliyor:', config.method?.toUpperCase(), config.url);
      config.headers = {
        ...config.headers,
        'X-Request-Time': new Date().toISOString()
      };
      return config;
    },
    (error) => {
      console.error('Request error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor
  api.interceptors.response.use(
    (response) => {
      console.log('Response alındı:', response.status, response.statusText);
      return response;
    },
    (error) => {
      console.error('Response error:', error.response?.status);
      return Promise.reject(error);
    }
  );

  try {
    const response = await api.get('/posts/1');
    console.log('Intercepted response data:', response.data.title);
  } catch (error) {
    console.error('Interceptor example error:', error);
  }
}

// Error handling örneği
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  try {
    // Var olmayan endpoint
    await laxios.get('https://jsonplaceholder.typicode.com/nonexistent');
  } catch (error) {
    if (laxios.isLaxiosError(error)) {
      console.log('Laxios Error:');
      console.log('- Status:', error.response?.status);
      console.log('- Status Text:', error.response?.statusText);
      console.log('- URL:', error.config?.url);
    } else {
      console.log('Network Error:', error.message);
    }
  }
}

// Cancel token örneği
async function cancelTokenExample() {
  console.log('\n=== Cancel Token Example ===');
  
  const source = laxios.CancelToken.source();
  
  // 2 saniye sonra cancel et
  setTimeout(() => {
    source.cancel('İşlem 2 saniye sonra iptal edildi');
  }, 2000);

  try {
    const response = await laxios.get('https://jsonplaceholder.typicode.com/posts', {
      cancelToken: source.token
    });
    console.log('Response received:', response.data.length, 'posts');
  } catch (error) {
    if (laxios.isCancel(error)) {
      console.log('Request cancelled:', error.message);
    } else {
      console.error('Other error:', error);
    }
  }
}

// Tüm örnekleri çalıştır
async function runExamples() {
  console.log('🚀 Laxios Examples Starting...\n');
  
  await basicExamples();
  await instanceExample();
  await interceptorExample();
  await errorHandlingExample();
  await cancelTokenExample();
  
  console.log('\n✅ All examples completed!');
}

// Node.js ortamında çalıştır
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  basicExamples,
  instanceExample,
  interceptorExample,
  errorHandlingExample,
  cancelTokenExample,
  runExamples
};