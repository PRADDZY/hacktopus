'use client';

export default function DashboardTopbar() {
  return (
    <div className="border-b border-line bg-surface/90 px-6 py-4 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Live Risk Center</p>
        <h1 className="text-xl font-semibold">Portfolio Monitor</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="rounded-full px-3 py-1 text-xs font-semibold bg-highlight/15 text-highlight">
          Live Data
        </div>
        <input
          type="search"
          placeholder="Search buyer ID or transaction..."
          className="input-field w-64 hidden md:block"
        />
      </div>
    </div>
  );
}
