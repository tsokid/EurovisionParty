import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { lazy, Suspense } from 'react';
import { AdminLoadBoundary, ADMIN_LOAD_ERROR } from '../../src/admin/AdminLoadBoundary';

afterEach(() => {
  vi.restoreAllMocks();
});

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
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders its children when nothing fails', () => {
    render(<AdminLoadBoundary><p>admin</p></AdminLoadBoundary>);
    expect(screen.getByText('admin')).toBeTruthy();
  });
});
