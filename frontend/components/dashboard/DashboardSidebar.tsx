'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, FileText, LayoutDashboard, ShieldCheck } from 'lucide-react';

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'EMI Requests', href: '/dashboard/emi-requests', icon: FileText },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Audit Logs', href: '/dashboard/audit-logs', icon: ShieldCheck },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-line bg-surface/95 px-6 py-8 hidden lg:flex flex-col">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">FairLens</p>
        <h2 className="text-xl font-semibold mt-2">Risk Console</h2>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                isActive ? 'bg-highlight/10 text-highlight' : 'text-muted hover:text-ink hover:bg-ink/5'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-8 text-xs text-muted">
        <p className="font-semibold">Need help?</p>
        <p className="mt-2">Contact risk-ops@fairlens.ai</p>
      </div>
    </aside>
  );
}
