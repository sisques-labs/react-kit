import { describe, it, expect, vi, afterEach } from 'vitest';
import { logHttpError } from './http-logger';

describe('logHttpError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the error under the [http-error] tag', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logHttpError({ status: 500, url: '/plants', durationMs: 42 });

    expect(errorSpy).toHaveBeenCalledWith(
      '[http-error]',
      JSON.stringify({ status: 500, url: '/plants', durationMs: 42 }),
    );
  });

  it('serializes a log entry with no status (e.g. a network error)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logHttpError({ url: '/plants', durationMs: 10 });

    expect(errorSpy).toHaveBeenCalledWith(
      '[http-error]',
      JSON.stringify({ url: '/plants', durationMs: 10 }),
    );
  });
});
