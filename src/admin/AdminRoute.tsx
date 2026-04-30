import { useEffect } from 'react';
import AdminLogin from './AdminLogin';
import AdminShell from './AdminShell';
import { useAdminAuth } from './useAdminAuth';

export default function AdminRoute() {
  // Single source of truth — passed down to children so we don't mount the
  // hook (and its supabase listeners) more than once.
  const auth = useAdminAuth();

  useEffect(() => {
    document.title = 'admin';
    let m = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const created = !m;
    if (!m) {
      m = document.createElement('meta');
      m.name = 'robots';
      document.head.appendChild(m);
    }
    m.content = 'noindex,nofollow';
    return () => {
      if (m && created) m.remove();
      else if (m) m.content = '';
    };
  }, []);

  // Don't render a blank screen on first mount — show the login form
  // immediately and let the auth check upgrade us to AdminShell when it
  // resolves. This also fixes a hang where sibling hooks competing for the
  // Supabase auth lock leave `getSession()` permanently pending.
  if (auth.status === 'authenticated') return <AdminShell auth={auth} />;
  return <AdminLogin auth={auth} />;
}
