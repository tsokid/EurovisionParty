import { describe, it, expect } from 'vitest';
import { routes, DYNAMIC_ROUTE_PATHS } from '@/routeConfig';
import { PAGE_REGISTRY } from '@/lib/seo/registry';

const localeChildren = () => routes.find((r) => r.path === '/:locale')?.children ?? [];

describe('route / registry parity', () => {
  it('static locale child routes match PAGE_REGISTRY en slugs (dynamic patterns excluded)', () => {
    const localeRoute = routes.find((r) => r.path === '/:locale');
    expect(localeRoute).toBeDefined();
    const fromRoutes = localeChildren()
      .filter((c) => c.path !== '*' && !DYNAMIC_ROUTE_PATHS.includes(c.path ?? ''))
      .map((c) => (c.index ? '/' : '/' + c.path!.replace(/^\//, '')))
      .sort();
    const fromRegistry = PAGE_REGISTRY.map((p) => p.slugByLocale.en).sort();
    expect(fromRoutes).toEqual(fromRegistry);
  });

  it('every excluded dynamic pattern is a real locale child route', () => {
    const paths = localeChildren().map((c) => c.path);
    for (const p of DYNAMIC_ROUTE_PATHS) expect(paths, p).toContain(p);
  });
});
