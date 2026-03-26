import Link from 'next/link';

export default function ShopFooter() {
  return (
    <footer className="border-t border-line bg-surface/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-8 text-sm text-muted">
        <p>FairLens Store</p>
        <div className="flex items-center gap-4">
          <Link href="/shop" className="link-muted">
            Shop
          </Link>
          <Link href="/checkout" className="link-muted">
            Checkout
          </Link>
          <Link href="/dashboard" className="link-muted">
            Bank Dashboard
          </Link>
        </div>
      </div>
    </footer>
  );
}
