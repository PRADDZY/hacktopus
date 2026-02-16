'use client';

import React from 'react';

export default function AdminOrders() {
  const orders = Array.from({ length: 10 }, (_, i) => ({
    id: `ORD-2024-${1000 + i}`,
    customer: `Customer ${i + 1}`,
    product: 'MacBook Pro M3 Max',
    amount: '₹3,49,900',
    status: ['Pending', 'Processing', 'Shipped', 'Delivered'][Math.floor(Math.random() * 4)],
    date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString(),
  }));

  return (
    <div className="min-h-screen py-8 bg-gray-100">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-black uppercase mb-8">Manage Orders</h1>

        <div className="bg-white border-4 border-black shadow-brutal overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-accent border-b-4 border-black">
                  <th className="p-4 text-left font-black uppercase">Order ID</th>
                  <th className="p-4 text-left font-black uppercase">Customer</th>
                  <th className="p-4 text-left font-black uppercase">Product</th>
                  <th className="p-4 text-left font-black uppercase">Amount</th>
                  <th className="p-4 text-left font-black uppercase">Status</th>
                  <th className="p-4 text-left font-black uppercase">Date</th>
                  <th className="p-4 text-left font-black uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => (
                  <tr key={order.id} className={`border-b-2 border-black ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="p-4 font-bold">{order.id}</td>
                    <td className="p-4 font-semibold">{order.customer}</td>
                    <td className="p-4 font-semibold">{order.product}</td>
                    <td className="p-4 font-bold">{order.amount}</td>
                    <td className="p-4">
                      <select className="px-3 py-1 border-2 border-black font-bold text-sm">
                        <option>{order.status}</option>
                        <option>Pending</option>
                        <option>Processing</option>
                        <option>Shipped</option>
                        <option>Delivered</option>
                      </select>
                    </td>
                    <td className="p-4 font-semibold">{order.date}</td>
                    <td className="p-4">
                      <button className="px-4 py-2 bg-primary text-white border-2 border-black font-bold text-sm hover:bg-secondary">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
