export type DashboardMode = 'live';

export const DASHBOARD_MODE_EVENT = 'fairlens:dashboard-mode';

export const getDashboardMode = (): DashboardMode => 'live';

export const setDashboardMode = (_mode: DashboardMode): void => {
  // Keep a no-op setter for compatibility with older callers.
};
