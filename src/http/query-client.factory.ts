import { QueryClient } from '@tanstack/react-query';

export interface CreateQueryClientOptions {
  /** @default 5 * 60_000 (5 minutes) */
  staleTimeMs?: number;
  /** @default 1 */
  retry?: number;
}

/**
 * A factory rather than a shared singleton export — safer across multiple
 * bundles/consumers than a library-level module-singleton instance.
 */
export function createQueryClient(
  options?: CreateQueryClientOptions,
): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: options?.staleTimeMs ?? 1000 * 60 * 5,
        retry: options?.retry ?? 1,
      },
    },
  });
}
