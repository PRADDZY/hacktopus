'use client';

import { useState } from 'react';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import { product } from '@/data/product';
import { useStore } from '@/store/StoreContext';
import { formatCurrency } from '@/lib/format';

export default function ProductPage() {
  const [activeImage, setActiveImage] = useState(0);
  const { addToCart, addToWishlist } = useStore();

  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="card p-4">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
              <Image
                src={product.images[activeImage]}
                alt={product.name}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {product.images.slice(0, 5).map((img, index) => (
              <button
                key={img}
                type="button"
                onClick={() => setActiveImage(index)}
                className={`relative aspect-square overflow-hidden rounded-xl border ${
                  activeImage === index ? 'border-accent' : 'border-line'
                }`}
              >
                <Image src={img} alt={product.name} fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="section-kicker">{product.brand}</p>
            <h1 className="text-4xl font-semibold mt-2">{product.name}</h1>
            <p className="text-sm text-muted mt-3">{product.description}</p>
          </div>
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">Price</p>
                <p className="text-3xl font-semibold">{formatCurrency(product.price)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted line-through">{formatCurrency(product.originalPrice)}</p>
                <p className="text-sm text-accent font-semibold">Save {product.discount}%</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => addToCart(product)}>Add to cart</Button>
              <Button variant="outline" onClick={() => addToWishlist(product)}>
                Save to wishlist
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.offers.map((offer) => (
                <span key={offer.id} className="badge">
                  {offer.title}
                </span>
              ))}
            </div>
          </div>
          <div className="card p-6 space-y-3">
            <p className="text-sm font-semibold">Key highlights</p>
            <ul className="space-y-2 text-sm text-muted">
              {product.highlights.slice(0, 6).map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-accent"></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-6">
          <h2 className="text-xl font-semibold">Specifications</h2>
          <div className="mt-4 space-y-3 text-sm">
            {Object.entries(product.specifications).map(([key, value]) => (
              <div key={key} className="flex justify-between border-b border-line/60 pb-2">
                <span className="text-muted">{key}</span>
                <span className="font-semibold text-ink">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-6">
            <p className="text-sm font-semibold">Warranty</p>
            <p className="text-sm text-muted mt-2">{product.warranty}</p>
          </div>
          <div className="card p-6">
            <p className="text-sm font-semibold">Return policy</p>
            <p className="text-sm text-muted mt-2">{product.returnPolicy}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
