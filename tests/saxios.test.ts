import saxios, { SaxiosError, Cancel, CancelToken, isCancel, isSaxiosError } from '../src';

// Mock fetch
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('saxios', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Basic functionality', () => {
    it('should make a GET request', async () => {
      const responseData = { message: 'success' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve(JSON.stringify(responseData)),
        json: () => Promise.resolve(responseData)
      } as Response);

      const response = await saxios.get('https://api.example.com/users');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(response.data).toEqual(responseData);
      expect(response.status).toBe(200);
    });

    it('should make a POST request with data', async () => {
      const requestData = { name: 'John', email: 'john@example.com' };
      const responseData = { id: 1, ...requestData };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve(JSON.stringify(responseData))
      } as Response);

      const response = await saxios.post('https://api.example.com/users', requestData);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestData)
        })
      );
      expect(response.data).toEqual(responseData);
      expect(response.status).toBe(201);
    });

    it('should handle request with custom headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve('{}')
      } as Response);

      await saxios.get('https://api.example.com/users', {
        headers: {
          'Authorization': 'Bearer token123',
          'Custom-Header': 'custom-value'
        }
      });

      const [, options] = mockFetch.mock.calls[0];
      const headers = options?.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer token123');
      expect(headers.get('custom-header')).toBe('custom-value');
    });
  });

  describe('Instance creation', () => {
    it('should create instance with custom config', () => {
      const instance = saxios.create({
        baseURL: 'https://api.example.com',
        timeout: 5000,
        headers: {
          'Authorization': 'Bearer token123'
        }
      });

      expect(instance.defaults.baseURL).toBe('https://api.example.com');
      expect(instance.defaults.timeout).toBe(5000);
      expect(instance.defaults.headers?.Authorization).toBe('Bearer token123');
    });

    it('should make request with instance config', async () => {
      const instance = saxios.create({
        baseURL: 'https://api.example.com'
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve('{}')
      } as Response);

      await instance.get('/users');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.any(Object)
      );
    });
  });

  describe('Interceptors', () => {
    it('should add request interceptor', async () => {
      const instance = saxios.create();
      const requestInterceptor = jest.fn((config) => {
        config.headers = { ...config.headers, 'X-Custom': 'intercepted' };
        return config;
      });

      instance.interceptors.request.use(requestInterceptor);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve('{}')
      } as Response);

      await instance.get('https://api.example.com/users');

      expect(requestInterceptor).toHaveBeenCalled();
      const [, options] = mockFetch.mock.calls[0];
      const headers = options?.headers as Headers;
      expect(headers.get('x-custom')).toBe('intercepted');
    });

    it('should add response interceptor', async () => {
      const instance = saxios.create();
      const responseInterceptor = jest.fn((response) => {
        response.data = { ...response.data, intercepted: true };
        return response;
      });

      instance.interceptors.response.use(responseInterceptor);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve('{"message": "success"}')
      } as Response);

      const response = await instance.get('https://api.example.com/users');

      expect(responseInterceptor).toHaveBeenCalled();
      expect(response.data.intercepted).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should throw SaxiosError on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: () => Promise.resolve('Not Found')
      } as Response);

      try {
        await saxios.get('https://api.example.com/users/999');
      } catch (error) {
        expect(isSaxiosError(error)).toBe(true);
        expect((error as SaxiosError).status).toBe(404);
        expect((error as SaxiosError).response?.status).toBe(404);
      }
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      try {
        await saxios.get('https://api.example.com/users');
      } catch (error) {
        expect(isSaxiosError(error)).toBe(true);
        expect((error as SaxiosError).message).toContain('Network error');
      }
    });
  });

  describe('Cancel token', () => {
    it('should cancel request with cancel token', async () => {
      const source = CancelToken.source();
      
      // Cancel hemen
      source.cancel('Operation canceled');

      try {
        await saxios.get('https://api.example.com/users', {
          cancelToken: source.token
        });
      } catch (error) {
        expect(isCancel(error)).toBe(true);
        expect((error as Cancel).message).toBe('Operation canceled');
      }
    });
  });

  describe('Utility functions', () => {
    it('should identify SaxiosError correctly', () => {
      const err = new SaxiosError('Test error');
      const regularError = new Error('Regular error');

      expect(isSaxiosError(err)).toBe(true);
      expect(isSaxiosError(regularError)).toBe(false);
    });

    it('should identify Cancel correctly', () => {
      const cancel = new Cancel('Canceled');
      const regularError = new Error('Regular error');

      expect(isCancel(cancel)).toBe(true);
      expect(isCancel(regularError)).toBe(false);
    });

    it('should convert object to FormData', () => {
      const obj = {
        name: 'John',
        age: 30,
        hobbies: ['reading', 'coding']
      };

      const formData = saxios.toFormData(obj);
      expect(formData).toBeInstanceOf(FormData);
    });
  });

  describe('Request methods', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve('{}')
      } as Response);
    });

    it('should make DELETE request', async () => {
      await saxios.delete('https://api.example.com/users/1');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should make PUT request', async () => {
      const data = { name: 'Updated Name' };
      await saxios.put('https://api.example.com/users/1', data);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({ 
          method: 'PUT',
          body: JSON.stringify(data)
        })
      );
    });

    it('should make PATCH request', async () => {
      const data = { name: 'Patched Name' };
      await saxios.patch('https://api.example.com/users/1', data);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({ 
          method: 'PATCH',
          body: JSON.stringify(data)
        })
      );
    });

    it('should make HEAD request', async () => {
      await saxios.head('https://api.example.com/users');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({ method: 'HEAD' })
      );
    });

    it('should make OPTIONS request', async () => {
      await saxios.options('https://api.example.com/users');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({ method: 'OPTIONS' })
      );
    });
  });
});