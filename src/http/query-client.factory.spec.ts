import { describe, it, expect } from 'vitest';
import { createQueryClient } from './query-client.factory';

describe('createQueryClient', () => {
  it('applies the default staleTime and retry', () => {
    const client = createQueryClient();

    expect(client.getDefaultOptions().queries?.staleTime).toBe(1000 * 60 * 5);
    expect(client.getDefaultOptions().queries?.retry).toBe(1);
  });

  it('applies custom staleTimeMs and retry', () => {
    const client = createQueryClient({ staleTimeMs: 1000, retry: 3 });

    expect(client.getDefaultOptions().queries?.staleTime).toBe(1000);
    expect(client.getDefaultOptions().queries?.retry).toBe(3);
  });
});
