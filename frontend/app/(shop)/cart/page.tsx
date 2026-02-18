'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useStore } from '@/store/StoreContext';
import { formatCurrency } from '@/lib/format';

export default function CartPage() {
  const { cart, updateCartQuantity, removeFromCart } = useStore();

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="card p-10 text-center">
          <p className="section-kicker">Your cart</p>
          <h1 className="section-title">Cart is empty</h1>
          <p className="text-sm text-muted mt-3">Explore the latest premium tech and start an EMI eligibility check.</p>
          <Link href="/" className="btn-primary mt-6 inline-flex">
            Browse product
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-4">
        {cart.map((item) => (
          <div key={item.product.id} className="card p-6 flex flex-col md:flex-row gap-6">
            <div className="relative h-32 w-40 overflow-hidden rounded-xl">
              <Image src={item.product.images[0]} alt={item.product.name} fill className="object-cover" />
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-lg font-semibold">{item.product.name}</h2>
              <p className="text-sm text-muted">{item.product.brand}</p>
              <div className="flex items-center gap-3">
                <button
                  className="btn-ghost"
                  onClick={() => updateCartQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                >
                  -
                </button>
                <span className="text-sm font-semibold">{item.quantity}</span>
                <button
                  className="btn-ghost"
                  onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex flex-col items-end justify-between">
              <p className="text-lg font-semibold">{formatCurrency(item.product.price * item.quantity)}</p>
              <button className="text-sm text-rose-600" onClick={() => removeFromCart(item.product.id)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6 h-fit space-y-4">
        <h3 className="text-lg font-semibold">Order summary</h3>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Subtotal</span>
          <span className="font-semibold">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Delivery</span>
          <span className="font-semibold">{subtotal > 100000 ? 'Free' : formatCurrency(500)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">GST (18%)</span>
          <span className="font-semibold">{formatCurrency(Math.round(subtotal * 0.18))}</span>
        </div>
        <div className="border-t border-line pt-4 flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatCurrency(subtotal + (subtotal > 100000 ? 0 : 500) + Math.round(subtotal * 0.18))}</span>
        </div>
        <Link href="/checkout" className="btn-primary w-full text-center">
          Proceed to checkout
        </Link>
      </div>
    </div>
  );
}
