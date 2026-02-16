'use client';

import React from 'react';
import { BarChart3, PieChart, TrendingUp, Users } from 'lucide-react';

export default function AdminAnalytics() {
  return (
    <div className="min-h-screen py-8 bg-gray-100">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-black uppercase mb-8">Analytics</h1>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border-4 border-black shadow-brutal p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-8 h-8 text-primary" />
              <h2 className="text-2xl font-black uppercase">Sales Overview</h2>
            </div>
            <div className="space-y-4">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May'].map((month, i) => (
                <div key={month} className="flex items-center gap-3">
                  <span className="font-bold w-12">{month}</span>
                  <div className="flex-1 h-8 border-2 border-black bg-gray-100 overflow-hidden">
                    <div className="h-full bg-primary border-r-2 border-black" style={{ width: `${(i + 1) * 20}%` }}></div>
                  </div>
                  <span className="font-bold w-16">₹{(i + 1) * 10}L</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border-4 border-black shadow-brutal p-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-8 h-8 text-secondary" />
              <h2 className="text-2xl font-black uppercase">Revenue Trend</h2>
            </div>
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-5xl font-black text-primary mb-2">₹45.2L</p>
                <p className="font-semibold text-gray-600">This Month</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 border-2 border-black">
                  <p className="text-2xl font-black">↑ 12%</p>
                  <p className="text-sm font-semibold">Growth</p>
                </div>
                <div className="text-center p-4 border-2 border-black">
                  <p className="text-2xl font-black">892</p>
                  <p className="text-sm font-semibold">Users</p>
                </div>
                <div className="text-center p-4 border-2 border-black">
                  <p className="text-2xl font-black">1.2K</p>
                  <p className="text-sm font-semibold">Orders</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border-4 border-black shadow-brutal p-6">
            <div className="flex items-center gap-3 mb-6">
              <PieChart className="w-8 h-8 text-accent" />
              <h2 className="text-2xl font-black uppercase">Payment Methods</h2>
            </div>
            <div className="space-y-3">
              {[
                { method: 'EMI', percentage: 45, color: 'bg-primary' },
                { method: 'Credit Card', percentage: 30, color: 'bg-secondary' },
                { method: 'UPI', percentage: 15, color: 'bg-accent' },
                { method: 'COD', percentage: 10, color: 'bg-gray-400' },
              ].map((item) => (
                <div key={item.method}>
                  <div className="flex justify-between mb-2">
                    <span className="font-bold">{item.method}</span>
                    <span className="font-bold">{item.percentage}%</span>
                  </div>
                  <div className="h-6 border-2 border-black bg-gray-100 overflow-hidden">
                    <div className={`h-full ${item.color} border-r-2 border-black`} style={{ width: `${item.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border-4 border-black shadow-brutal p-6">
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-8 h-8 text-primary" />
              <h2 className="text-2xl font-black uppercase">User Activity</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 border-2 border-black bg-primary/10">
                <p className="text-3xl font-black mb-1">2,847</p>
                <p className="font-semibold">Active Users Today</p>
              </div>
              <div className="p-4 border-2 border-black bg-secondary/10">
                <p className="text-3xl font-black mb-1">156</p>
                <p className="font-semibold">New Registrations</p>
              </div>
              <div className="p-4 border-2 border-black bg-accent/30">
                <p className="text-3xl font-black mb-1">45min</p>
                <p className="font-semibold">Avg. Session Duration</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
