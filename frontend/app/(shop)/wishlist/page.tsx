'use client';

import Image from 'next/image';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { useStore } from '@/store/StoreContext';
import { formatCurrency } from '@/lib/format';

export default function WishlistPage() {
  const { wishlist, addToCart, removeFromWishlist } = useStore();

  if (wishlist.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="card p-10 text-center">
          <p className="section-kicker">Wishlist</p>
          <h1 className="section-title">Nothing saved yet</h1>
          <p className="text-sm text-muted mt-3">Save products to compare and apply for EMI later.</p>
          <Link href="/" className="btn-primary mt-6 inline-flex">
            Explore product
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="section-kicker">Wishlist</p>
        <h1 className="section-title">Saved items</h1>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {wishlist.map((item) => (
          <div key={item.id} className="card p-6 space-y-4">
            <div className="relative h-40 w-full overflow-hidden rounded-xl">
              <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{item.name}</h2>
              <p className="text-sm text-muted">{formatCurrency(item.price)}</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => addToCart(item)}>Add to cart</Button>
              <Button variant="outline" onClick={() => removeFromWishlist(item.id)}>Remove</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
