'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useStore } from '@/store/StoreContext';

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthConfigured, signup } = useStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = searchParams.get('next') ?? '/';

  const handleSignup = async () => {
    setIsSubmitting(true);
    const success = await signup(name, email, password, phone, {
      role: 'user',
      returnTo: nextPath,
    });
    if (success && !isAuthConfigured) {
      router.push(nextPath);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="card p-8 space-y-4">
        <p className="section-kicker">Create account</p>
        <h1 className="section-title">Join FairLens</h1>
        <p className="text-sm text-muted">
          {isAuthConfigured
            ? 'Sign-up continues in secure hosted authentication.'
            : 'Create a profile to track EMI approvals and orders.'}
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            className="input-field"
            placeholder="Full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="input-field"
            placeholder="Phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <input
            className="input-field md:col-span-2"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="input-field md:col-span-2"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <Button onClick={() => void handleSignup()} disabled={isSubmitting}>
          Create account
        </Button>
      </div>
    </div>
  );
}

