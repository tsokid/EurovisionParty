import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { lazy, Suspense } from 'react';
import { AdminLoadBoundary, ADMIN_LOAD_ERROR, ADMIN_RUNTIME_ERROR } from '../../src/admin/AdminLoadBoundary';
import { isChunkLoadError, markChunkLoadError } from '../../src/admin/chunkLoadError';

afterEach(() => {
  vi.restoreAllMocks();
});

function Throws({ error }: { error: Error }): never {
  throw error;
}

describe('AdminLoadBoundary', () => {
  it('a failed admin chunk load shows a Reload button instead of a blank page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    const Broken = lazy(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/AdminRoute-old.js')));
    render(
      <AdminLoadBoundary reload={reload}>
        <Suspense fallback={null}>
          <Broken />
        </Suspense>
      </AdminLoadBoundary>,
    );
    expect(await screen.findByText(ADMIN_LOAD_ERROR)).toBeTruthy();
    expect(screen.queryByText(new RegExp(ADMIN_RUNTIME_ERROR))).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a lazy import tagged by markChunkLoadError counts as a chunk-load error whatever its message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Broken = lazy(() => Promise.reject(new Error('net::ERR_ABORTED 404')).catch((e: unknown) => { throw markChunkLoadError(e); }));
    render(
      <AdminLoadBoundary reload={() => {}}>
        <Suspense fallback={null}>
          <Broken />
        </Suspense>
      </AdminLoadBoundary>,
    );
    expect(await screen.findByText(ADMIN_LOAD_ERROR)).toBeTruthy();
  });

  it('a runtime error inside the admin says so, with its message and a Reload button', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    render(
      <AdminLoadBoundary reload={reload}>
        <Throws error={new TypeError("Cannot read properties of undefined (reading 'en')")} />
      </AdminLoadBoundary>,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(`${ADMIN_RUNTIME_ERROR}: Cannot read properties of undefined (reading 'en')`);
    expect(screen.queryByText(ADMIN_LOAD_ERROR)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('recognises the browsers’ chunk-load messages', () => {
    for (const m of [
      'Failed to fetch dynamically imported module: https://x/assets/a.js',
      'Importing a module script failed.',
      'error loading dynamically imported module: https://x/assets/a.js',
      'ChunkLoadError: Loading chunk 3 failed.',
    ]) expect(isChunkLoadError(new TypeError(m))).toBe(true);
    const named = new Error('Loading chunk 3 failed.');
    named.name = 'ChunkLoadError';
    expect(isChunkLoadError(named)).toBe(true);
    expect(isChunkLoadError(new TypeError('x is not a function'))).toBe(false);
    expect(isChunkLoadError(markChunkLoadError(new Error('anything')))).toBe(true);
  });

  it('renders its children when nothing fails', () => {
    render(<AdminLoadBoundary><p>admin</p></AdminLoadBoundary>);
    expect(screen.getByText('admin')).toBeTruthy();
  });
});
