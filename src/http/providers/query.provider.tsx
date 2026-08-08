'use client';

import * as React from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';

export interface ReactQueryProviderProps {
  client: QueryClient;
  children: React.ReactNode;
}

/**
 * Takes `client` as a required prop (built via `createQueryClient`) instead
 * of importing a module-level singleton — react-kit ships factories, not
 * singletons, so each app owns constructing (and, in dev, wiring devtools
 * around) its own client.
 */
export function ReactQueryProvider({
  client,
  children,
}: ReactQueryProviderProps) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
