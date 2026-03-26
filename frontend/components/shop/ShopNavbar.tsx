'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Shop', href: '/shop' },
  { label: 'Checkout', href: '/checkout' },
  { label: 'Bank Dashboard', href: '/dashboard' },
];

export default function ShopNavbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border border-line bg-white flex items-center justify-center text-ink font-semibold">
            FL
          </div>
          <div>
            <Link href="/shop" className="text-lg font-semibold">
              FairLens Store
            </Link>
            <div className="text-xs text-muted uppercase tracking-[0.2em]">Demo Checkout</div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-muted">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`transition ${isActive ? 'text-ink' : 'hover:text-ink'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link href="/login" className="btn-outline px-4 py-2 text-xs font-semibold">
          Switch Account
        </Link>
      </div>
    </header>
  );
}
