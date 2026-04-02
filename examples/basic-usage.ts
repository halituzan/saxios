import saxios from '../src';

// Basic usage examples

async function basicExamples() {
  try {
    // GET request
    console.log('=== GET Request ===');
    const users = await saxios.get('https://jsonplaceholder.typicode.com/users');
    console.log('Users:', users.data.slice(0, 2)); // First two users

    // POST request
    console.log('\n=== POST Request ===');
    const newPost = await saxios.post('https://jsonplaceholder.typicode.com/posts', {
      title: 'saxios Test Post',
      body: 'Test post created with saxios',
      userId: 1
    });
    console.log('New Post:', newPost.data);

    // PUT request
    console.log('\n=== PUT Request ===');
    const updatedPost = await saxios.put('https://jsonplaceholder.typicode.com/posts/1', {
      id: 1,
      title: 'Updated Post',
      body: 'This post was updated with saxios',
      userId: 1
    });
    console.log('Updated Post:', updatedPost.data);

    // DELETE request
    console.log('\n=== DELETE Request ===');
    const deleteResponse = await saxios.delete('https://jsonplaceholder.typicode.com/posts/1');
    console.log('Delete Response Status:', deleteResponse.status);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Instance usage
async function instanceExample() {
  console.log('\n=== Instance Example ===');
  
  const api = saxios.create({
    baseURL: 'https://jsonplaceholder.typicode.com',
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
      'X-Custom-Header': 'Saxios-Example'
    }
  });

  try {
    const response = await api.get('/posts/1');
    console.log('Post from instance:', response.data);
  } catch (error) {
    console.error('Instance error:', error);
  }
}

// Interceptors
async function interceptorExample() {
  console.log('\n=== Interceptor Example ===');
  
  const api = saxios.create({
    baseURL: 'https://jsonplaceholder.typicode.com'
  });

  // Request interceptor
  api.interceptors.request.use(
    (config) => {
      console.log('Sending request:', config.method?.toUpperCase(), config.url);
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
      console.log('Response received:', response.status, response.statusText);
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

// Error handling
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  try {
    // Non-existent endpoint
    await saxios.get('https://jsonplaceholder.typicode.com/nonexistent');
  } catch (error) {
    if (saxios.isSaxiosError(error)) {
      console.log('Saxios Error:');
      console.log('- Status:', error.response?.status);
      console.log('- Status Text:', error.response?.statusText);
      console.log('- URL:', error.config?.url);
    } else {
      console.log('Network Error:', error.message);
    }
  }
}

// Cancel token
async function cancelTokenExample() {
  console.log('\n=== Cancel Token Example ===');
  
  const source = saxios.CancelToken.source();
  
  // Cancel after 2 seconds
  setTimeout(() => {
    source.cancel('Cancelled after 2 seconds');
  }, 2000);

  try {
    const response = await saxios.get('https://jsonplaceholder.typicode.com/posts', {
      cancelToken: source.token
    });
    console.log('Response received:', response.data.length, 'posts');
  } catch (error) {
    if (saxios.isCancel(error)) {
      console.log('Request cancelled:', error.message);
    } else {
      console.error('Other error:', error);
    }
  }
}

// Cache
async function cacheExample() {
  console.log('\n=== Cache Example ===');
  
  const api = saxios.create({
    baseURL: 'https://jsonplaceholder.typicode.com',
    cache: {
      enabled: true,
      ttl: 30000, // 30 second TTL
      maxSize: 50
    }
  });

  try {
    console.time('First request (cache miss)');
    const response1 = await api.get('/posts/1');
    console.timeEnd('First request (cache miss)');
    console.log('First response title:', response1.data.title);

    console.time('Second request (cache hit)');
    const response2 = await api.get('/posts/1');
    console.timeEnd('Second request (cache hit)');
    console.log('Second response title:', response2.data.title);

    const stats = api.cache.getStats();
    console.log('Cache Stats:', {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: `${stats.hitRate.toFixed(2)}%`,
      size: stats.size
    });

    await api.cache.clear();
    console.log('Cache cleared');

  } catch (error) {
    console.error('Cache example error:', error);
  }
}

// Performance comparison
async function performanceComparison() {
  console.log('\n=== Performance Comparison ===');
  
  const noCacheApi = saxios.create({
    baseURL: 'https://jsonplaceholder.typicode.com',
    cache: false
  });

  const cacheApi = saxios.create({
    baseURL: 'https://jsonplaceholder.typicode.com',
    cache: true
  });

  try {
    console.time('No Cache - 3 requests');
    await noCacheApi.get('/posts/1');
    await noCacheApi.get('/posts/1');
    await noCacheApi.get('/posts/1');
    console.timeEnd('No Cache - 3 requests');

    console.time('With Cache - 3 requests');
    await cacheApi.get('/posts/1'); // miss
    await cacheApi.get('/posts/1'); // hit
    await cacheApi.get('/posts/1'); // hit
    console.timeEnd('With Cache - 3 requests');

    const stats = cacheApi.cache.getStats();
    console.log('Cache performance:', {
      totalRequests: stats.hits + stats.misses,
      cacheHits: stats.hits,
      hitRate: `${stats.hitRate.toFixed(2)}%`
    });

  } catch (error) {
    console.error('Performance comparison error:', error);
  }
}

// Run all examples
async function runExamples() {
  console.log('🚀 Saxios Examples Starting...\n');
  
  await basicExamples();
  await instanceExample();
  await interceptorExample();
  await errorHandlingExample();
  await cancelTokenExample();
  await cacheExample();
  await performanceComparison();
  
  console.log('\n✅ All examples completed!');
}

// Run when executed directly under Node
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  basicExamples,
  instanceExample,
  interceptorExample,
  errorHandlingExample,
  cancelTokenExample,
  cacheExample,
  performanceComparison,
  runExamples
};
