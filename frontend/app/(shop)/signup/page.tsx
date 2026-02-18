'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useStore } from '@/store/StoreContext';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <div className="mx-auto max-w-3xl">
      <div className="card p-8 space-y-4">
        <p className="section-kicker">Create account</p>
        <h1 className="section-title">Join FairLens</h1>
        <p className="text-sm text-muted">Create a profile to track EMI approvals and orders.</p>
        <div className="grid md:grid-cols-2 gap-3">
          <input className="input-field" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input-field" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="input-field md:col-span-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input-field md:col-span-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button
          onClick={() => {
            if (signup(name, email, password, phone)) router.push('/');
          }}
        >
          Create account
        </Button>
      </div>
    </div>
  );
}
