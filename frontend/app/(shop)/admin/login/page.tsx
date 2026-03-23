'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useStore } from '@/store/StoreContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthConfigured, login } = useStore();

  const nextPath = searchParams.get('next') ?? '/dashboard';

  const handleAdminLogin = async () => {
    const success = await login('', '', { role: 'admin', returnTo: nextPath });
    if (success && !isAuthConfigured) {
      router.push(nextPath);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card p-8 space-y-4">
        <p className="section-kicker">Admin Access</p>
        <h1 className="section-title">Risk Console Sign In</h1>
        <p className="text-sm text-muted">
          Continue with admin authentication to access portfolio and audit routes.
        </p>
        <Button onClick={() => void handleAdminLogin()}>
          Continue as admin
        </Button>
      </div>
    </div>
  );
}

