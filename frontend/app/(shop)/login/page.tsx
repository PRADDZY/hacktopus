'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import {
  authenticateWithPasskey,
  isPasskeySupported,
  listPasskeys,
} from '@/lib/authClient';
import { useStore } from '@/store/StoreContext';

type LoginRole = 'user' | 'admin';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authProvider, isAuthConfigured, login, refreshAuth, hasRole, getAccessToken } = useStore();

  const roleFromQuery = searchParams.get('role');
  const initialRole: LoginRole = roleFromQuery === 'admin' ? 'admin' : 'user';

  const [selectedRole, setSelectedRole] = useState<LoginRole>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passkeyEnabled = isPasskeySupported();

  const nextPath = useMemo(() => {
    const preferredNext = searchParams.get('next');
    if (preferredNext) {
      return preferredNext;
    }
    return selectedRole === 'admin' ? '/dashboard' : '/shop';
  }, [searchParams, selectedRole]);

  const resolveTarget = (role: LoginRole): string => {
    const explicitNext = searchParams.get('next');
    if (explicitNext) {
      return explicitNext;
    }
    return role === 'admin' ? '/dashboard' : '/shop';
  };

  const ensureAdminAccess = async (): Promise<boolean> => {
    const token = await getAccessToken();
    const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
    if (!token || !apiBase) {
      return hasRole('admin');
    }

    try {
      const response = await fetch(`${apiBase}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        },
        cache: 'no-store'
      });
      if (!response.ok) {
        return false;
      }
      const payload = (await response.json().catch(() => null)) as
        | {
            roles?: unknown;
            data?: { roles?: unknown } | null;
          }
        | null;

      const roleSource = payload?.data?.roles ?? payload?.roles;
      if (Array.isArray(roleSource)) {
        return roleSource.some((role) => String(role).trim().toLowerCase() === 'admin');
      }
    } catch {
      return false;
    }

    return false;
  };

  const finishSupabaseLogin = async (role: LoginRole) => {
    if (authProvider === 'supabase') {
      await refreshAuth();
    }
    if (role === 'admin') {
      const isAdmin = await ensureAdminAccess();
      if (!isAdmin) {
        setError('This account does not have bank admin access.');
        return;
      }
    }
    router.push(resolveTarget(role));
  };

  const handlePasswordLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const success = await login(email, password, { role: selectedRole, returnTo: nextPath });
      if (success) {
        await finishSupabaseLogin(selectedRole);
      }
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Unable to sign in';
      setError(message);
    }
    setIsSubmitting(false);
  };

  const handlePasskeyLogin = async () => {
    if (!passkeyEnabled) {
      setError('Passkey is not supported on this device.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const factors = await listPasskeys();
      if (factors.length === 0) {
        throw new Error('No enrolled passkeys found. Enroll one from profile after password login.');
      }
      const preferred = factors.find((factor) => factor.status === 'verified') ?? factors[0];
      await authenticateWithPasskey(preferred.id);
      await finishSupabaseLogin(selectedRole);
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Unable to complete passkey sign-in';
      setError(message);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card p-6 space-y-5">
        <p className="section-kicker">Authentication</p>
        <h1 className="section-title">Sign in to FairLens</h1>
        <p className="text-sm text-muted">
          {isAuthConfigured
            ? 'Choose role, then continue with secure sign-in.'
            : 'Authentication is unavailable in this environment.'}
        </p>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        <div className="space-y-2">
          <p className="text-sm font-semibold">Sign in as</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                selectedRole === 'user' ? 'border-accent text-accent' : 'border-line text-muted'
              }`}
              onClick={() => setSelectedRole('user')}
            >
              User
            </button>
            <button
              type="button"
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                selectedRole === 'admin' ? 'border-accent text-accent' : 'border-line text-muted'
              }`}
              onClick={() => setSelectedRole('admin')}
            >
              Bank Admin
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <input
            className="input-field"
            placeholder="Email"
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
        <Button onClick={() => void handlePasswordLogin()} disabled={isSubmitting || !isAuthConfigured}>
          Continue with password
        </Button>

        <Button
          variant="outline"
          onClick={() => void handlePasskeyLogin()}
          disabled={isSubmitting || !isAuthConfigured || !passkeyEnabled}
        >
          Sign in with passkey
        </Button>
        <p className="text-xs text-muted">
          Passkey button verifies an enrolled factor for this account.
        </p>
      </div>
    </div>
  );
}
