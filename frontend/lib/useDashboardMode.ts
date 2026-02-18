'use client';

import { useEffect, useState } from 'react';
import { DashboardMode, DASHBOARD_MODE_EVENT, getDashboardMode, setDashboardMode } from '@/lib/dashboardMode';

export const useDashboardMode = () => {
  const [mode, setMode] = useState<DashboardMode>('live');

  useEffect(() => {
    setMode(getDashboardMode());

    const handleChange = () => {
      setMode(getDashboardMode());
    };

    window.addEventListener(DASHBOARD_MODE_EVENT, handleChange);
    return () => {
      window.removeEventListener(DASHBOARD_MODE_EVENT, handleChange);
    };
  }, []);

  const updateMode = (nextMode: DashboardMode) => {
    setDashboardMode(nextMode);
    setMode(nextMode);
  };

  return {
    mode,
    isDemo: mode === 'demo',
    setMode: updateMode,
  };
};