import Link from 'next/link';

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card p-8 space-y-4 text-center">
        <p className="section-kicker">Order Status</p>
        <h1 className="section-title">Order Placed</h1>
        <p className="text-sm text-muted">
          Checkout completed successfully.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/shop" className="btn-outline">
            Back to shop
          </Link>
        </div>
      </div>
    </div>
  );
}
