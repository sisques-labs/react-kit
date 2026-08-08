import { describe, it, expect } from 'vitest';
import * as HttpEntrypoint from './http';

describe('http entrypoint', () => {
  it('every runtime export is defined', () => {
    const entries = Object.entries(HttpEntrypoint);
    expect(entries.length).toBeGreaterThan(0);
    for (const [name, value] of entries) {
      expect(value, `${name} should not be undefined`).toBeDefined();
    }
  });

  it('spot-checks the factories and providers', () => {
    expect(HttpEntrypoint.createBareHttp).toBeDefined();
    expect(HttpEntrypoint.createAxiosClient).toBeDefined();
    expect(HttpEntrypoint.createApolloClient).toBeDefined();
    expect(HttpEntrypoint.createQueryClient).toBeDefined();
    expect(HttpEntrypoint.ApolloClientProvider).toBeDefined();
    expect(HttpEntrypoint.ReactQueryProvider).toBeDefined();
  });
});
