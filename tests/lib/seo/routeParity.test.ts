import { describe, it, expect } from 'vitest';
import { routes } from '@/routeConfig';
import { PAGE_REGISTRY } from '@/lib/seo/registry';

describe('route / registry parity', () => {
  it('locale child routes match PAGE_REGISTRY en slugs', () => {
    const localeRoute = routes.find((r) => r.path === '/:locale');
    expect(localeRoute).toBeDefined();
    const fromRoutes = (localeRoute!.children ?? [])
      .filter((c) => c.path !== '*')
      .map((c) => (c.index ? '/' : '/' + c.path!.replace(/^\//, '')))
      .sort();
    const fromRegistry = PAGE_REGISTRY.map((p) => p.slugByLocale.en).sort();
    expect(fromRoutes).toEqual(fromRegistry);
  });
});
