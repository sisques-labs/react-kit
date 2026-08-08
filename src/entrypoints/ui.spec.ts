import { describe, it, expect } from 'vitest';
import * as UiEntrypoint from './ui';

describe('ui entrypoint', () => {
  it('every runtime export is defined', () => {
    const entries = Object.entries(UiEntrypoint);
    expect(entries.length).toBeGreaterThan(0);
    for (const [name, value] of entries) {
      expect(value, `${name} should not be undefined`).toBeDefined();
    }
  });

  it('spot-checks a handful of components', () => {
    expect(UiEntrypoint.Button).toBeDefined();
    expect(UiEntrypoint.Input).toBeDefined();
    expect(UiEntrypoint.Dialog).toBeDefined();
    expect(UiEntrypoint.DataTable).toBeDefined();
    expect(UiEntrypoint.FormField).toBeDefined();
    expect(UiEntrypoint.cn).toBeDefined();
    expect(UiEntrypoint.buttonVariants).toBeDefined();
  });
});
