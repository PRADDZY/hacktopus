'use client';

import Button from '@/components/ui/Button';
import { useStore } from '@/store/StoreContext';

export default function ProfilePage() {
  const { auth, logout } = useStore();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="section-kicker">Account</p>
        <h1 className="section-title">Profile</h1>
      </div>
      <div className="card p-6 space-y-4">
        <p className="text-sm text-muted">Signed in as</p>
        <h2 className="text-xl font-semibold">{auth.user?.name ?? 'Guest'}</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted">Email</p>
            <p className="font-semibold">{auth.user?.email ?? 'Not provided'}</p>
          </div>
          <div>
            <p className="text-muted">Phone</p>
            <p className="font-semibold">{auth.user?.phone ?? 'Not provided'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Edit profile</Button>
          <Button onClick={logout}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}
