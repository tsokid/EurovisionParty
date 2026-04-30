import { Outlet } from 'react-router-dom';

// Kept as a no-op for backward compatibility. LocaleRoot now owns the
// SiteHeader and locale-aware chrome for the public surface.
export default function PublicLayout() {
  return <Outlet />;
}
