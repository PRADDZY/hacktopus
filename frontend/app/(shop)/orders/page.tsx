'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useStore } from '@/store/StoreContext';
import { formatCurrency } from '@/lib/format';

export default function OrdersPage() {
  const { orders } = useStore();

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="card p-10 text-center">
          <p className="section-kicker">Order history</p>
          <h1 className="section-title">No orders yet</h1>
          <p className="text-sm text-muted mt-3">Complete your first EMI checkout to see it here.</p>
          <Link href="/" className="btn-primary mt-6 inline-flex">
            Start shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="section-kicker">Order history</p>
        <h1 className="section-title">Your orders</h1>
      </div>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="card p-6 flex flex-col md:flex-row gap-6">
            <div className="relative h-28 w-36 overflow-hidden rounded-xl">
              <Image src={order.product.images[0]} alt={order.product.name} fill className="object-cover" />
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-lg font-semibold">{order.product.name}</h2>
              <p className="text-sm text-muted">Order ID: {order.id}</p>
              <p className="text-sm text-muted">Placed on {new Date(order.orderDate).toLocaleDateString()}</p>
              <p className="text-sm text-muted">Status: {order.status}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">{formatCurrency(order.total)}</p>
              <p className="text-sm text-muted">{order.paymentMethod}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
