'use client';

import { StoreProvider } from '@/store/StoreContext';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}

