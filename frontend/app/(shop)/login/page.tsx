'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useStore } from '@/store/StoreContext';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authProvider, isAuthConfigured, login, loginWithPhone } = useStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = searchParams.get('next') ?? '/';

  const handleEmailLogin = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const success = await login(email, password, { role: 'user', returnTo: nextPath });
      if (success && (!isAuthConfigured || authProvider === 'supabase')) {
        router.push(nextPath);
      }
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Unable to sign in';
      setError(message);
    }
    setIsSubmitting(false);
  };

  const handlePhoneLogin = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const success = await loginWithPhone(phone, otp, { role: 'user', returnTo: nextPath });
      if (success && (!isAuthConfigured || authProvider === 'supabase')) {
        router.push(nextPath);
      }
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Unable to verify phone OTP';
      setError(message);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-4xl grid gap-6 md:grid-cols-2">
      <div className="card p-6 space-y-4">
        <p className="section-kicker">Account</p>
        <h1 className="section-title">Sign in</h1>
        <p className="text-sm text-muted">
          {isAuthConfigured
            ? 'Continue using secure sign-in.'
            : 'Access your FairLens checkout profile.'}
        </p>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
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
        <Button onClick={() => void handleEmailLogin()} disabled={isSubmitting}>
          Continue with email
        </Button>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Phone login</h2>
        <p className="text-sm text-muted">
          {isAuthConfigured
            ? 'Phone and passkey sign-in are handled by the auth provider.'
            : 'Enter OTP 123456 in local mode.'}
        </p>
        <input
          className="input-field"
          placeholder="Phone number"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <input
          className="input-field"
          placeholder="OTP"
          value={otp}
          onChange={(event) => setOtp(event.target.value)}
        />
        <Button variant="outline" onClick={() => void handlePhoneLogin()} disabled={isSubmitting}>
          Continue with OTP
        </Button>
      </div>
    </div>
  );
}
