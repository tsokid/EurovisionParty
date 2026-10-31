// A MemoryRouter that can sit inside the admin's own router: the router
// contexts are reset first, so nothing inside navigates (or reads) the admin.
// Used by the page preview and the rich text field's live preview.
import type { ReactNode } from 'react';
import {
  MemoryRouter,
  UNSAFE_DataRouterContext,
  UNSAFE_DataRouterStateContext,
  UNSAFE_LocationContext,
  UNSAFE_RouteContext,
} from 'react-router-dom';

const ROOT_ROUTE_CONTEXT = { outlet: null, matches: [], isDataRoute: false };

/** Fresh router contexts: the pane's MemoryRouter must not nest in (or drive) the admin's router. */
export function DetachedMemoryRouter({ path, children }: { path: string; children: ReactNode }) {
  return (
    <UNSAFE_DataRouterContext.Provider value={null}>
      <UNSAFE_DataRouterStateContext.Provider value={null}>
        <UNSAFE_LocationContext.Provider value={null as never}>
          <UNSAFE_RouteContext.Provider value={ROOT_ROUTE_CONTEXT}>
            <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
          </UNSAFE_RouteContext.Provider>
        </UNSAFE_LocationContext.Provider>
      </UNSAFE_DataRouterStateContext.Provider>
    </UNSAFE_DataRouterContext.Provider>
  );
}

