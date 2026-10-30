import { describe, it, expect, vi } from 'vitest';
import { bootMode } from '@/lib/bootMode';

describe('bootMode', () => {
  it('hydrates when data-prerendered="true"', () => {
    const el = document.createElement('div');
    el.setAttribute('data-prerendered', 'true');
    expect(bootMode(el)).toBe('hydrate');
  });
  it('renders otherwise', () => {
    const el = document.createElement('div');
    expect(bootMode(el)).toBe('render');
    el.setAttribute('data-prerendered', 'false');
    expect(bootMode(el)).toBe('render');
  });
});

describe('startApp (T5)', () => {
  it('mounts in boot mode after prepare resolves', async () => {
    const { startApp } = await import('@/lib/bootMode');
    const el = document.createElement('div');
    el.setAttribute('data-prerendered', 'true');
    const mount = vi.fn();
    await startApp(el, async () => {}, mount);
    expect(mount).toHaveBeenCalledExactlyOnceWith('hydrate');
  });

  it('logs and still renders client-side when prepare rejects', async () => {
    const { startApp } = await import('@/lib/bootMode');
    const el = document.createElement('div');
    el.setAttribute('data-prerendered', 'true');
    const mount = vi.fn();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(startApp(el, () => Promise.reject(new Error('i18n down')), mount)).resolves.toBeUndefined();
    expect(mount).toHaveBeenCalledExactlyOnceWith('render');
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('falls back to render when hydrating throws', async () => {
    const { startApp } = await import('@/lib/bootMode');
    const el = document.createElement('div');
    el.setAttribute('data-prerendered', 'true');
    const mount = vi.fn((mode: string) => {
      if (mode === 'hydrate') throw new Error('boom');
    });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await startApp(el, async () => {}, mount);
    expect(mount.mock.calls).toEqual([['hydrate'], ['render']]);
    err.mockRestore();
  });
});
