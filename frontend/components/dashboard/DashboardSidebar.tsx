'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';

export default function DashboardSidebar() {
  const pathname = usePathname();
  const isActive = pathname === '/dashboard';

  return (
    <aside className="w-64 border-r border-line bg-surface/95 px-6 py-8 hidden lg:flex flex-col">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">FairLens</p>
        <h2 className="text-xl font-semibold mt-2">Bank Console</h2>
      </div>

      <Link
        href="/dashboard"
        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
          isActive ? 'bg-highlight/10 text-highlight' : 'text-muted hover:text-ink hover:bg-ink/5'
        }`}
      >
        <LayoutDashboard className="h-4 w-4" />
        Dashboard
      </Link>

      <div className="mt-auto pt-8 text-xs text-muted">
        <p className="font-semibold">Live mode</p>
        <p className="mt-2">Recent actions and manager check.</p>
      </div>
    </aside>
  );
}
