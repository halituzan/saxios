// Jest setup

// Global fetch mock
global.fetch = jest.fn();

// AbortController mock
if (!global.AbortController) {
  global.AbortController = class AbortController {
    signal = {
      aborted: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    };
    
    abort() {
      this.signal.aborted = true;
    }
  } as any;
}

// FormData mock
if (!global.FormData) {
  global.FormData = class FormData {
    private data = new Map<string, any>();
    
    append(name: string, value: any) {
      this.data.set(name, value);
    }
    
    get(name: string) {
      return this.data.get(name);
    }
    
    forEach(callback: (value: any, key: string) => void) {
      this.data.forEach(callback);
    }
  } as any;
}

// Headers mock
if (!global.Headers) {
  global.Headers = class Headers {
    private headers = new Map<string, string>();
    
    set(name: string, value: string) {
      this.headers.set(name.toLowerCase(), value);
    }
    
    get(name: string) {
      return this.headers.get(name.toLowerCase()) || null;
    }
    
    has(name: string) {
      return this.headers.has(name.toLowerCase());
    }
    
    forEach(callback: (value: string, key: string) => void) {
      this.headers.forEach(callback);
    }
  } as any;
}

beforeEach(() => {
  (fetch as jest.Mock).mockClear();
});