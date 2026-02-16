'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { product } from '@/data/product';
import { useStore } from '@/store/StoreContext';
import Button from '@/components/Button';
import { Star, Heart, ShoppingCart, Share2, Truck, Shield, RotateCcw, Zap, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ProductDetail() {
  const { addToCart, addToWishlist, wishlist, auth } = useStore();
  const [selectedImage, setSelectedImage] = useState(0);
  const [pincode, setPincode] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const isInWishlist = wishlist.some(p => p.id === product.id);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const checkDelivery = () => {
    if (pincode.length === 6) {
      setDeliveryInfo('Delivery available in 2-3 business days');
    } else {
      setDeliveryInfo('Please enter a valid 6-digit pincode');
    }
  };

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
  };

  const handleBuyNow = () => {
    handleAddToCart();
    window.location.href = '/checkout';
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <div className="mb-6 font-semibold text-sm">
          <span className="text-gray-600">Home</span>
          <span className="mx-2">/</span>
          <span className="text-gray-600">Laptops</span>
          <span className="mx-2">/</span>
          <span>{product.name}</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative h-[500px] bg-white border-4 border-black shadow-brutal-lg overflow-hidden group">
              <Image
                src={product.images[selectedImage]}
                alt={product.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              
              {/* Image Navigation Arrows */}
              <button
                onClick={() => setSelectedImage(prev => (prev - 1 + product.images.length) % product.images.length)}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white border-3 border-black hover:bg-primary hover:text-white transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => setSelectedImage(prev => (prev + 1) % product.images.length)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white border-3 border-black hover:bg-primary hover:text-white transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Zoom Indicator */}
              <div className="absolute bottom-4 right-4 px-4 py-2 bg-black text-white border-2 border-white font-bold text-sm">
                🔍 Hover to Zoom
              </div>
            </div>

            {/* Thumbnail Gallery */}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`flex-shrink-0 w-24 h-24 border-3 ${
                    selectedImage === index ? 'border-primary shadow-brutal' : 'border-black'
                  } overflow-hidden hover:border-primary transition-colors`}
                >
                  <Image
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="inline-block px-4 py-2 bg-accent border-2 border-black font-bold text-sm uppercase mb-3">
                {product.brand}
              </div>
              <h1 className="text-4xl font-black uppercase mb-3">{product.name}</h1>
              
              {/* Rating */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1 bg-primary text-white px-3 py-2 border-2 border-black">
                  <span className="font-bold text-lg">{product.rating}</span>
                  <Star className="w-5 h-5 fill-current" />
                </div>
                <span className="font-semibold text-gray-600">
                  {product.reviewsCount.toLocaleString()} Ratings & Reviews
                </span>
              </div>
            </div>

            {/* Price */}
            <div className="p-6 bg-white border-4 border-black shadow-brutal">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-5xl font-black">{formatPrice(product.price)}</span>
                <span className="text-2xl text-gray-500 line-through">
                  {formatPrice(product.originalPrice)}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 bg-primary text-white border-2 border-black font-bold text-lg">
                  {product.discount}% OFF
                </span>
                <span className="font-semibold text-gray-700">
                  You save {formatPrice(product.originalPrice - product.price)}
                </span>
              </div>
              <p className="font-bold text-lg">
                💳 EMI starting at <span className="text-primary">₹29,158/month</span>
              </p>
            </div>

            {/* Offers */}
            <div className="border-4 border-black bg-yellow-50">
              <div className="p-4 bg-accent border-b-2 border-black">
                <h3 className="font-black uppercase">Available Offers</h3>
              </div>
              <div className="p-4 space-y-3">
                {product.offers.map((offer) => (
                  <div key={offer.id} className="flex items-start gap-3">
                    <div className="mt-1">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold">{offer.title}</p>
                      <p className="text-sm text-gray-700">{offer.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Check */}
            <div className="border-4 border-black bg-white p-6">
              <h3 className="font-black uppercase mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Delivery Options
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter Pincode"
                  className="flex-1 px-4 py-3 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal"
                  maxLength={6}
                />
                <Button onClick={checkDelivery} size="md">
                  Check
                </Button>
              </div>
              {deliveryInfo && (
                <p className="mt-3 font-semibold text-primary">{deliveryInfo}</p>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center gap-4">
              <span className="font-bold">Quantity:</span>
              <div className="flex items-center border-3 border-black">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 bg-white hover:bg-accent font-bold border-r-2 border-black"
                >
                  -
                </button>
                <span className="px-6 py-2 font-bold">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2 bg-white hover:bg-accent font-bold border-l-2 border-black"
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={handleAddToCart}
                className="flex-1 flex items-center justify-center gap-2"
                size="lg"
              >
                <ShoppingCart className="w-5 h-5" />
                Add to Cart
              </Button>
              <Button
                onClick={handleBuyNow}
                variant="secondary"
                className="flex-1"
                size="lg"
              >
                Buy Now
              </Button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => addToWishlist(product)}
                disabled={isInWishlist}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 border-3 border-black font-bold uppercase ${
                  isInWishlist ? 'bg-gray-200' : 'bg-white hover:bg-primary hover:text-white'
                } transition-colors`}
              >
                <Heart className={`w-5 h-5 ${isInWishlist ? 'fill-current text-primary' : ''}`} />
                {isInWishlist ? 'In Wishlist' : 'Add to Wishlist'}
              </button>
              <button className="p-3 border-3 border-black bg-white hover:bg-accent transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 border-2 border-black text-center">
                <Shield className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="font-bold text-xs">1 Year Warranty</p>
              </div>
              <div className="p-4 border-2 border-black text-center">
                <RotateCcw className="w-6 h-6 mx-auto mb-2 text-secondary" />
                <p className="font-bold text-xs">10 Day Returns</p>
              </div>
              <div className="p-4 border-2 border-black text-center">
                <Truck className="w-6 h-6 mx-auto mb-2 text-accent" />
                <p className="font-bold text-xs">Free Delivery</p>
              </div>
            </div>
          </div>
        </div>

        {/* Highlights */}
        <div className="mb-12 p-8 bg-white border-4 border-black shadow-brutal">
          <h2 className="text-3xl font-black uppercase mb-6">Key Highlights</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {product.highlights.map((highlight, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="text-2xl text-primary font-bold">✓</span>
                <span className="font-semibold">{highlight}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Specifications */}
        <div className="mb-12 border-4 border-black bg-white">
          <div className="p-6 bg-secondary border-b-4 border-black">
            <h2 className="text-3xl font-black uppercase text-white">Technical Specifications</h2>
          </div>
          <div className="p-6">
            <table className="w-full">
              <tbody>
                {Object.entries(product.specifications).map(([key, value], index) => (
                  <tr
                    key={key}
                    className={`border-b-2 border-black ${index % 2 === 0 ? 'bg-gray-50' : ''}`}
                  >
                    <td className="py-4 px-4 font-bold w-1/3">{key}</td>
                    <td className="py-4 px-4 font-semibold">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mb-12 border-4 border-black bg-white">
          <div className="p-6 bg-accent border-b-4 border-black">
            <h2 className="text-3xl font-black uppercase">Ratings & Reviews</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-8 mb-8">
              <div className="text-center p-8 border-3 border-black bg-primary text-white">
                <div className="text-6xl font-black mb-2">{product.rating}</div>
                <div className="flex justify-center mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.floor(product.rating) ? 'fill-current' : ''
                      }`}
                    />
                  ))}
                </div>
                <p className="font-bold">{product.reviewsCount.toLocaleString()} ratings</p>
              </div>
              
              <div className="flex-1 space-y-3">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const percentage = rating >= 4 ? 80 - (5 - rating) * 15 : (rating * 5);
                  return (
                    <div key={rating} className="flex items-center gap-3">
                      <span className="font-bold w-8">{rating}★</span>
                      <div className="flex-1 h-6 border-2 border-black bg-white overflow-hidden">
                        <div
                          className="h-full bg-primary border-r-2 border-black"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="font-semibold w-12">{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sample Reviews */}
            <div className="space-y-4">
              {[
                {
                  name: 'Rahul Sharma',
                  rating: 5,
                  comment: 'Absolutely incredible machine! The M3 Max chip handles everything I throw at it. Perfect for video editing and 3D rendering.',
                  date: '2 days ago',
                },
                {
                  name: 'Priya Patel',
                  rating: 5,
                  comment: 'Worth every penny! The display is stunning and the battery life is amazing. No Cost EMI made it affordable.',
                  date: '1 week ago',
                },
                {
                  name: 'Arjun Mehta',
                  rating: 4,
                  comment: 'Great laptop but quite expensive. Performance is top-notch though. Delivery was quick and packaging was secure.',
                  date: '2 weeks ago',
                },
              ].map((review, index) => (
                <div
                  key={index}
                  className="p-6 border-3 border-black hover:shadow-brutal transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-black text-lg">{review.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= review.rating ? 'fill-current text-primary' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-600">{review.date}</span>
                      </div>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-700">{review.comment}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Warranty & Returns */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="p-6 border-4 border-black bg-white">
            <h3 className="text-2xl font-black uppercase mb-4">Warranty Information</h3>
            <p className="font-semibold text-gray-700">{product.warranty}</p>
          </div>
          <div className="p-6 border-4 border-black bg-white">
            <h3 className="text-2xl font-black uppercase mb-4">Return Policy</h3>
            <p className="font-semibold text-gray-700">{product.returnPolicy}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
