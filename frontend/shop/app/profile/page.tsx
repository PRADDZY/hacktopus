'use client';

import React from 'react';
import Link from 'next/link';
import { useStore } from '@/store/StoreContext';
import { User, Package, Heart, MapPin, Bell, Settings, LogOut } from 'lucide-react';
import Button from '@/components/Button';

export default function ProfilePage() {
  const { auth, logout, orders, wishlist } = useStore();

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

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-black uppercase mb-8">My Profile</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white border-4 border-black shadow-brutal p-8 text-center">
              <div className="w-32 h-32 mx-auto bg-accent border-4 border-black flex items-center justify-center mb-4">
                <User className="w-16 h-16" />
              </div>
              <h2 className="text-2xl font-black uppercase mb-2">{auth.user?.name}</h2>
              <p className="font-semibold text-gray-700 mb-4">{auth.user?.email}</p>
              <p className="font-semibold text-gray-700 mb-6">{auth.user?.phone}</p>
              <Button variant="outline" className="w-full" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2 inline" />
                Logout
              </Button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Link href="/orders" className="bg-white border-4 border-black shadow-brutal p-6 hover:-translate-y-2 transition-transform">
                <Package className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-black uppercase mb-2">Orders</h3>
                <p className="font-semibold text-gray-700 mb-2">{orders.length} total orders</p>
                <span className="font-bold text-primary">View All →</span>
              </Link>

              <Link href="/wishlist" className="bg-white border-4 border-black shadow-brutal p-6 hover:-translate-y-2 transition-transform">
                <Heart className="w-12 h-12 text-secondary mb-4" />
                <h3 className="text-xl font-black uppercase mb-2">Wishlist</h3>
                <p className="font-semibold text-gray-700 mb-2">{wishlist.length} items saved</p>
                <span className="font-bold text-primary">View All →</span>
              </Link>
            </div>

            <div className="bg-white border-4 border-black shadow-brutal">
              <div className="p-6 bg-accent border-b-4 border-black">
                <h2 className="text-2xl font-black uppercase">Account Settings</h2>
              </div>
              <div className="p-6 space-y-3">
                <button className="w-full flex items-center gap-4 p-4 border-2 border-black hover:bg-accent transition-colors text-left">
                  <User className="w-6 h-6" />
                  <div className="flex-1">
                    <p className="font-bold">Personal Information</p>
                    <p className="text-sm text-gray-600">Update your details</p>
                  </div>
                </button>
                <button className="w-full flex items-center gap-4 p-4 border-2 border-black hover:bg-accent transition-colors text-left">
                  <MapPin className="w-6 h-6" />
                  <div className="flex-1">
                    <p className="font-bold">Manage Addresses</p>
                    <p className="text-sm text-gray-600">Edit delivery addresses</p>
                  </div>
                </button>
                <button className="w-full flex items-center gap-4 p-4 border-2 border-black hover:bg-accent transition-colors text-left">
                  <Bell className="w-6 h-6" />
                  <div className="flex-1">
                    <p className="font-bold">Notifications</p>
                    <p className="text-sm text-gray-600">Manage your preferences</p>
                  </div>
                </button>
                <button className="w-full flex items-center gap-4 p-4 border-2 border-black hover:bg-accent transition-colors text-left">
                  <Settings className="w-6 h-6" />
                  <div className="flex-1">
                    <p className="font-bold">Account Settings</p>
                    <p className="text-sm text-gray-600">Privacy and security</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
