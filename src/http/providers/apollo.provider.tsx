'use client';

import * as React from 'react';
import { ApolloProvider } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';

export interface ApolloClientProviderProps {
  client: ApolloClient;
  children: React.ReactNode;
}

/**
 * Takes `client` as a required prop (built via `createApolloClient`) instead
 * of importing a module-level singleton — react-kit ships factories, not
 * singletons.
 */
export function ApolloClientProvider({
  client,
  children,
}: ApolloClientProviderProps) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
