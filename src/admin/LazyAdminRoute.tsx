import { lazy, Suspense } from 'react';
import { AdminLoadBoundary } from './AdminLoadBoundary';

// The admin (and everything it imports) loads as its own chunk on /admin only.
// /admin is never prerendered; the SSR build merely needs this to import.
// The chunk is not precached by the service worker (vite.config.ts), so a
// failed load (e.g. a stale chunk name after a deploy) offers a reload.
const AdminRoute = lazy(() => import('./AdminRoute'));

export default function LazyAdminRoute() {
  return (
    <AdminLoadBoundary>
      <Suspense fallback={null}>
        <AdminRoute />
      </Suspense>
    </AdminLoadBoundary>
  );
}
