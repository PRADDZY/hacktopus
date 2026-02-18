'use client';

import { useDashboardMode } from '@/lib/useDashboardMode';

export default function DashboardTopbar() {
  const { isDemo, setMode } = useDashboardMode();

  const toggleMode = () => {
    setMode(isDemo ? 'live' : 'demo');
  };

  return (
    <div className="border-b border-line bg-surface/90 px-6 py-4 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Live Risk Center</p>
        <h1 className="text-xl font-semibold">Portfolio Monitor</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${isDemo ? 'bg-accent/15 text-accent' : 'bg-highlight/15 text-highlight'}`}>
          {isDemo ? 'Demo Data' : 'Live Data'}
        </div>
        <button
          type="button"
          onClick={toggleMode}
          className="hidden sm:flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted hover:text-ink hover:border-ink transition"
          aria-pressed={isDemo}
        >
          <span className={`h-2 w-2 rounded-full ${isDemo ? 'bg-accent' : 'bg-highlight'}`}></span>
          {isDemo ? 'Switch to live' : 'Switch to demo'}
        </button>
        <input
          type="search"
          placeholder="Search buyer ID or transaction..."
          className="input-field w-64 hidden md:block"
        />
      </div>
    </div>
  );
}
