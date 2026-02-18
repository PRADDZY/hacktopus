'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useStore } from '@/store/StoreContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithPhone } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  return (
    <div className="mx-auto max-w-4xl grid gap-6 md:grid-cols-2">
      <div className="card p-6 space-y-4">
        <p className="section-kicker">Account</p>
        <h1 className="section-title">Sign in</h1>
        <p className="text-sm text-muted">Access your FairLens checkout profile.</p>
        <div className="space-y-3">
          <input className="input-field" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input-field" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button
          onClick={() => {
            if (login(email, password)) router.push('/');
          }}
        >
          Continue with email
        </Button>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Phone login</h2>
        <p className="text-sm text-muted">Use OTP 123456 for demo access.</p>
        <input className="input-field" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="input-field" placeholder="OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
        <Button
          variant="outline"
          onClick={() => {
            if (loginWithPhone(phone, otp)) router.push('/');
          }}
        >
          Continue with OTP
        </Button>
      </div>
    </div>
  );
}
