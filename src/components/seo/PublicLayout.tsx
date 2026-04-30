import { Outlet } from 'react-router-dom';
import SiteHeader from './SiteHeader';

// Wraps every public-facing route with the persistent SiteHeader (logo +
// hamburger menu on mobile, full nav on desktop). Game/admin routes opt out
// because they own their full-screen UI and would clash with a sticky header.
export default function PublicLayout() {
  return (
    <>
      <SiteHeader />
      <Outlet />
    </>
  );
}
