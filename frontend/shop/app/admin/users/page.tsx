'use client';

import React from 'react';

export default function AdminUsers() {
  const users = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    phone: `98765432${10 + i}`,
    orders: Math.floor(Math.random() * 10) + 1,
    spent: `₹${Math.floor(Math.random() * 500)}K`,
    joined: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
  }));

  return (
    <div className="min-h-screen py-8 bg-gray-100">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-black uppercase mb-8">Manage Users</h1>

        <div className="bg-white border-4 border-black shadow-brutal overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary text-white border-b-4 border-black">
                  <th className="p-4 text-left font-black uppercase">ID</th>
                  <th className="p-4 text-left font-black uppercase">Name</th>
                  <th className="p-4 text-left font-black uppercase">Email</th>
                  <th className="p-4 text-left font-black uppercase">Phone</th>
                  <th className="p-4 text-left font-black uppercase">Orders</th>
                  <th className="p-4 text-left font-black uppercase">Total Spent</th>
                  <th className="p-4 text-left font-black uppercase">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr key={user.id} className={`border-b-2 border-black ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="p-4 font-bold">{user.id}</td>
                    <td className="p-4 font-bold">{user.name}</td>
                    <td className="p-4 font-semibold">{user.email}</td>
                    <td className="p-4 font-semibold">{user.phone}</td>
                    <td className="p-4 font-bold">{user.orders}</td>
                    <td className="p-4 font-bold text-primary">{user.spent}</td>
                    <td className="p-4 font-semibold">{user.joined}</td>
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
