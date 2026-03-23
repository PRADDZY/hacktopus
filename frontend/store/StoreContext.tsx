'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, Address, Notification, Order, Product } from '@/types';
import {
  beginAuthFlow,
  getAccessToken as getProviderAccessToken,
  getAuthProfile,
  isAuthConfigured,
  logoutFromAuthProvider,
  type AuthRole,
} from '@/lib/authClient';
import { safeJsonParse } from '@/lib/storage';

type AuthActionOptions = {
  role?: AuthRole;
  returnTo?: string;
};

interface StoreContextType extends AppState {
  isAuthReady: boolean;
  isAuthConfigured: boolean;
  login: (email: string, password: string, options?: AuthActionOptions) => Promise<boolean>;
  loginWithPhone: (phone: string, otp: string, options?: AuthActionOptions) => Promise<boolean>;
  signup: (
    name: string,
    email: string,
    password: string,
    phone: string,
    options?: AuthActionOptions
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  hasRole: (role: string) => boolean;
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
const DEFAULT_ROLE_CLAIM = 'https://fairlens.ai/roles';

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

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const toStringArray = (value: unknown): string[] => {
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  if (!Array.isArray(value)) {
    return [];
  }

  const values: string[] = [];
  for (const entry of value) {
    const role = String(entry).trim();
    if (role && !values.includes(role)) {
      values.push(role);
    }
  }
  return values;
};

const resolveRoles = (rawUser: Record<string, unknown>): string[] => {
  const appMetadata = rawUser.app_metadata;
  const appMetadataRoles =
    typeof appMetadata === 'object' && appMetadata !== null
      ? (appMetadata as Record<string, unknown>).roles
      : undefined;

  const roleSources = [
    rawUser[DEFAULT_ROLE_CLAIM],
    rawUser.roles,
    appMetadataRoles,
  ];

  const roles: string[] = [];
  for (const source of roleSources) {
    for (const role of toStringArray(source)) {
      if (!roles.includes(role)) {
        roles.push(role);
      }
    }
  }
  return roles;
};

const mapProviderUserToAppUser = (providerUser: Record<string, unknown>) => {
  const subject = readString(providerUser.sub) ?? readString(providerUser.user_id) ?? 'user';
  const email = readString(providerUser.email) ?? `${subject}@unknown.local`;
  const phone = readString(providerUser.phone_number) ?? '';
  const roles = resolveRoles(providerUser);

  const fallbackName = email.includes('@') ? email.split('@')[0] : 'User';
  const name =
    readString(providerUser.name) ??
    readString(providerUser.nickname) ??
    fallbackName;

  return {
    id: subject,
    name,
    email,
    phone,
    roles,
  };
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [isStateReady, setIsStateReady] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const authConfigured = isAuthConfigured();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = safeJsonParse<AppState>(stored);
      if (parsed) {
        setState({
          ...parsed,
          auth: authConfigured ? initialState.auth : parsed.auth,
        });
      } else {
        console.warn('Resetting invalid stored state cache');
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsStateReady(true);
  }, [authConfigured]);

  const refreshAuth = async () => {
    if (!authConfigured) {
      setIsAuthReady(true);
      return;
    }

    try {
      const profile = await getAuthProfile();
      const user =
        profile.isAuthenticated && profile.user
          ? mapProviderUserToAppUser(profile.user as Record<string, unknown>)
          : null;

      setState((prev) => ({
        ...prev,
        auth: {
          isAuthenticated: Boolean(user),
          user,
        },
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        auth: {
          isAuthenticated: false,
          user: null,
        },
      }));
    } finally {
      setIsAuthReady(true);
    }
  };

  useEffect(() => {
    if (!isStateReady) {
      return;
    }

    if (!authConfigured) {
      setIsAuthReady(true);
      return;
    }

    void refreshAuth();
  }, [authConfigured, isStateReady]);

  useEffect(() => {
    if (!isStateReady) {
      return;
    }

    const persistedState: AppState = authConfigured
      ? { ...state, auth: initialState.auth }
      : state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  }, [authConfigured, isStateReady, state]);

  const login = async (
    email: string,
    password: string,
    options: AuthActionOptions = {}
  ): Promise<boolean> => {
    if (authConfigured) {
      await beginAuthFlow({
        mode: 'login',
        role: options.role ?? 'user',
        returnTo: options.returnTo,
      });
      return true;
    }

    if (email && password) {
      const role = options.role ?? 'user';
      setState((prev) => ({
        ...prev,
        auth: {
          isAuthenticated: true,
          user: {
            id: 'user-001',
            name: email.split('@')[0],
            email,
            phone: '9876543210',
            roles: [role],
          },
        },
      }));
      return true;
    }
    return false;
  };

  const loginWithPhone = async (
    phone: string,
    otp: string,
    options: AuthActionOptions = {}
  ): Promise<boolean> => {
    if (authConfigured) {
      await beginAuthFlow({
        mode: 'login',
        role: options.role ?? 'user',
        returnTo: options.returnTo,
      });
      return true;
    }

    if (phone && otp === '123456') {
      const role = options.role ?? 'user';
      setState((prev) => ({
        ...prev,
        auth: {
          isAuthenticated: true,
          user: {
            id: 'user-001',
            name: 'User',
            email: `${phone}@example.com`,
            phone,
            roles: [role],
          },
        },
      }));
      return true;
    }
    return false;
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    phone: string,
    options: AuthActionOptions = {}
  ): Promise<boolean> => {
    if (authConfigured) {
      await beginAuthFlow({
        mode: 'signup',
        role: options.role ?? 'user',
        returnTo: options.returnTo,
      });
      return true;
    }

    if (name && email && password && phone) {
      const role = options.role ?? 'user';
      setState((prev) => ({
        ...prev,
        auth: {
          isAuthenticated: true,
          user: {
            id: 'user-001',
            name,
            email,
            phone,
            roles: [role],
          },
        },
      }));
      return true;
    }
    return false;
  };

  const logout = async () => {
    setState((prev) => ({
      ...prev,
      auth: {
        isAuthenticated: false,
        user: null,
      },
    }));

    if (authConfigured) {
      await logoutFromAuthProvider();
    }
  };

  const getAccessToken = async () => {
    if (!authConfigured) {
      return null;
    }
    return getProviderAccessToken();
  };

  const hasRole = (role: string): boolean => {
    const normalized = role.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    const roles = state.auth.user?.roles ?? [];
    return roles.some((entry) => entry.trim().toLowerCase() === normalized);
  };

  const addToCart = (product: Product) => {
    setState((prev) => {
      const existingItem = prev.cart.find((item) => item.product.id === product.id);
      if (existingItem) {
        return {
          ...prev,
          cart: prev.cart.map((item) =>
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
    setState((prev) => ({
      ...prev,
      cart: prev.cart.filter((item) => item.product.id !== productId),
    }));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    setState((prev) => ({
      ...prev,
      cart: prev.cart.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      ),
    }));
  };

  const clearCart = () => {
    setState((prev) => ({ ...prev, cart: [] }));
  };

  const addToWishlist = (product: Product) => {
    setState((prev) => {
      if (prev.wishlist.some((p) => p.id === product.id)) {
        return prev;
      }
      return {
        ...prev,
        wishlist: [...prev.wishlist, product],
      };
    });
  };

  const removeFromWishlist = (productId: string) => {
    setState((prev) => ({
      ...prev,
      wishlist: prev.wishlist.filter((p) => p.id !== productId),
    }));
  };

  const addOrder = (order: Order) => {
    setState((prev) => ({
      ...prev,
      orders: [order, ...prev.orders],
    }));
  };

  const addNotification = (notification: Notification) => {
    setState((prev) => ({
      ...prev,
      notifications: [notification, ...prev.notifications],
    }));
  };

  const markNotificationAsRead = (notificationId: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
    }));
  };

  const addAddress = (address: Address) => {
    setState((prev) => ({
      ...prev,
      addresses: [...prev.addresses, address],
    }));
  };

  const updateAddress = (address: Address) => {
    setState((prev) => ({
      ...prev,
      addresses: prev.addresses.map((a) => (a.id === address.id ? address : a)),
    }));
  };

  const deleteAddress = (addressId: string) => {
    setState((prev) => ({
      ...prev,
      addresses: prev.addresses.filter((a) => a.id !== addressId),
    }));
  };

  const setDefaultAddress = (addressId: string) => {
    setState((prev) => ({
      ...prev,
      addresses: prev.addresses.map((a) => ({
        ...a,
        isDefault: a.id === addressId,
      })),
    }));
  };

  if (!isStateReady || !isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 text-center">
          <div className="h-12 w-12 rounded-full border-2 border-line border-t-accent animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-semibold text-muted">Preparing secure workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <StoreContext.Provider
      value={{
        ...state,
        isAuthReady,
        isAuthConfigured: authConfigured,
        login,
        loginWithPhone,
        signup,
        logout,
        refreshAuth,
        getAccessToken,
        hasRole,
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

