import Link from 'next/link';

export default function ShopFooter() {
  return (
    <footer className="border-t border-line bg-surface/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-3">
        <div>
          <h4 className="text-lg font-semibold">FairLens</h4>
          <p className="text-sm text-muted mt-3">
            Inclusive BNPL eligibility built on cash-flow intelligence. Transparent decisions, real-time approvals.
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Shop</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/product/mbp-m3-max-001" className="link-muted">Product</Link></li>
            <li><Link href="/checkout" className="link-muted">Checkout</Link></li>
            <li><Link href="/orders" className="link-muted">Orders</Link></li>
            <li><Link href="/support" className="link-muted">Support</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Admin</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/dashboard" className="link-muted">Risk Dashboard</Link></li>
            <li><Link href="/dashboard/analytics" className="link-muted">Analytics</Link></li>
            <li><Link href="/dashboard/audit-logs" className="link-muted">Audit Logs</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">
        (c) 2026 FairLens. Built for responsible lending.
      </div>
    </footer>
  );
}
