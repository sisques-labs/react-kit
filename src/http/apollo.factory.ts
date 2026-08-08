import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
  createHttpLink,
  from,
  type FetchResult,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { refreshTokenOnce } from '@/core/http/refresh-mutex';
import { logHttpError } from '@/core/http/http-logger';

export interface CreateApolloClientOptions {
  graphqlUrl: string;
  /** @default 10_000 */
  timeoutMs?: number;
  /** Called per request; return `null`/`undefined` when signed out. */
  getAccessToken: () => string | null | undefined;
  /** Return extra headers to merge on every request (e.g. `X-Space-ID`). */
  getExtraHeaders?: () => Record<string, string> | undefined;
  /**
   * Performs the actual refresh call and returns the new access token. Pass
   * the SAME closure given to {@link createAxiosClient}'s `refresh` option
   * so both clients share one in-flight refresh via `refresh-mutex.ts`.
   */
  refresh: () => Promise<string>;
  /** Refresh failed (or returned falsy) — clear auth state / redirect. */
  onAuthFailure: () => void;
  /** Failed-response logging hook. Defaults to `logHttpError`. */
  onError?: (log: {
    status?: number;
    url?: string;
    durationMs: number;
  }) => void;
}

function isUnauthorizedError(error: unknown): boolean {
  if (ServerError.is(error) && error.statusCode === 401) return true;
  if (CombinedGraphQLErrors.is(error)) {
    return error.errors.some((e) => e.extensions?.code === 'UNAUTHENTICATED');
  }
  // Fallback: plain error object with statusCode (e.g. from tests)
  if (error && typeof error === 'object' && 'statusCode' in error) {
    return (error as { statusCode: number }).statusCode === 401;
  }
  return false;
}

/** `fetch` wrapped with an AbortController-driven timeout. */
export function createFetchWithTimeout(
  timeoutMs: number,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return (input, init) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(input, { ...init, signal: controller.signal }).finally(() =>
      clearTimeout(id),
    );
  };
}

/** Reads the access token at request time (rotation-safe). Omits header when null. */
export function createAuthLink(
  getAccessToken: () => string | null | undefined,
): ApolloLink {
  return setContext((_, previousContext) => {
    const token = getAccessToken();
    if (!token) return previousContext;
    return {
      ...previousContext,
      headers: {
        ...(previousContext.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    };
  });
}

/** Merges `getExtraHeaders()` into every request's context headers. */
export function createExtraHeadersLink(
  getExtraHeaders?: () => Record<string, string> | undefined,
): ApolloLink {
  return setContext((_, previousContext) => {
    const extraHeaders = getExtraHeaders?.();
    if (!extraHeaders) return previousContext;
    return {
      ...previousContext,
      headers: { ...(previousContext.headers ?? {}), ...extraHeaders },
    };
  });
}

/**
 * On 401 / UNAUTHENTICATED: refresh once via the shared mutex, retry. On
 * refresh failure: call `onAuthFailure`. The `__retried` context flag
 * prevents an infinite retry loop.
 */
export function createOnErrorLink(
  refresh: () => Promise<string>,
  onAuthFailure: () => void,
): ApolloLink {
  return new ErrorLink(({ error, operation, forward }) => {
    if (!isUnauthorizedError(error)) return;

    const ctx = operation.getContext();
    if (ctx.__retried) return;

    return new Observable<FetchResult>((observer) => {
      refreshTokenOnce(refresh)
        .then((token) => {
          if (!token) {
            onAuthFailure();
            observer.error(error);
            return;
          }
          operation.setContext({
            ...ctx,
            __retried: true,
            headers: {
              ...(ctx.headers ?? {}),
              Authorization: `Bearer ${token}`,
            },
          });
          const sub = forward(operation).subscribe({
            next: (v) => observer.next(v),
            error: (e) => observer.error(e),
            complete: () => observer.complete(),
          });
          return () => sub.unsubscribe();
        })
        .catch((err) => observer.error(err));
    });
  });
}

/** Logs non-recoverable HTTP errors (after `onErrorLink` has had a chance to retry). */
export function createLoggingLink(
  graphqlUrl: string,
  onError: (log: { status?: number; url?: string; durationMs: number }) => void,
): ApolloLink {
  return new ApolloLink((operation, forward) => {
    const startTime = Date.now();
    return new Observable<FetchResult>((observer) => {
      const sub = forward(operation).subscribe({
        next: (value) => observer.next(value),
        error: (err) => {
          onError({
            status: (err as { statusCode?: number }).statusCode,
            url: graphqlUrl,
            durationMs: Date.now() - startTime,
          });
          observer.error(err);
        },
        complete: () => observer.complete(),
      });
      return () => sub.unsubscribe();
    });
  });
}

/**
 * Builds an Apollo Client with Bearer-token injection and a 401/UNAUTHENTICATED
 * → single-in-flight-refresh → retry-once link, mirroring the hand-rolled
 * `apollo.client.ts` pattern used across Sisques Labs frontends before this
 * extraction. Link order: authLink → extraHeadersLink → onErrorLink →
 * loggingLink → httpLink.
 */
export function createApolloClient(
  options: CreateApolloClientOptions,
): ApolloClient {
  const onError = options.onError ?? logHttpError;

  const httpLink = createHttpLink({
    uri: options.graphqlUrl,
    credentials: 'include',
    fetch: createFetchWithTimeout(options.timeoutMs ?? 10_000),
  });

  const authLink = createAuthLink(options.getAccessToken);
  const extraHeadersLink = createExtraHeadersLink(options.getExtraHeaders);
  const onErrorLink = createOnErrorLink(options.refresh, options.onAuthFailure);
  const loggingLink = createLoggingLink(options.graphqlUrl, onError);

  return new ApolloClient({
    link: from([
      authLink,
      extraHeadersLink,
      onErrorLink,
      loggingLink,
      httpLink,
    ]),
    cache: new InMemoryCache(),
  });
}
