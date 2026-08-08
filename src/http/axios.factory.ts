import axios, { type AxiosInstance } from 'axios';
import { refreshTokenOnce } from '@/core/http/refresh-mutex';
import { logHttpError } from '@/core/http/http-logger';

export interface CreateAxiosClientOptions {
  baseURL: string;
  /** @default 10_000 */
  timeoutMs?: number;
  /** @default true */
  withCredentials?: boolean;
  /**
   * Paths matched via `path.endsWith(...)` that never get the Authorization
   * header and never trigger a 401 refresh-and-retry (e.g. login/register).
   * A 401 here just rejects — it does NOT call `onAuthFailure` (there's no
   * session to clear yet).
   * @default ['/auth/login', '/auth/register']
   */
  authSkipPaths?: string[];
  /**
   * The refresh endpoint's own path (matched via `path.endsWith(...)`). A
   * 401 here means the refresh call itself was rejected — retrying would
   * loop, so `onAuthFailure` is called immediately instead of calling
   * `refresh` again.
   * @default '/auth/refresh'
   */
  refreshPath?: string;
  /** Called per request; return `null`/`undefined` when signed out. */
  getAccessToken: () => string | null | undefined;
  /**
   * Called per request with the resolved path; return extra headers to
   * merge (e.g. a multi-tenant `X-Space-ID`). Omit when not needed.
   */
  getExtraHeaders?: (path: string) => Record<string, string> | undefined;
  /**
   * Performs the actual refresh call and returns the new access token. Pass
   * the SAME closure to {@link createApolloClient}'s `refresh` option so
   * both clients share one in-flight refresh via the module-level mutex in
   * `refresh-mutex.ts`.
   */
  refresh: () => Promise<string>;
  /** Called once, synchronously, after a successful refresh. */
  onTokenRefreshed?: (token: string) => void;
  /** Refresh failed (or returned falsy) — clear auth state / redirect. */
  onAuthFailure: () => void;
  /** Failed-response logging hook. Defaults to `logHttpError`. */
  onError?: (log: {
    status?: number;
    url?: string;
    durationMs: number;
  }) => void;
}

/**
 * Builds an axios instance with Bearer-token injection and a 401 →
 * single-in-flight-refresh → retry-once interceptor, mirroring the
 * hand-rolled `axios.client.ts` pattern used across Sisques Labs frontends
 * before this extraction.
 */
export function createAxiosClient(
  options: CreateAxiosClientOptions,
): AxiosInstance {
  const authSkipPaths = options.authSkipPaths ?? [
    '/auth/login',
    '/auth/register',
  ];
  const refreshPath = options.refreshPath ?? '/auth/refresh';
  const onError = options.onError ?? logHttpError;

  const http = axios.create({
    baseURL: options.baseURL,
    withCredentials: options.withCredentials ?? true,
    timeout: options.timeoutMs ?? 10_000,
  });

  http.interceptors.request.use((config) => {
    const path = config.url ?? '';
    if (!authSkipPaths.some((p) => path.endsWith(p))) {
      const token = options.getAccessToken();
      if (token) config.headers.set('Authorization', `Bearer ${token}`);
    }
    const extraHeaders = options.getExtraHeaders?.(path);
    if (extraHeaders) {
      for (const [key, value] of Object.entries(extraHeaders)) {
        config.headers.set(key, value);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (config as any)._startTime = Date.now();
    return config;
  });

  http.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const startTime: number =
        (originalRequest as any)?._startTime ?? Date.now();
      onError({
        status: error.response?.status as number | undefined,
        url: originalRequest?.url as string | undefined,
        durationMs: Date.now() - startTime,
      });

      if (error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
      }

      const path = originalRequest.url ?? '';
      if (path.endsWith(refreshPath)) {
        options.onAuthFailure();
        return Promise.reject(error);
      }
      if (authSkipPaths.some((p) => path.endsWith(p))) {
        return Promise.reject(error);
      }

      const newToken = await refreshTokenOnce(options.refresh);
      if (!newToken) {
        options.onAuthFailure();
        return Promise.reject(error);
      }
      options.onTokenRefreshed?.(newToken);

      originalRequest._retry = true;
      originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
      return http(originalRequest);
    },
  );

  return http;
}
