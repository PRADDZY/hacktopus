'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { product } from '@/data/product';
import { useStore } from '@/store/StoreContext';
import { Star, ShoppingCart, Heart, Zap, TrendingUp, Award } from 'lucide-react';
import Button from '@/components/Button';

export default function Home() {
  const { addToCart, addToWishlist } = useStore();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [timeLeft, setTimeLeft] = useState({
    hours: 23,
    minutes: 45,
    seconds: 30,
  });

  const banners = [
    {
      title: 'Unleash Ultimate Power',
      subtitle: 'MacBook Pro M3 Max',
      description: '128GB RAM • 8TB Storage • 40-Core GPU',
      image: product.images[0],
      bg: 'bg-primary',
    },
    {
      title: 'No Cost EMI Available',
      subtitle: 'Own Your Dream Machine',
      description: 'Starting at ₹29,158/month for 12 months',
      image: product.images[1],
      bg: 'bg-secondary',
    },
    {
      title: 'Limited Time Offer',
      subtitle: '₹50,000 OFF',
      description: 'Plus additional bank offers',
      image: product.images[2],
      bg: 'bg-accent',
    },
  ];

  // Banner auto-rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        let { hours, minutes, seconds } = prev;
        seconds--;
        if (seconds < 0) {
          seconds = 59;
          minutes--;
        }
        if (minutes < 0) {
          minutes = 59;
          hours--;
        }
        if (hours < 0) {
          hours = 23;
        }
        return { hours, minutes, seconds };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Banner Carousel */}
      <section className="relative h-[600px] bg-light overflow-hidden border-b-4 border-black">
        {/* Dotted grid background - already in body, so using light background */}
        {banners.map((banner, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentBanner ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="container mx-auto px-4 h-full flex items-center">
              <div className="grid md:grid-cols-2 gap-12 items-center w-full">
                <div className="space-y-6 animate-slide-in">
                  <div className="inline-block px-6 py-3 bg-black text-white border-3 border-black font-black uppercase text-sm">
                    ⚡ Flash Deal
                  </div>
                  <h1 className="text-5xl md:text-7xl font-black uppercase leading-tight text-black">
                    {banner.title}
                  </h1>
                  <h2 className="text-2xl md:text-3xl font-bold text-black">{banner.subtitle}</h2>
                  <p className="text-lg font-semibold text-gray-800">{banner.description}</p>
                  <div className="flex gap-4">
                    <Link href="/product/mbp-m3-max-001">
                      <Button size="lg">Shop Now</Button>
                    </Link>
                    <Button variant="outline" size="lg">
                      Learn More
                    </Button>
                  </div>
                </div>
                <div className="hidden md:block relative h-96">
                  <div className="relative w-full h-full border-4 border-black shadow-brutal-lg bg-white transform hover:rotate-2 transition-transform duration-300">
                    <Image
                      src={banner.image}
                      alt={banner.title}
                      fill
                      className="object-cover p-4"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Banner Indicators */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBanner(index)}
              className={`w-4 h-4 border-2 border-white transition-all ${
                index === currentBanner ? 'bg-white' : 'bg-transparent'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Flash Deal Section */}
      <section className="py-12 bg-white border-b-4 border-black">
        <div className="container mx-auto px-4">
          <div className="bg-accent border-4 border-black shadow-brutal-lg p-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-3xl md:text-4xl font-black uppercase mb-2">
                  ⚡ Flash Deal Ends In
                </h2>
                <p className="text-lg font-semibold text-gray-700">
                  Don't miss this exclusive offer!
                </p>
              </div>
              <div className="flex gap-4">
                {Object.entries(timeLeft).map(([unit, value]) => (
                  <div key={unit} className="text-center">
                    <div className="bg-black text-white border-3 border-black w-20 h-20 flex items-center justify-center shadow-brutal">
                      <span className="text-3xl font-black">{value.toString().padStart(2, '0')}</span>
                    </div>
                    <span className="block mt-2 font-bold uppercase text-sm">{unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Product Section */}
      <section className="py-16 container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-5xl md:text-6xl font-black uppercase mb-4">Featured Product</h2>
          <p className="text-xl font-semibold text-gray-700">The ultimate professional machine</p>
        </div>

        <div className="bg-white border-4 border-black shadow-brutal-lg overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Product Image */}
            <div className="relative h-96 md:h-auto border-r-0 md:border-r-4 border-black">
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                className="object-cover"
              />
              <button
                onClick={() => addToWishlist(product)}
                className="absolute top-4 right-4 p-3 bg-white border-3 border-black hover:bg-primary hover:text-white transition-colors"
              >
                <Heart className="w-6 h-6" />
              </button>
            </div>

            {/* Product Info */}
            <div className="p-8">
              <div className="mb-4">
                <span className="inline-block px-4 py-2 bg-accent border-2 border-black font-bold text-sm uppercase">
                  Premium Choice
                </span>
              </div>

              <h3 className="text-3xl font-black uppercase mb-2">{product.name}</h3>
              <p className="text-lg font-semibold text-gray-700 mb-4">{product.brand}</p>

              {/* Rating */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-1 bg-primary text-white px-3 py-1 border-2 border-black">
                  <span className="font-bold">{product.rating}</span>
                  <Star className="w-4 h-4 fill-current" />
                </div>
                <span className="font-semibold text-gray-600">
                  {product.reviewsCount.toLocaleString()} ratings
                </span>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black">{formatPrice(product.price)}</span>
                  <span className="text-xl text-gray-500 line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                  <span className="px-3 py-1 bg-primary text-white border-2 border-black font-bold">
                    {product.discount}% OFF
                  </span>
                </div>
                <p className="mt-2 font-semibold text-gray-700">
                  EMI starting at ₹29,158/month
                </p>
              </div>

              {/* Highlights */}
              <div className="mb-6 space-y-2">
                {product.highlights.slice(0, 4).map((highlight, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-primary font-bold">✓</span>
                    <span className="font-semibold text-sm">{highlight}</span>
                  </div>
                ))}
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/product/mbp-m3-max-001" className="flex-1">
                  <Button className="w-full" size="lg">
                    View Details
                  </Button>
                </Link>
                <Button
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    addToCart(product);
                    window.location.href = '/cart';
                  }}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Cart
                </Button>
              </div>

              {/* Offers Banner */}
              <div className="mt-6 p-4 bg-yellow-50 border-2 border-black">
                <p className="font-bold text-sm">
                  🎉 Bank Offer: ₹10,000 instant discount on HDFC Credit Cards
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Personalized Recommendations */}
      <section className="py-16 bg-secondary/10 border-y-4 border-black">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-black uppercase mb-12 text-center">
            Why Choose This?
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Best Deal */}
            <div className="bg-white border-4 border-black shadow-brutal p-6 hover:-translate-y-2 transition-transform">
              <div className="w-16 h-16 bg-primary border-3 border-black flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-black uppercase mb-3">Best Deal</h3>
              <p className="font-semibold text-gray-700 mb-4">
                Get the most powerful MacBook Pro at an unbeatable price with exclusive offers.
              </p>
              <Link href="/product/mbp-m3-max-001">
                <Button variant="outline" size="sm">
                  Shop Now
                </Button>
              </Link>
            </div>

            {/* Trending */}
            <div className="bg-white border-4 border-black shadow-brutal p-6 hover:-translate-y-2 transition-transform">
              <div className="w-16 h-16 bg-accent border-3 border-black flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black uppercase mb-3">Trending</h3>
              <p className="font-semibold text-gray-700 mb-4">
                Most wanted by professionals and creators. Join thousands of satisfied customers.
              </p>
              <Link href="/product/mbp-m3-max-001">
                <Button variant="outline" size="sm">
                  Learn More
                </Button>
              </Link>
            </div>

            {/* Award Winner */}
            <div className="bg-white border-4 border-black shadow-brutal p-6 hover:-translate-y-2 transition-transform">
              <div className="w-16 h-16 bg-secondary border-3 border-black flex items-center justify-center mb-4">
                <Award className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-black uppercase mb-3">Award Winner</h3>
              <p className="font-semibold text-gray-700 mb-4">
                Industry-leading performance and design. Recognized worldwide for excellence.
              </p>
              <Link href="/product/mbp-m3-max-001">
                <Button variant="outline" size="sm">
                  View Specs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-12 container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { text: 'Secure Payments', icon: '🔒' },
            { text: 'Free Delivery', icon: '🚚' },
            { text: '10-Day Returns', icon: '↩️' },
            { text: '24/7 Support', icon: '💬' },
          ].map((badge, index) => (
            <div
              key={index}
              className="bg-white border-3 border-black p-6 text-center shadow-brutal hover:shadow-brutal-lg transition-shadow"
            >
              <div className="text-4xl mb-2">{badge.icon}</div>
              <p className="font-black uppercase text-sm">{badge.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
