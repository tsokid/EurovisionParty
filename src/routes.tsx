import { createBrowserRouter } from 'react-router-dom';
import { routes } from './routeConfig';

export const router = createBrowserRouter(routes);

/** Resolves once the router has loaded the lazy route modules of the first URL. */
export function routerReady(r: { state: { initialized: boolean }; subscribe: (fn: (s: { initialized: boolean }) => void) => () => void }): Promise<void> {
  if (r.state.initialized) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = r.subscribe((s) => {
      if (s.initialized) {
        stop();
        resolve();
      }
    });
  });
}
