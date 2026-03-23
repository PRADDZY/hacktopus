export type DashboardMode = 'live';

export const DASHBOARD_MODE_EVENT = 'fairlens:dashboard-mode';

export const getDashboardMode = (): DashboardMode => 'live';

export const setDashboardMode = (_mode: DashboardMode): void => {
  // Dashboard demo mode is retired. Keep a no-op setter for compatibility.
};
