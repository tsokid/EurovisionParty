// The game route is lazy (speed plan, 23 Nov 2026): main.tsx waits for the
// first URL's route modules before hydrating, or React would hydrate an empty
// outlet over the server-rendered page.
import { describe, it, expect } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import { routerReady } from '../../src/routes';
import { routes } from '../../src/routeConfig';

describe('routerReady', () => {
  it('waits for the lazy room route to load', async () => {
    const r = createMemoryRouter(routes, { initialEntries: ['/room/K3PW7X'] });
    await routerReady(r);
    expect(r.state.initialized).toBe(true);
    const leaf = r.state.matches[r.state.matches.length - 1].route;
    // Loaded: the lazy loader is gone and the page element is in place.
    expect(leaf.lazy).toBeUndefined();
    expect(leaf.element ?? leaf.Component).toBeTruthy();
  }, 60_000);

  it('resolves at once for a router that is ready', async () => {
    await expect(routerReady({ state: { initialized: true }, subscribe: () => () => {} })).resolves.toBeUndefined();
  });
});
