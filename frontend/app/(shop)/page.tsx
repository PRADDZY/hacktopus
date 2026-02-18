'use client';

import Image from 'next/image';
import Link from 'next/link';
import { product } from '@/data/product';
import Button from '@/components/ui/Button';
import { useStore } from '@/store/StoreContext';
import { formatCurrency } from '@/lib/format';

const highlights = [
  'Cash-flow based approvals in minutes',
  'Transparent decisioning with explainable signals',
  'Built for gig workers and credit-invisible users',
];

const metrics = [
  { label: 'Average approval time', value: '42 sec' },
  { label: 'Default risk reduction', value: '24%' },
  { label: 'Portfolio transparency', value: 'Full trace' },
];

export default function HomePage() {
  const { addToCart } = useStore();

  return (
    <div className="mx-auto max-w-6xl space-y-16">
      <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
        <div className="space-y-6">
          <p className="section-kicker">FairLens Checkout</p>
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
            Responsible BNPL for premium purchases, grounded in real cash-flow signals.
          </h1>
          <p className="text-base text-muted">
            FairLens evaluates inflow stability, spending burden, and liquidity buffer to keep approvals fair and sustainable.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => addToCart(product)}>Add to cart</Button>
            <Link href={`/product/${product.id}`} className="btn-outline">
              View product details
            </Link>
          </div>
          <div className="flex flex-wrap gap-4 pt-2">
            {highlights.map((item) => (
              <span key={item} className="pill">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line/70">
            <Image src={product.images[0]} alt={product.name} fill className="object-cover" priority />
          </div>
          <div className="mt-6 space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-muted">Featured</p>
            <h2 className="text-2xl font-semibold">{product.name}</h2>
            <p className="text-sm text-muted">{product.description}</p>
            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-xs text-muted">Starting at</p>
                <p className="text-2xl font-semibold">{formatCurrency(product.price)}</p>
              </div>
              <Link href="/checkout" className="btn-primary">
                Start EMI
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {metrics.map((metric, index) => (
          <div key={metric.label} className="card p-6 border-l-2" style={{ borderColor: index === 1 ? 'rgb(var(--color-highlight))' : 'rgb(var(--color-accent))' }}>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{metric.label}</p>
            <p className="text-3xl font-semibold mt-4">{metric.value}</p>
            <p className="text-sm text-muted mt-2">Live model + portfolio telemetry</p>
          </div>
        ))}
      </section>

      <section className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] items-start">
        <div className="card p-8 space-y-4">
          <p className="section-kicker">Why it works</p>
          <h3 className="text-2xl font-semibold">Explainable underwriting for every checkout</h3>
          <p className="text-sm text-muted">
            FairLens replaces traditional credit scores with forward-looking cash-flow insights. Every decision is
            logged, explainable, and auditable for lenders.
          </p>
          <ul className="space-y-3 text-sm text-muted">
            {product.highlights.slice(0, 5).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-accent"></span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4">
          {product.offers.map((offer) => (
            <div key={offer.id} className="card p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">{offer.title}</p>
              <p className="text-base font-semibold mt-2">{offer.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
