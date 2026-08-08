import { describe, it, expect } from 'vitest';
import { createBareHttp } from './bare-http.factory';

describe('createBareHttp', () => {
  it('applies baseURL, timeout and withCredentials defaults', () => {
    const http = createBareHttp({ baseURL: 'https://api.example.com' });

    expect(http.defaults.baseURL).toBe('https://api.example.com');
    expect(http.defaults.timeout).toBe(10_000);
    expect(http.defaults.withCredentials).toBe(true);
  });

  it('applies custom timeoutMs and withCredentials', () => {
    const http = createBareHttp({
      baseURL: '/api',
      timeoutMs: 3000,
      withCredentials: false,
    });

    expect(http.defaults.timeout).toBe(3000);
    expect(http.defaults.withCredentials).toBe(false);
  });

  it('has no request or response interceptors registered', () => {
    const http = createBareHttp({ baseURL: '/api' });

    expect(http.interceptors.request.handlers.filter(Boolean)).toHaveLength(0);
    expect(http.interceptors.response.handlers.filter(Boolean)).toHaveLength(0);
  });
});
