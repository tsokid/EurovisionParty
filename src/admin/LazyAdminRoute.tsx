import { lazy, Suspense } from 'react';

// The admin (and everything it imports) loads as its own chunk on /admin only.
// /admin is never prerendered; the SSR build merely needs this to import.
const AdminRoute = lazy(() => import('./AdminRoute'));

export default function LazyAdminRoute() {
  return (
    <Suspense fallback={null}>
      <AdminRoute />
    </Suspense>
  );
}
