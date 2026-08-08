import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { ApolloClientProvider } from './apollo.provider';

describe('ApolloClientProvider', () => {
  it('renders its children', () => {
    const client = new ApolloClient({
      link: new HttpLink({ uri: 'https://example.com/graphql' }),
      cache: new InMemoryCache(),
    });

    render(
      <ApolloClientProvider client={client}>
        <div>child content</div>
      </ApolloClientProvider>,
    );

    expect(screen.getByText('child content')).toBeInTheDocument();
  });
});
