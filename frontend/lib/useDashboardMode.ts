'use client';

import { DashboardMode } from '@/lib/dashboardMode';

export const useDashboardMode = () => {
  return {
    mode: 'live' as const,
    isDemo: false,
    setMode: (_nextMode: DashboardMode) => {},
  };
};
