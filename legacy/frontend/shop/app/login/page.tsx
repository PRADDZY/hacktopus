'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/StoreContext';
import Button from '@/components/Button';
import { Mail, Lock, Smartphone, Facebook, Chrome } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithPhone } = useStore();
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      router.push('/');
    } else {
      alert('Login failed. Please check your credentials.');
    }
  };

  const handlePhoneLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showOtpInput) {
      setShowOtpInput(true);
      alert('OTP sent! Use: 123456');
    } else {
      if (loginWithPhone(phone, otp)) {
        router.push('/');
      } else {
        alert('Invalid OTP. Use: 123456');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4" style={{background: 'linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)'}}>
      <div className="max-w-md w-full bg-white border-4 border-black shadow-brutal-lg">
        <div className="p-8 bg-accent border-b-4 border-black">
          <h1 className="text-4xl font-black uppercase text-center">Login</h1>
        </div>

        <div className="p-8">
          {/* Login Method Toggle */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setLoginMethod('email')}
              className={`flex-1 py-3 border-3 border-black font-bold uppercase ${loginMethod === 'email' ? 'bg-primary text-white' : 'bg-white'}`}
            >
              <Mail className="w-5 h-5 inline mr-2" />
              Email
            </button>
            <button
              onClick={() => setLoginMethod('phone')}
              className={`flex-1 py-3 border-3 border-black font-bold uppercase ${loginMethod === 'phone' ? 'bg-primary text-white' : 'bg-white'}`}
            >
              <Smartphone className="w-5 h-5 inline mr-2" />
              Phone
            </button>
          </div>

          {/* Email Login Form */}
          {loginMethod === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block font-bold mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal"
                />
              </div>
              <div>
                <label className="block font-bold mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal"
                />
              </div>
              <div className="text-right">
                <a href="#" className="text-sm font-bold text-primary hover:underline">
                  Forgot Password?
                </a>
              </div>
              <Button type="submit" className="w-full" size="lg">
                Login
              </Button>
            </form>
          )}

          {/* Phone Login Form */}
          {loginMethod === 'phone' && (
            <form onSubmit={handlePhoneLogin} className="space-y-4">
              <div>
                <label className="block font-bold mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  required
                  maxLength={10}
                  className="w-full px-4 py-3 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal"
                />
              </div>
              {showOtpInput && (
                <div>
                  <label className="block font-bold mb-2">Enter OTP</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    required
                    maxLength={6}
                    className="w-full px-4 py-3 border-3 border-black font-semibold focus:outline-none focus:shadow-brutal"
                  />
                  <p className="text-sm font-semibold text-gray-600 mt-2">
                    Dummy OTP: 123456
                  </p>
                </div>
              )}
              <Button type="submit" className="w-full" size="lg">
                {showOtpInput ? 'Verify OTP' : 'Send OTP'}
              </Button>
            </form>
          )}

          {/* Social Login */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-black"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white font-bold uppercase">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center gap-2 px-4 py-3 border-3 border-black bg-white hover:bg-accent font-bold transition-colors">
                <Chrome className="w-5 h-5" />
                Google
              </button>
              <button className="flex items-center justify-center gap-2 px-4 py-3 border-3 border-black bg-white hover:bg-accent font-bold transition-colors">
                <Facebook className="w-5 h-5" />
                Facebook
              </button>
            </div>
          </div>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="font-semibold">
              Don't have an account?{' '}
              <Link href="/signup" className="font-bold text-primary hover:underline">
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
