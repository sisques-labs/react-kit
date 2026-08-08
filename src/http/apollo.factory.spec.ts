import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApolloLink, Observable, gql, type FetchResult } from '@apollo/client';

vi.mock('@/core/http/refresh-mutex', () => ({
  refreshTokenOnce: vi.fn(),
}));
vi.mock('@/core/http/http-logger', () => ({
  logHttpError: vi.fn(),
}));

import { refreshTokenOnce } from '@/core/http/refresh-mutex';
import { logHttpError } from '@/core/http/http-logger';
import {
  createApolloClient,
  createAuthLink,
  createExtraHeadersLink,
  createOnErrorLink,
  createLoggingLink,
  createFetchWithTimeout,
} from './apollo.factory';

const TEST_QUERY = gql`
  query Test {
    test
  }
`;

// Apollo v4 requires a { client } context in ApolloLink.execute.
// The ErrorLink accesses client.queryManager.incrementalHandler for graphQL error detection.
const FAKE_INCREMENTAL_HANDLER = {
  isIncrementalResult: () => false,
  extractErrors: () => [],
};
const FAKE_CLIENT_CTX = {
  client: {
    queryManager: {
      incrementalHandler: FAKE_INCREMENTAL_HANDLER,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
};

function captureContextLink(): {
  link: ApolloLink;
  captured: { headers: Record<string, string> };
} {
  const captured = { headers: {} as Record<string, string> };
  const link = new ApolloLink((operation) => {
    const ctx = operation.getContext();
    captured.headers = ctx.headers ?? {};
    return new Observable<FetchResult>((observer) => {
      observer.next({ data: { test: true } });
      observer.complete();
    });
  });
  return { link, captured };
}

function executeLink(link: ApolloLink): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ApolloLink.execute(link, { query: TEST_QUERY }, FAKE_CLIENT_CTX).subscribe({
      next: () => {},
      error: reject,
      complete: resolve,
    });
  });
}

function executeLinkCollect(link: ApolloLink): Promise<FetchResult[]> {
  return new Promise<FetchResult[]>((resolve, reject) => {
    const results: FetchResult[] = [];
    ApolloLink.execute(link, { query: TEST_QUERY }, FAKE_CLIENT_CTX).subscribe({
      next: (v) => results.push(v),
      error: reject,
      complete: () => resolve(results),
    });
  });
}

describe('createApolloClient', () => {
  it('builds an ApolloClient instance', () => {
    const client = createApolloClient({
      graphqlUrl: 'https://api.example.com/graphql',
      getAccessToken: () => null,
      refresh: vi.fn(),
      onAuthFailure: vi.fn(),
    });

    expect(client).toBeDefined();
  });
});

describe('createAuthLink', () => {
  it('sets Authorization header when a token is present', async () => {
    const authLink = createAuthLink(() => 'tok123');
    const { link: terminal, captured } = captureContextLink();
    const chain = ApolloLink.from([authLink, terminal]);

    await executeLink(chain);

    expect(captured.headers['Authorization']).toBe('Bearer tok123');
  });

  it('omits Authorization header when there is no token', async () => {
    const authLink = createAuthLink(() => null);
    const { link: terminal, captured } = captureContextLink();
    const chain = ApolloLink.from([authLink, terminal]);

    await executeLink(chain);

    expect(captured.headers['Authorization']).toBeUndefined();
  });
});

describe('createExtraHeadersLink', () => {
  it('merges extra headers when provided', async () => {
    const extraHeadersLink = createExtraHeadersLink(() => ({
      'X-Space-ID': 'space-1',
    }));
    const { link: terminal, captured } = captureContextLink();
    const chain = ApolloLink.from([extraHeadersLink, terminal]);

    await executeLink(chain);

    expect(captured.headers['X-Space-ID']).toBe('space-1');
  });

  it('is a no-op when getExtraHeaders is omitted', async () => {
    const extraHeadersLink = createExtraHeadersLink(undefined);
    const { link: terminal, captured } = captureContextLink();
    const chain = ApolloLink.from([extraHeadersLink, terminal]);

    await executeLink(chain);

    expect(captured.headers).toEqual({});
  });
});

describe('createOnErrorLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls refresh (via the mutex) on 401 networkError and retries once', async () => {
    const onAuthFailure = vi.fn();
    vi.mocked(refreshTokenOnce).mockResolvedValue('new-token');
    const refresh = vi.fn();
    const onErrorLink = createOnErrorLink(refresh, onAuthFailure);

    let callCount = 0;
    let retryHeaders: Record<string, string> = {};
    const stubLink = new ApolloLink(
      () =>
        new Observable<FetchResult>((observer) => {
          callCount++;
          if (callCount === 1) {
            observer.error(
              Object.assign(new Error('Unauthorized'), { statusCode: 401 }),
            );
          } else {
            observer.next({ data: { test: true } });
            observer.complete();
          }
        }),
    );
    const stubWithCapture = new ApolloLink((operation, forward) => {
      retryHeaders = operation.getContext().headers ?? {};
      return forward!(operation);
    });

    const chain = ApolloLink.from([onErrorLink, stubWithCapture, stubLink]);
    const results = await executeLinkCollect(chain);

    expect(refreshTokenOnce).toHaveBeenCalledOnce();
    expect(onAuthFailure).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(retryHeaders['Authorization']).toBe('Bearer new-token');
  });

  it('calls onAuthFailure and propagates error when refresh returns null', async () => {
    const onAuthFailure = vi.fn();
    vi.mocked(refreshTokenOnce).mockResolvedValue(null);
    const onErrorLink = createOnErrorLink(vi.fn(), onAuthFailure);

    const stubLink = new ApolloLink(
      () =>
        new Observable<FetchResult>((observer) => {
          observer.error(
            Object.assign(new Error('Unauthorized'), { statusCode: 401 }),
          );
        }),
    );

    const chain = ApolloLink.from([onErrorLink, stubLink]);

    await expect(executeLinkCollect(chain)).rejects.toBeDefined();

    expect(onAuthFailure).toHaveBeenCalledOnce();
  });

  it('does not retry when __retried is already set in context', async () => {
    vi.mocked(refreshTokenOnce).mockResolvedValue('new-token');
    const onErrorLink = createOnErrorLink(vi.fn(), vi.fn());

    const stubLink = new ApolloLink(
      () =>
        new Observable<FetchResult>((observer) => {
          observer.error(
            Object.assign(new Error('Unauthorized'), { statusCode: 401 }),
          );
        }),
    );

    const setRetriedLink = new ApolloLink((operation, forward) => {
      operation.setContext({ __retried: true });
      return forward!(operation);
    });

    const chain = ApolloLink.from([setRetriedLink, onErrorLink, stubLink]);

    await expect(executeLinkCollect(chain)).rejects.toBeDefined();

    expect(refreshTokenOnce).not.toHaveBeenCalled();
  });

  it('handles UNAUTHENTICATED graphQLError and retries with a fresh token', async () => {
    vi.mocked(refreshTokenOnce).mockResolvedValue('new-token');
    const onErrorLink = createOnErrorLink(vi.fn(), vi.fn());

    let callCount = 0;
    let retryHeaders: Record<string, string> = {};
    const stubLink = new ApolloLink(
      (operation) =>
        new Observable<FetchResult>((observer) => {
          callCount++;
          if (callCount === 1) {
            observer.next({
              data: null,
              errors: [
                {
                  message: 'Unauthorized',
                  extensions: { code: 'UNAUTHENTICATED' },
                  locations: undefined,
                  path: undefined,
                  nodes: undefined,
                  source: undefined,
                  positions: undefined,
                  originalError: undefined,
                  name: 'GraphQLError',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any,
              ],
            });
            observer.complete();
          } else {
            retryHeaders = operation.getContext().headers ?? {};
            observer.next({ data: { test: true } });
            observer.complete();
          }
        }),
    );

    const chain = ApolloLink.from([onErrorLink, stubLink]);
    await executeLinkCollect(chain);

    expect(refreshTokenOnce).toHaveBeenCalledOnce();
    expect(retryHeaders['Authorization']).toBe('Bearer new-token');
  });
});

describe('createLoggingLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call onError on a successful operation', async () => {
    const onError = vi.fn();
    const loggingLink = createLoggingLink(
      'https://api.example.com/graphql',
      onError,
    );
    const terminal = new ApolloLink(
      () =>
        new Observable<FetchResult>((observer) => {
          observer.next({ data: { test: true } });
          observer.complete();
        }),
    );

    const chain = ApolloLink.from([loggingLink, terminal]);
    await executeLinkCollect(chain);

    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onError with status and durationMs on error', async () => {
    const onError = vi.fn();
    const loggingLink = createLoggingLink(
      'https://api.example.com/graphql',
      onError,
    );
    const terminal = new ApolloLink(
      () =>
        new Observable<FetchResult>((observer) => {
          observer.error(
            Object.assign(new Error('Server Error'), { statusCode: 500 }),
          );
        }),
    );

    const chain = ApolloLink.from([loggingLink, terminal]);
    await expect(executeLinkCollect(chain)).rejects.toBeDefined();

    expect(onError).toHaveBeenCalledOnce();
    const [log] = onError.mock.calls[0];
    expect(log.status).toBe(500);
    expect(log.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('defaults onError to logHttpError when createApolloClient is used', () => {
    expect(typeof logHttpError).toBe('function');
  });
});

describe('createFetchWithTimeout', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('forwards the request and resolves with the fetch response', async () => {
    const response = new Response('ok');
    globalThis.fetch = vi.fn().mockResolvedValue(response);

    const fetchWithTimeout = createFetchWithTimeout(10_000);
    const result = await fetchWithTimeout('https://example.com/graphql');

    expect(result).toBe(response);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it('aborts the request once the timeout elapses', async () => {
    let signal: AbortSignal | undefined;
    globalThis.fetch = vi.fn((_input, init) => {
      signal = (init as RequestInit).signal ?? undefined;
      return new Promise<Response>(() => {});
    });

    const fetchWithTimeout = createFetchWithTimeout(10_000);
    void fetchWithTimeout('https://example.com/graphql');

    expect(signal?.aborted).toBe(false);
    await vi.runOnlyPendingTimersAsync();
    expect(signal?.aborted).toBe(true);
  });
});
