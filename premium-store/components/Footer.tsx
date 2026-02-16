import React from 'react';
import Link from 'next/link';
import { Facebook, Twitter, Instagram, Youtube, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-dark text-white border-t-4 border-black mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-xl font-black uppercase mb-4 text-accent">About</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="hover:text-accent transition-colors font-semibold">About Us</Link></li>
              <li><Link href="/careers" className="hover:text-accent transition-colors font-semibold">Careers</Link></li>
              <li><Link href="/press" className="hover:text-accent transition-colors font-semibold">Press</Link></li>
              <li><Link href="/blog" className="hover:text-accent transition-colors font-semibold">Blog</Link></li>
            </ul>
          </div>

          {/* Help */}
          <div>
            <h3 className="text-xl font-black uppercase mb-4 text-accent">Help</h3>
            <ul className="space-y-2">
              <li><Link href="/support" className="hover:text-accent transition-colors font-semibold">Customer Support</Link></li>
              <li><Link href="/shipping" className="hover:text-accent transition-colors font-semibold">Shipping Info</Link></li>
              <li><Link href="/returns" className="hover:text-accent transition-colors font-semibold">Returns</Link></li>
              <li><Link href="/faq" className="hover:text-accent transition-colors font-semibold">FAQ</Link></li>
            </ul>
          </div>

          {/* Policy */}
          <div>
            <h3 className="text-xl font-black uppercase mb-4 text-accent">Policy</h3>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="hover:text-accent transition-colors font-semibold">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-accent transition-colors font-semibold">Terms of Use</Link></li>
              <li><Link href="/security" className="hover:text-accent transition-colors font-semibold">Security</Link></li>
              <li><Link href="/sitemap" className="hover:text-accent transition-colors font-semibold">Sitemap</Link></li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-xl font-black uppercase mb-4 text-accent">Connect</h3>
            <div className="flex gap-3 mb-4">
              <a href="#" className="p-3 bg-primary border-2 border-white hover:bg-accent transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="p-3 bg-primary border-2 border-white hover:bg-accent transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="p-3 bg-primary border-2 border-white hover:bg-accent transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="p-3 bg-primary border-2 border-white hover:bg-accent transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Mail className="w-5 h-5 text-accent" />
              <a href="mailto:support@premium.com" className="hover:text-accent transition-colors font-semibold">
                support@premium.com
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t-2 border-gray-700 mt-8 pt-8 text-center">
          <p className="font-semibold">© 2024 Premium Store. All rights reserved.</p>
          <p className="text-sm text-gray-400 mt-2">Made with ❤️ in India</p>
        </div>
      </div>
    </footer>
  );
}
