'use client';

import Image from 'next/image';
import Link from 'next/link';
import { product } from '@/data/product';
import { formatCurrency } from '@/lib/format';

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-4">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image src={product.images[0]} alt={product.name} fill className="object-cover" priority />
          </div>
        </div>

        <div className="card p-6 space-y-5">
          <p className="section-kicker">{product.brand}</p>
          <h1 className="text-3xl font-semibold">{product.name}</h1>
          <p className="text-sm text-muted">{product.description}</p>

          <div>
            <p className="text-xs text-muted">Price</p>
            <p className="text-3xl font-semibold">{formatCurrency(product.price)}</p>
          </div>

          <div className="rounded-xl border border-line p-4">
            <p className="text-sm font-semibold">Demo checkout</p>
            <p className="text-sm text-muted mt-2">
              Use FairLens at checkout to run statement-based credit evaluation.
            </p>
          </div>

          <Link href="/checkout" className="btn-primary w-full justify-center">
            Buy now
          </Link>
        </div>
      </div>
    </div>
  );
}
