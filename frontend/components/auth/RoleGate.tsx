'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useStore } from '@/store/StoreContext';

type RoleGateProps = {
  requiredRole: 'user' | 'admin';
  children: React.ReactNode;
};

export default function RoleGate({ requiredRole, children }: RoleGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { auth, hasRole, isAuthConfigured, isAuthReady } = useStore();

  useEffect(() => {
    if (!isAuthConfigured || !isAuthReady || auth.isAuthenticated) {
      return;
    }

    const nextPath = encodeURIComponent(pathname || '/');
    const loginPath = `/login?role=${requiredRole}&next=${nextPath}`;
    router.replace(loginPath);
  }, [auth.isAuthenticated, isAuthConfigured, isAuthReady, pathname, requiredRole, router]);

  if (!isAuthConfigured) {
    return <>{children}</>;
  }

  if (!isAuthReady || !auth.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="card p-8 text-center max-w-md">
          <p className="section-kicker">Authentication</p>
          <h1 className="section-title">Checking access</h1>
          <p className="text-sm text-muted mt-3">
            Redirecting to the sign-in route...
          </p>
        </div>
      </div>
    );
  }

  if (requiredRole === 'admin' && !hasRole('admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="card p-8 text-center max-w-md">
          <p className="section-kicker">Access denied</p>
          <h1 className="section-title">Admin role required</h1>
          <p className="text-sm text-muted mt-3">
            Your account is signed in but does not have admin privileges.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-flex">
            Back to store
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
