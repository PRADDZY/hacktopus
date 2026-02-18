'use client';

import { useEffect, useMemo, useState } from 'react';
import { AuditLogItem } from '@/types';
import { fetchAuditLogs } from '@/lib/fairlensApi';
import { useDashboardMode } from '@/lib/useDashboardMode';

const PAGE_SIZE = 8;

const statusLabels: Record<AuditLogItem['status'], string> = {
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

export default function AuditLogsPage() {
  const { mode } = useDashboardMode();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let isCancelled = false;

    const loadLogs = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetchAuditLogs(currentPage, PAGE_SIZE, mode, {
          status: statusFilter,
          search: searchTerm,
        });

        if (isCancelled) return;

        setLogs(response.items);
        setTotalItems(response.total);
        setTotalPages(response.total_pages);
      } catch (loadError) {
        if (isCancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load audit logs');
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadLogs();
    return () => {
      isCancelled = true;
    };
  }, [mode, currentPage, searchTerm, statusFilter]);

  const { successCount, warningCount, errorCount } = useMemo(() => {
    return {
      successCount: logs.filter((log) => log.status === 'success').length,
      warningCount: logs.filter((log) => log.status === 'warning').length,
      errorCount: logs.filter((log) => log.status === 'error').length,
    };
  }, [logs]);

  const formatTimestamp = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const getStatusClass = (status: AuditLogItem['status']) => {
    switch (status) {
      case 'success':
        return 'bg-highlight/10 text-highlight border-highlight/20';
      case 'warning':
        return 'bg-accent/10 text-accent border-accent/20';
      case 'error':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      default:
        return 'bg-ink/5 text-ink border-line';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="section-kicker">Compliance</p>
        <h1 className="section-title">Audit Logs</h1>
        <p className="text-sm text-muted mt-2">Trace every decision, fallback, and manual review.</p>
      </div>

      {error && (
        <div className="card-subtle p-4 text-sm text-rose-700 border-rose-200/60">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <p className="text-sm text-muted">Total Events</p>
          <p className="text-2xl font-semibold text-ink mt-2">{totalItems}</p>
          <p className="text-xs text-muted mt-2">Across live + fallback paths</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-muted">Success</p>
          <p className="text-2xl font-semibold text-highlight mt-2">{successCount}</p>
          <p className="text-xs text-muted mt-2">Scored without intervention</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-muted">Warnings</p>
          <p className="text-2xl font-semibold text-accent mt-2">{warningCount}</p>
          <p className="text-xs text-muted mt-2">Fallback or manual review</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-muted">Errors</p>
          <p className="text-2xl font-semibold text-rose-700 mt-2">{errorCount}</p>
          <p className="text-xs text-muted mt-2">Requires triage</p>
        </div>
      </div>

      <div className="card">
        <div className="p-6 border-b border-line flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-ink">Activity Log</h2>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(event) => {
                setCurrentPage(1);
                setSearchTerm(event.target.value);
              }}
              className="input-field w-64"
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                setCurrentPage(1);
                setStatusFilter(event.target.value);
              }}
              className="input-field w-40"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-line">
          {isLoading && (
            <div className="p-6 text-sm text-muted">Loading audit logs...</div>
          )}

          {!isLoading && logs.length === 0 && (
            <div className="p-6 text-sm text-muted">No records match this filter.</div>
          )}

          {!isLoading &&
            logs.map((log) => (
              <div key={log.id} className="p-6 hover:bg-ink/5 transition">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(log.status)}`}>
                        {statusLabels[log.status]}
                      </span>
                      <p className="text-sm font-semibold text-ink">{log.action}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted">{log.details}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                      <span>Actor: {log.actor}</span>
                      {log.entity_id && <span>Entity: TXN-{log.entity_id}</span>}
                      {log.source && <span>Source: {log.source}</span>}
                    </div>
                  </div>
                  <div className="text-xs text-muted">{formatTimestamp(log.created_at)}</div>
                </div>
              </div>
            ))}
        </div>

        <div className="px-6 py-4 border-t border-line flex items-center justify-between">
          <p className="text-sm text-muted">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || isLoading}
              className="btn-outline px-4 py-2 text-xs"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="btn-outline px-4 py-2 text-xs"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
