'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useStore } from '@/store/StoreContext';
import Button from '@/components/Button';
import { Trash2, Heart, ShoppingBag } from 'lucide-react';

export default function CartPage() {
  const { cart, removeFromCart, updateCartQuantity, addToWishlist, auth } = useStore();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discount = cart.reduce(
    (sum, item) => sum + (item.product.originalPrice - item.product.price) * item.quantity,
    0
  );
  const deliveryCharges = subtotal > 100000 ? 0 : 500;
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + deliveryCharges + gst;

  const handleMoveToWishlist = (productId: string) => {
    const item = cart.find(i => i.product.id === productId);
    if (item) {
      addToWishlist(item.product);
      removeFromCart(productId);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-6 bg-accent border-4 border-black flex items-center justify-center">
            <ShoppingBag className="w-16 h-16" />
          </div>
          <h2 className="text-3xl font-black uppercase mb-4">Your Cart is Empty</h2>
          <p className="text-lg font-semibold text-gray-700 mb-6">
            Add items to get started
          </p>
          <Link href="/">
            <Button size="lg">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl md:text-5xl font-black uppercase mb-8">Shopping Cart</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item) => (
              <div
                key={item.product.id}
                className="bg-white border-4 border-black shadow-brutal p-6"
              >
                <div className="flex flex-col sm:flex-row gap-6">
                  {/* Product Image */}
                  <div className="relative w-full sm:w-40 h-40 border-3 border-black flex-shrink-0">
                    <Image
                      src={item.product.images[0]}
                      alt={item.product.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <Link
                        href={`/product/${item.product.id}`}
                        className="text-xl font-black uppercase hover:text-primary transition-colors"
                      >
                        {item.product.name}
                      </Link>
                      <p className="font-semibold text-gray-700">{item.product.brand}</p>
                    </div>

                    <div className="flex items-baseline gap-3">
                      <span className="text-2xl font-black">{formatPrice(item.product.price)}</span>
                      <span className="text-lg text-gray-500 line-through">
                        {formatPrice(item.product.originalPrice)}
                      </span>
                      <span className="px-2 py-1 bg-primary text-white border-2 border-black font-bold text-sm">
                        {item.product.discount}% OFF
                      </span>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-4">
                      <span className="font-bold">Quantity:</span>
                      <div className="flex items-center border-3 border-black">
                        <button
                          onClick={() =>
                            updateCartQuantity(item.product.id, Math.max(1, item.quantity - 1))
                          }
                          className="px-4 py-2 bg-white hover:bg-accent font-bold border-r-2 border-black"
                        >
                          -
                        </button>
                        <span className="px-6 py-2 font-bold">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          className="px-4 py-2 bg-white hover:bg-accent font-bold border-l-2 border-black"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => handleMoveToWishlist(item.product.id)}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-black bg-white hover:bg-accent font-bold text-sm uppercase transition-colors"
                      >
                        <Heart className="w-4 h-4" />
                        Save for Later
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-black bg-white hover:bg-primary hover:text-white font-bold text-sm uppercase transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Price Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 border-4 border-black bg-white shadow-brutal">
              <div className="p-6 bg-accent border-b-4 border-black">
                <h2 className="text-2xl font-black uppercase">Price Details</h2>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex justify-between font-semibold">
                  <span>Subtotal ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                <div className="flex justify-between font-semibold text-primary">
                  <span>Discount</span>
                  <span>- {formatPrice(discount)}</span>
                </div>

                <div className="flex justify-between font-semibold">
                  <span>Delivery Charges</span>
                  <span className={deliveryCharges === 0 ? 'text-primary' : ''}>
                    {deliveryCharges === 0 ? 'FREE' : formatPrice(deliveryCharges)}
                  </span>
                </div>

                <div className="flex justify-between font-semibold">
                  <span>GST (18%)</span>
                  <span>{formatPrice(gst)}</span>
                </div>

                <div className="border-t-3 border-black pt-4">
                  <div className="flex justify-between items-baseline mb-4">
                    <span className="text-xl font-black uppercase">Total</span>
                    <span className="text-3xl font-black">{formatPrice(total)}</span>
                  </div>
                  <p className="text-sm font-semibold text-primary mb-4">
                    You save {formatPrice(discount)} on this order!
                  </p>
                </div>

                {auth.isAuthenticated ? (
                  <Link href="/checkout">
                    <Button className="w-full" size="lg">
                      Proceed to Checkout
                    </Button>
                  </Link>
                ) : (
                  <Link href="/login">
                    <Button className="w-full" size="lg">
                      Login to Checkout
                    </Button>
                  </Link>
                )}

                <div className="p-4 bg-yellow-50 border-2 border-black">
                  <p className="font-bold text-sm text-center">
                    💳 No Cost EMI available from ₹29,158/month
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
