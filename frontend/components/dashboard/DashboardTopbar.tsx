'use client';

import Link from 'next/link';

export default function DashboardTopbar() {
  return (
    <div className="border-b border-line bg-surface/90 px-6 py-4 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Bank Admin</p>
        <h1 className="text-xl font-semibold">FairLens Dashboard</h1>
      </div>
      <Link href="/shop" className="btn-outline px-4 py-2 text-xs font-semibold">
        Open shop demo
      </Link>
    </div>
  );
}
