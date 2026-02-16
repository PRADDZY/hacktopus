'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/StoreContext';
import Button from '@/components/Button';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    if (signup(formData.name, formData.email, formData.password, formData.phone)) {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4" style={{background: 'linear-gradient(135deg, #4ECDC4 0%, #FFE66D 100%)'}}>
      <div className="max-w-md w-full bg-white border-4 border-black shadow-brutal-lg">
        <div className="p-8 bg-secondary border-b-4 border-black">
          <h1 className="text-4xl font-black uppercase text-center text-white">Sign Up</h1>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-bold mb-2">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
                className="w-full px-4 py-3 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal"
              />
            </div>
            <div>
              <label className="block font-bold mb-2">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal"
              />
            </div>
            <div>
              <label className="block font-bold mb-2">Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="9876543210"
                required
                maxLength={10}
                className="w-full px-4 py-3 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal"
              />
            </div>
            <div>
              <label className="block font-bold mb-2">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal"
              />
            </div>
            <div>
              <label className="block font-bold mb-2">Confirm Password</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal"
              />
            </div>
            <Button type="submit" className="w-full" size="lg">
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="font-semibold">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-primary hover:underline">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
