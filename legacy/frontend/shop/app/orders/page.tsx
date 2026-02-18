'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useStore } from '@/store/StoreContext';
import { Package, Truck, CheckCircle, XCircle } from 'lucide-react';

export default function OrdersPage() {
  const { orders, auth } = useStore();

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-3xl font-black uppercase mb-4">Please Login</h2>
          <Link href="/login" className="px-8 py-3 bg-primary text-white border-3 border-black shadow-brutal hover:-translate-y-1 transition-all font-bold uppercase inline-block">
            Login
          </Link>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'cancelled':
        return <XCircle className="w-6 h-6 text-red-600" />;
      case 'shipped':
        return <Truck className="w-6 h-6 text-blue-600" />;
      default:
        return <Package className="w-6 h-6 text-yellow-600" />;
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-black uppercase mb-8">My Orders</h1>

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-24 h-24 mx-auto mb-4 text-gray-400" />
            <h2 className="text-2xl font-black uppercase mb-4">No Orders Yet</h2>
            <Link href="/" className="px-8 py-3 bg-primary text-white border-3 border-black shadow-brutal hover:-translate-y-1 transition-all font-bold uppercase inline-block">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-white border-4 border-black shadow-brutal">
                <div className="p-4 bg-accent border-b-3 border-black flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <p className="font-bold text-sm">Order ID: {order.id}</p>
                    <p className="text-sm font-semibold">{new Date(order.orderDate).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(order.status)}
                    <span className="font-black uppercase">{order.status}</span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="relative w-full md:w-32 h-32 border-3 border-black flex-shrink-0">
                      <Image
                        src={order.product.images[0]}
                        alt={order.product.name}
                        fill
                        className="object-cover"
                      />
                    </div>

                    <div className="flex-1 space-y-2">
                      <h3 className="text-xl font-black uppercase">{order.product.name}</h3>
                      <p className="font-semibold text-gray-700">Quantity: {order.quantity}</p>
                      <p className="text-2xl font-black">{formatPrice(order.total)}</p>
                      {order.emiDetails && (
                        <div className="p-3 bg-primary/10 border-2 border-primary inline-block">
                          <p className="font-bold text-sm">
                            💳 EMI: {formatPrice(order.emiDetails.monthlyPayment)}/mo × {order.emiDetails.duration} months
                          </p>
                          <p className="text-xs font-semibold">Bank: {order.emiDetails.bank}</p>
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <Link href={`/product/${order.product.id}`} className="px-4 py-2 border-3 border-black bg-white hover:bg-accent font-bold uppercase transition-colors inline-block">
                        View Product
                      </Link>
                    </div>
                  </div>

                  {order.status === 'shipped' && order.deliveryDate && (
                    <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-600">
                      <p className="font-bold">
                        🚚 Expected Delivery: {new Date(order.deliveryDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
