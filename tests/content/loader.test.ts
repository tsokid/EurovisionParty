import { describe, it, expect } from 'vitest';
import { loadContent } from '@/content/_loader';

describe('content loader', () => {
  it('loads fixture EN', () => {
    const c = loadContent('_fixture', 'en');
    expect(c).not.toBeNull();
    expect(c?.meta.title).toBe('Fixture');
  });

  it('returns null for missing locale', () => {
    expect(loadContent('_fixture', 'el')).toBeNull();
  });
});
