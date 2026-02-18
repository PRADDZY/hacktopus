export type DashboardMode = 'demo' | 'live';

const STORAGE_KEY = 'fairlens-dashboard-mode';
export const DASHBOARD_MODE_EVENT = 'fairlens:dashboard-mode';

const envDefaultMode = (): DashboardMode => {
  const useDemoEnv = (
    process.env.NEXT_PUBLIC_USE_DEMO_DASHBOARD ??
    process.env.NEXT_PUBLIC_USE_FAKE_DASHBOARD ??
    'false'
  ) === 'true';
  return useDemoEnv ? 'demo' : 'live';
};

export const getDashboardMode = (): DashboardMode => {
  if (typeof window === 'undefined') {
    return envDefaultMode();
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'demo' || stored === 'live') {
    return stored;
  }

  return envDefaultMode();
};

export const setDashboardMode = (mode: DashboardMode): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent(DASHBOARD_MODE_EVENT));
};
