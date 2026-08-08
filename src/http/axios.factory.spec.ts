import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

vi.mock('@/core/http/refresh-mutex', () => ({
  refreshTokenOnce: vi.fn(),
}));
vi.mock('@/core/http/http-logger', () => ({
  logHttpError: vi.fn(),
}));

import { refreshTokenOnce } from '@/core/http/refresh-mutex';
import { logHttpError } from '@/core/http/http-logger';
import { createAxiosClient } from './axios.factory';

function make401Error(url: string, retried = false): AxiosError {
  const config = {
    url,
    _retry: retried,
    headers: {},
  } as unknown as InternalAxiosRequestConfig & { _retry: boolean };

  return {
    config,
    response: { status: 401 },
    isAxiosError: true,
    message: 'Unauthorized',
    name: 'AxiosError',
    toJSON: () => ({}),
  } as unknown as AxiosError;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getErrorInterceptorHandler(http: any) {
  const handler = http.interceptors.response.handlers.find(
    (h: unknown) => h !== null,
  );
  return handler?.rejected as (error: unknown) => Promise<unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRequestInterceptorHandler(http: any) {
  const handler = http.interceptors.request.handlers.find(
    (h: unknown) => h !== null,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handler?.fulfilled as (config: any) => any;
}

describe('createAxiosClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has baseURL and timeout applied', () => {
    const http = createAxiosClient({
      baseURL: 'https://api.example.com',
      timeoutMs: 5000,
      getAccessToken: () => null,
      refresh: vi.fn(),
      onAuthFailure: vi.fn(),
    });

    expect(http.defaults.baseURL).toBe('https://api.example.com');
    expect(http.defaults.timeout).toBe(5000);
  });

  it('defaults timeout to 10_000ms and withCredentials to true', () => {
    const http = createAxiosClient({
      baseURL: '/api',
      getAccessToken: () => null,
      refresh: vi.fn(),
      onAuthFailure: vi.fn(),
    });

    expect(http.defaults.timeout).toBe(10_000);
    expect(http.defaults.withCredentials).toBe(true);
  });

  describe('request interceptor', () => {
    it('sets Authorization header when a token is present', () => {
      const http = createAxiosClient({
        baseURL: '/api',
        getAccessToken: () => 'tok123',
        refresh: vi.fn(),
        onAuthFailure: vi.fn(),
      });

      const fulfilled = getRequestInterceptorHandler(http);
      const config = { url: '/plants', headers: new Map() };
      config.headers.set = vi.fn();
      fulfilled(config);

      expect(config.headers.set).toHaveBeenCalledWith(
        'Authorization',
        'Bearer tok123',
      );
    });

    it('omits Authorization header on an authSkipPaths request', () => {
      const http = createAxiosClient({
        baseURL: '/api',
        getAccessToken: () => 'tok123',
        refresh: vi.fn(),
        onAuthFailure: vi.fn(),
      });

      const fulfilled = getRequestInterceptorHandler(http);
      const config = { url: '/auth/login', headers: new Map() };
      config.headers.set = vi.fn();
      fulfilled(config);

      expect(config.headers.set).not.toHaveBeenCalledWith(
        'Authorization',
        expect.anything(),
      );
    });

    it('merges extra headers returned by getExtraHeaders', () => {
      const http = createAxiosClient({
        baseURL: '/api',
        getAccessToken: () => null,
        getExtraHeaders: () => ({ 'X-Space-ID': 'space-1' }),
        refresh: vi.fn(),
        onAuthFailure: vi.fn(),
      });

      const fulfilled = getRequestInterceptorHandler(http);
      const config = { url: '/plants', headers: new Map() };
      config.headers.set = vi.fn();
      fulfilled(config);

      expect(config.headers.set).toHaveBeenCalledWith('X-Space-ID', 'space-1');
    });
  });

  describe('response interceptor', () => {
    it('refreshPath 401 → onAuthFailure called, refresh not attempted', async () => {
      const onAuthFailure = vi.fn();
      const http = createAxiosClient({
        baseURL: '/api',
        getAccessToken: () => 'tok',
        refresh: vi.fn(),
        onAuthFailure,
      });

      const error = make401Error('/auth/refresh');
      const errorHandler = getErrorInterceptorHandler(http);

      await expect(errorHandler(error)).rejects.toBeDefined();

      expect(onAuthFailure).toHaveBeenCalledOnce();
      expect(refreshTokenOnce).not.toHaveBeenCalled();
    });

    it('authSkipPaths 401 → rejects without calling onAuthFailure or refresh', async () => {
      const onAuthFailure = vi.fn();
      const http = createAxiosClient({
        baseURL: '/api',
        getAccessToken: () => 'tok',
        refresh: vi.fn(),
        onAuthFailure,
      });

      const error = make401Error('/auth/login');
      const errorHandler = getErrorInterceptorHandler(http);

      await expect(errorHandler(error)).rejects.toBeDefined();

      expect(onAuthFailure).not.toHaveBeenCalled();
      expect(refreshTokenOnce).not.toHaveBeenCalled();
    });

    it('non-skip 401, refresh resolves with token → retries and calls onTokenRefreshed', async () => {
      vi.mocked(refreshTokenOnce).mockResolvedValue('new-token');
      const onAuthFailure = vi.fn();
      const onTokenRefreshed = vi.fn();
      const http = createAxiosClient({
        baseURL: '/api',
        getAccessToken: () => 'tok',
        refresh: vi.fn(),
        onAuthFailure,
        onTokenRefreshed,
      });

      const error = make401Error('/plants');
      const errorHandler = getErrorInterceptorHandler(http);

      const originalAdapter = http.defaults.adapter;
      http.defaults.adapter = vi.fn().mockResolvedValue({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: error.config!,
        request: {},
      });

      await errorHandler(error);

      expect(refreshTokenOnce).toHaveBeenCalledOnce();
      expect(onTokenRefreshed).toHaveBeenCalledWith('new-token');
      expect(onAuthFailure).not.toHaveBeenCalled();

      http.defaults.adapter = originalAdapter;
    });

    it('non-skip 401, refresh returns null → onAuthFailure called', async () => {
      vi.mocked(refreshTokenOnce).mockResolvedValue(null);
      const onAuthFailure = vi.fn();
      const http = createAxiosClient({
        baseURL: '/api',
        getAccessToken: () => 'tok',
        refresh: vi.fn(),
        onAuthFailure,
      });

      const error = make401Error('/plants');
      const errorHandler = getErrorInterceptorHandler(http);

      await expect(errorHandler(error)).rejects.toBeDefined();

      expect(refreshTokenOnce).toHaveBeenCalledOnce();
      expect(onAuthFailure).toHaveBeenCalledOnce();
    });

    it('_retry already set → pass-through, no refresh attempted', async () => {
      const onAuthFailure = vi.fn();
      const http = createAxiosClient({
        baseURL: '/api',
        getAccessToken: () => 'tok',
        refresh: vi.fn(),
        onAuthFailure,
      });

      const error = make401Error('/plants', true);
      const errorHandler = getErrorInterceptorHandler(http);

      await expect(errorHandler(error)).rejects.toBeDefined();

      expect(refreshTokenOnce).not.toHaveBeenCalled();
      expect(onAuthFailure).not.toHaveBeenCalled();
    });

    it('non-401 error → rejects without touching refresh/onAuthFailure', async () => {
      const onAuthFailure = vi.fn();
      const http = createAxiosClient({
        baseURL: '/api',
        getAccessToken: () => 'tok',
        refresh: vi.fn(),
        onAuthFailure,
      });

      const error = {
        config: { url: '/plants', headers: {} },
        response: { status: 500 },
        isAxiosError: true,
        message: 'Internal Server Error',
      };
      const errorHandler = getErrorInterceptorHandler(http);

      await expect(errorHandler(error)).rejects.toBeDefined();

      expect(refreshTokenOnce).not.toHaveBeenCalled();
      expect(onAuthFailure).not.toHaveBeenCalled();
    });

    it('calls the onError hook with status, url and durationMs', async () => {
      const onError = vi.fn();
      const http = createAxiosClient({
        baseURL: '/api',
        getAccessToken: () => 'tok',
        refresh: vi.fn(),
        onAuthFailure: vi.fn(),
        onError,
      });

      const error = {
        config: { url: '/plants', headers: {}, _startTime: Date.now() - 50 },
        response: { status: 500 },
        isAxiosError: true,
        message: 'Internal Server Error',
      };
      const errorHandler = getErrorInterceptorHandler(http);

      await expect(errorHandler(error)).rejects.toBeDefined();

      expect(onError).toHaveBeenCalledOnce();
      expect(logHttpError).not.toHaveBeenCalled();
      const [log] = vi.mocked(onError).mock.calls[0];
      expect(log.status).toBe(500);
      expect(log.url).toBe('/plants');
      expect(log.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('defaults the onError hook to logHttpError', async () => {
      const http = createAxiosClient({
        baseURL: '/api',
        getAccessToken: () => 'tok',
        refresh: vi.fn(),
        onAuthFailure: vi.fn(),
      });

      const error = {
        config: { url: '/plants', headers: {} },
        response: { status: 500 },
        isAxiosError: true,
        message: 'Internal Server Error',
      };
      const errorHandler = getErrorInterceptorHandler(http);

      await expect(errorHandler(error)).rejects.toBeDefined();

      expect(logHttpError).toHaveBeenCalledOnce();
    });
  });
});
