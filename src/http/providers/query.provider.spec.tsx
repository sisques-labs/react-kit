import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { ReactQueryProvider } from './query.provider';

describe('ReactQueryProvider', () => {
  it('renders its children', () => {
    const client = new QueryClient();

    render(
      <ReactQueryProvider client={client}>
        <div>child content</div>
      </ReactQueryProvider>,
    );

    expect(screen.getByText('child content')).toBeInTheDocument();
  });
});
