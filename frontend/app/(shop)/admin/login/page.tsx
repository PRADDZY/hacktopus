'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useStore } from '@/store/StoreContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authProvider, isAuthConfigured, login } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = searchParams.get('next') ?? '/dashboard';

  const handleAdminLogin = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const success = await login(email, password, { role: 'admin', returnTo: nextPath });
      if (success && (!isAuthConfigured || authProvider === 'supabase')) {
        router.push(nextPath);
      }
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Unable to sign in as admin';
      setError(message);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card p-8 space-y-4">
        <p className="section-kicker">Admin Access</p>
        <h1 className="section-title">Risk Console Sign In</h1>
        <p className="text-sm text-muted">
          Continue with admin authentication to access portfolio and audit routes.
        </p>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {authProvider === 'supabase' && (
          <div className="space-y-3">
            <input
              className="input-field"
              placeholder="Admin email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="input-field"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        )}
        <Button onClick={() => void handleAdminLogin()} disabled={isSubmitting}>
          Continue as admin
        </Button>
      </div>
    </div>
  );
}
