'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, CartItem, Product, Order, Notification, Address } from '@/types';
import { safeJsonParse } from '@/lib/storage';

interface StoreContextType extends AppState {
  login: (email: string, password: string) => boolean;
  loginWithPhone: (phone: string, otp: string) => boolean;
  signup: (name: string, email: string, password: string, phone: string) => boolean;
  logout: () => void;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  addOrder: (order: Order) => void;
  addNotification: (notification: Notification) => void;
  markNotificationAsRead: (notificationId: string) => void;
  addAddress: (address: Address) => void;
  updateAddress: (address: Address) => void;
  deleteAddress: (addressId: string) => void;
  setDefaultAddress: (addressId: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_KEY = 'fairlens-store-v1';

const initialState: AppState = {
  auth: {
    isAuthenticated: false,
    user: null,
  },
  cart: [],
  wishlist: [],
  orders: [],
  notifications: [],
  addresses: [],
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = safeJsonParse<AppState>(stored);
      if (parsed) {
        setState(parsed);
      } else {
        console.warn('Resetting invalid stored state cache');
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isLoading]);

  const login = (email: string, password: string): boolean => {
    if (email && password) {
      setState(prev => ({
        ...prev,
        auth: {
          isAuthenticated: true,
          user: {
            id: 'user-001',
            name: email.split('@')[0],
            email,
            phone: '9876543210',
          },
        },
      }));
      return true;
    }
    return false;
  };

  const loginWithPhone = (phone: string, otp: string): boolean => {
    if (phone && otp === '123456') {
      setState(prev => ({
        ...prev,
        auth: {
          isAuthenticated: true,
          user: {
            id: 'user-001',
            name: 'User',
            email: `${phone}@example.com`,
            phone,
          },
        },
      }));
      return true;
    }
    return false;
  };

  const signup = (name: string, email: string, password: string, phone: string): boolean => {
    if (name && email && password && phone) {
      setState(prev => ({
        ...prev,
        auth: {
          isAuthenticated: true,
          user: {
            id: 'user-001',
            name,
            email,
            phone,
          },
        },
      }));
      return true;
    }
    return false;
  };

  const logout = () => {
    setState(prev => ({
      ...prev,
      auth: {
        isAuthenticated: false,
        user: null,
      },
    }));
  };

  const addToCart = (product: Product) => {
    setState(prev => {
      const existingItem = prev.cart.find(item => item.product.id === product.id);
      if (existingItem) {
        return {
          ...prev,
          cart: prev.cart.map(item =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }
      return {
        ...prev,
        cart: [...prev.cart, { product, quantity: 1 }],
      };
    });
  };

  const removeFromCart = (productId: string) => {
    setState(prev => ({
      ...prev,
      cart: prev.cart.filter(item => item.product.id !== productId),
    }));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    setState(prev => ({
      ...prev,
      cart: prev.cart.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      ),
    }));
  };

  const clearCart = () => {
    setState(prev => ({ ...prev, cart: [] }));
  };

  const addToWishlist = (product: Product) => {
    setState(prev => {
      if (prev.wishlist.some(p => p.id === product.id)) {
        return prev;
      }
      return {
        ...prev,
        wishlist: [...prev.wishlist, product],
      };
    });
  };

  const removeFromWishlist = (productId: string) => {
    setState(prev => ({
      ...prev,
      wishlist: prev.wishlist.filter(p => p.id !== productId),
    }));
  };

  const addOrder = (order: Order) => {
    setState(prev => ({
      ...prev,
      orders: [order, ...prev.orders],
    }));
  };

  const addNotification = (notification: Notification) => {
    setState(prev => ({
      ...prev,
      notifications: [notification, ...prev.notifications],
    }));
  };

  const markNotificationAsRead = (notificationId: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
    }));
  };

  const addAddress = (address: Address) => {
    setState(prev => ({
      ...prev,
      addresses: [...prev.addresses, address],
    }));
  };

  const updateAddress = (address: Address) => {
    setState(prev => ({
      ...prev,
      addresses: prev.addresses.map(a => (a.id === address.id ? address : a)),
    }));
  };

  const deleteAddress = (addressId: string) => {
    setState(prev => ({
      ...prev,
      addresses: prev.addresses.filter(a => a.id !== addressId),
    }));
  };

  const setDefaultAddress = (addressId: string) => {
    setState(prev => ({
      ...prev,
      addresses: prev.addresses.map(a => ({
        ...a,
        isDefault: a.id === addressId,
      })),
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 text-center">
          <div className="h-12 w-12 rounded-full border-2 border-line border-t-accent animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-semibold text-muted">Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <StoreContext.Provider
      value={{
        ...state,
        login,
        loginWithPhone,
        signup,
        logout,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        addToWishlist,
        removeFromWishlist,
        addOrder,
        addNotification,
        markNotificationAsRead,
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}
