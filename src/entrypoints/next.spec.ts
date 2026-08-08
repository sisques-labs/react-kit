import { describe, it, expect } from 'vitest';
import * as NextEntrypoint from './next';

describe('next entrypoint', () => {
  it('every runtime export is defined', () => {
    const entries = Object.entries(NextEntrypoint);
    expect(entries.length).toBeGreaterThan(0);
    for (const [name, value] of entries) {
      expect(value, `${name} should not be undefined`).toBeDefined();
    }
  });

  it('spot-checks proxy helpers and the image-dependent components', () => {
    expect(NextEntrypoint.proxyTo).toBeDefined();
    expect(NextEntrypoint.internalUrl).toBeDefined();
    expect(NextEntrypoint.PhotoGrid).toBeDefined();
    expect(NextEntrypoint.Lightbox).toBeDefined();
    expect(NextEntrypoint.PhotoPicker).toBeDefined();
    expect(NextEntrypoint.PlantCard).toBeDefined();
    expect(NextEntrypoint.MediaCard).toBeDefined();
  });
});
