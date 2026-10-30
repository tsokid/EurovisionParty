import { describe, it, expect } from 'vitest';
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
