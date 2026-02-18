'use client';

import React from 'react';
import { DollarSign, Package, Users, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const stats = [
    { title: 'Total Sales', value: '₹45.2L', change: '+12.5%', icon: DollarSign, color: 'bg-primary' },
    { title: 'Orders', value: '1,284', change: '+8.2%', icon: Package, color: 'bg-secondary' },
    { title: 'Customers', value: '892', change: '+15.3%', icon: Users, color: 'bg-accent' },
    { title: 'Revenue', value: '₹38.5L', change: '+9.8%', icon: TrendingUp, color: 'bg-primary' },
  ];

  return (
    <div className="min-h-screen py-8 bg-gray-100">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-black uppercase mb-8">Admin Dashboard</h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white border-4 border-black shadow-brutal p-6">
              <div className={`w-12 h-12 ${stat.color} border-3 border-black flex items-center justify-center mb-4`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm font-bold text-gray-600 uppercase">{stat.title}</p>
              <p className="text-3xl font-black my-2">{stat.value}</p>
              <p className="text-sm font-semibold text-green-600">{stat.change}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white border-4 border-black shadow-brutal p-6">
            <h2 className="text-2xl font-black uppercase mb-4">Recent Orders</h2>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4 border-2 border-black hover:bg-accent transition-colors">
                  <div className="flex justify-between">
                    <span className="font-bold">Order #ORD-2024-{1000 + i}</span>
                    <span className="font-semibold text-primary">₹3,49,900</span>
                  </div>
                  <p className="text-sm text-gray-600 font-semibold">MacBook Pro M3 Max</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border-4 border-black shadow-brutal p-6">
            <h2 className="text-2xl font-black uppercase mb-4">Top Customers</h2>
            <div className="space-y-3">
              {['Rahul Sharma', 'Priya Patel', 'Arjun Mehta', 'Sneha Gupta', 'Vikram Singh'].map((name, i) => (
                <div key={i} className="p-4 border-2 border-black hover:bg-accent transition-colors">
                  <div className="flex justify-between">
                    <span className="font-bold">{name}</span>
                    <span className="font-semibold text-secondary">₹{(5 - i) * 100}K</span>
                  </div>
                  <p className="text-sm text-gray-600 font-semibold">{5 - i} orders</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
