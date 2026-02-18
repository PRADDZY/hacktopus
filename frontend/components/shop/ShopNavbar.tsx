'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { useStore } from '@/store/StoreContext';

const navItems = [
  { label: 'Product', href: '/product/mbp-m3-max-001' },
  { label: 'Checkout', href: '/checkout' },
  { label: 'Orders', href: '/orders' },
  { label: 'Support', href: '/support' },
];

export default function ShopNavbar() {
  const pathname = usePathname();
  const { cart } = useStore();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border border-line bg-white flex items-center justify-center text-ink font-semibold">
            FL
          </div>
          <div>
            <Link href="/" className="text-lg font-semibold">
              FairLens Store
            </Link>
            <div className="text-xs text-muted uppercase tracking-[0.2em]">Responsible BNPL</div>
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

        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="link-muted hidden sm:inline">
            Bank Dashboard
          </Link>
          <Link href="/cart" className="relative flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="h-5 w-5" />
            Cart
            {cartCount > 0 && (
              <span className="absolute -right-3 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
