'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/store/StoreContext';
import { Search, ShoppingCart, Bell, Menu, X, User, Heart, Package, MapPin, LogOut } from 'lucide-react';

export default function Navbar() {
  const { auth, cart, notifications, logout, wishlist } = useStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const unreadNotifications = notifications.filter(n => !n.read).length;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/product/mbp-m3-max-001?search=${searchQuery}`;
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b-4 border-black">
      {/* Top Bar */}
      <div className="bg-accent border-b-3 border-black py-2 px-4 text-center">
        <p className="text-sm font-bold uppercase">🔥 Limited Time Offer: No Cost EMI Available!</p>
      </div>

      {/* Main Navbar */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-12 h-12 bg-primary border-3 border-black rotate-45 group-hover:rotate-0 transition-transform duration-300 flex items-center justify-center">
              <span className="-rotate-45 group-hover:rotate-0 transition-transform duration-300 text-2xl font-black">∞</span>
            </div>
            <span className="text-2xl font-black uppercase hidden md:block">Premium</span>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl relative">
            <div className="w-full relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchSuggestions(e.target.value.length > 0);
                }}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                placeholder="Search MacBook Pro M3 Max..."
                className="w-full px-4 py-3 pr-12 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal transition-shadow"
              />
              <button
                type="submit"
                className="absolute right-0 top-0 h-full px-4 bg-secondary border-l-3 border-black hover:bg-primary transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>

            {/* Search Suggestions */}
            {showSearchSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border-3 border-black shadow-brutal-lg">
                <Link
                  href="/product/mbp-m3-max-001"
                  className="block px-4 py-3 hover:bg-accent border-b-2 border-black last:border-b-0 font-semibold"
                >
                  MacBook Pro 16-inch M3 Max
                </Link>
                <div className="px-4 py-3 text-sm text-gray-600 font-semibold">
                  Popular: M3 Max, 128GB RAM, Space Black
                </div>
              </div>
            )}
          </form>

          {/* Right Icons */}
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 border-2 border-black hover:bg-accent"
            >
              {showMobileMenu ? <X /> : <Menu />}
            </button>

            {/* Notifications */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 border-3 border-black hover:bg-accent transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-black">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white border-3 border-black shadow-brutal-lg max-h-96 overflow-y-auto">
                  <div className="p-4 border-b-2 border-black bg-accent">
                    <h3 className="font-black uppercase">Notifications</h3>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-600">No notifications</div>
                  ) : (
                    notifications.slice(0, 5).map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-4 border-b-2 border-black last:border-b-0 hover:bg-accent transition-colors ${!notif.read ? 'bg-yellow-50' : ''}`}
                      >
                        <p className="font-bold text-sm">{notif.title}</p>
                        <p className="text-sm text-gray-700">{notif.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{notif.timestamp}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Cart */}
            <Link
              href="/cart"
              className="relative p-2 border-3 border-black hover:bg-secondary transition-colors hidden md:block"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-black">
                  {cartItemsCount}
                </span>
              )}
            </Link>

            {/* Profile */}
            {auth.isAuthenticated ? (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 px-4 py-2 border-3 border-black hover:bg-accent transition-colors font-bold"
                >
                  <User className="w-5 h-5" />
                  <span className="hidden lg:block">{auth.user?.name}</span>
                </button>

                {showProfileMenu && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white border-3 border-black shadow-brutal-lg">
                    <Link
                      href="/profile"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent border-b-2 border-black font-semibold"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                    <Link
                      href="/orders"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent border-b-2 border-black font-semibold"
                    >
                      <Package className="w-4 h-4" />
                      Orders
                    </Link>
                    <Link
                      href="/wishlist"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent border-b-2 border-black font-semibold"
                    >
                      <Heart className="w-4 h-4" />
                      Wishlist
                    </Link>
                    <Link
                      href="/profile#addresses"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent border-b-2 border-black font-semibold"
                    >
                      <MapPin className="w-4 h-4" />
                      Addresses
                    </Link>
                    <button
                      onClick={logout}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-primary hover:text-white w-full font-semibold transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="px-6 py-2 bg-primary text-white border-3 border-black shadow-brutal hover:shadow-brutal-lg hover:-translate-y-1 transition-all font-bold uppercase hidden md:block"
              >
                Login
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Search */}
        <form onSubmit={handleSearch} className="md:hidden mt-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full px-4 py-3 pr-12 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal"
            />
            <button
              type="submit"
              className="absolute right-0 top-0 h-full px-4 bg-secondary border-l-3 border-black"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="md:hidden border-t-3 border-black bg-white">
          <div className="container mx-auto px-4 py-4">
            {auth.isAuthenticated ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent border-b-2 border-black font-semibold"
                  onClick={() => setShowMobileMenu(false)}
                >
                  <User className="w-4 h-4" />
                  Profile
                </Link>
                <Link
                  href="/cart"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent border-b-2 border-black font-semibold"
                  onClick={() => setShowMobileMenu(false)}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Cart {cartItemsCount > 0 && `(${cartItemsCount})`}
                </Link>
                <Link
                  href="/wishlist"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent border-b-2 border-black font-semibold"
                  onClick={() => setShowMobileMenu(false)}
                >
                  <Heart className="w-4 h-4" />
                  Wishlist
                </Link>
                <Link
                  href="/orders"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent border-b-2 border-black font-semibold"
                  onClick={() => setShowMobileMenu(false)}
                >
                  <Package className="w-4 h-4" />
                  Orders
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setShowMobileMenu(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-primary hover:text-white w-full font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="block px-4 py-3 bg-primary text-white text-center border-3 border-black shadow-brutal font-bold uppercase"
                onClick={() => setShowMobileMenu(false)}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
