import axios, { type AxiosInstance } from 'axios';

export interface CreateBareHttpOptions {
  baseURL: string;
  /** @default 10_000 */
  timeoutMs?: number;
  /** @default true */
  withCredentials?: boolean;
}

/**
 * A plain axios instance with no interceptors. Use it to build the app's own
 * `refresh` closure (e.g. `POST /auth/refresh`) — passing the interceptor-
 * bearing client from {@link createAxiosClient} into its own `refresh`
 * option would recurse into the same 401 handling it's meant to resolve.
 */
export function createBareHttp(options: CreateBareHttpOptions): AxiosInstance {
  return axios.create({
    baseURL: options.baseURL,
    withCredentials: options.withCredentials ?? true,
    timeout: options.timeoutMs ?? 10_000,
  });
}
