'use client';

import { DashboardMode } from '@/lib/dashboardMode';

export const useDashboardMode = () => {
  return {
    mode: 'live' as const,
    isLive: true,
    setMode: (_nextMode: DashboardMode) => {},
  };
};
