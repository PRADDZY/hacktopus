'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useStore } from '@/store/StoreContext';
import Button from '@/components/Button';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';

export default function WishlistPage() {
  const { wishlist, removeFromWishlist, addToCart, auth } = useStore();

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

  const handleMoveToCart = (productId: string) => {
    const product = wishlist.find(p => p.id === productId);
    if (product) {
      addToCart(product);
      removeFromWishlist(productId);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-black uppercase mb-8">My Wishlist</h1>

        {wishlist.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="w-24 h-24 mx-auto mb-4 text-gray-400" />
            <h2 className="text-2xl font-black uppercase mb-4">Your Wishlist is Empty</h2>
            <Link href="/" className="px-8 py-3 bg-primary text-white border-3 border-black shadow-brutal hover:-translate-y-1 transition-all font-bold uppercase inline-block">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wishlist.map((product) => (
              <div key={product.id} className="bg-white border-4 border-black shadow-brutal hover:-translate-y-2 transition-transform">
                <Link href={`/product/${product.id}`}>
                  <div className="relative h-64 border-b-4 border-black">
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                </Link>

                <div className="p-6 space-y-4">
                  <Link href={`/product/${product.id}`}>
                    <h3 className="text-xl font-black uppercase hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                  </Link>

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black">{formatPrice(product.price)}</span>
                    <span className="text-sm text-gray-500 line-through">
                      {formatPrice(product.originalPrice)}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleMoveToCart(product.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white border-3 border-black shadow-brutal hover:shadow-brutal-lg hover:-translate-y-1 transition-all font-bold uppercase"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add to Cart
                    </button>
                    <button
                      onClick={() => removeFromWishlist(product.id)}
                      className="p-3 border-3 border-black bg-white hover:bg-primary hover:text-white transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
