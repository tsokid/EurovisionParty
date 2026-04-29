import { useEffect } from 'react';
import AdminLogin from './AdminLogin';
import AdminShell from './AdminShell';
import { useAdminAuth } from './useAdminAuth';

export default function AdminRoute() {
  const { status } = useAdminAuth();

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

  if (status === 'loading') return null;
  if (status === 'authenticated') return <AdminShell />;
  return <AdminLogin />;
}
