'use client';

import { useEffect, useState } from 'react';
import EMIRequestsTable from '@/components/dashboard/EMIRequestsTable';
import BuyerDetailsDrawer from '@/components/dashboard/BuyerDetailsDrawer';
import { fetchLogs, fetchStats, mapLogToEMIRequest } from '@/lib/fairlensApi';
import { useDashboardMode } from '@/lib/useDashboardMode';
import { BackendStats, EMIRequest } from '@/types';

const PAGE_SIZE = 10;

const initialStats: BackendStats = {
  total_predictions: 0,
  approval_rate: 0,
  decline_rate: 0,
  risk_score_distribution: { low: 0, medium: 0, high: 0 },
};

export default function EMIRequestsPage() {
  const [selectedRequest, setSelectedRequest] = useState<EMIRequest | null>(null);
  const { mode } = useDashboardMode();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [requests, setRequests] = useState<EMIRequest[]>([]);
  const [stats, setStats] = useState<BackendStats>(initialStats);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [statsData, logsData] = await Promise.all([
          fetchStats(mode),
          fetchLogs(currentPage, PAGE_SIZE, mode),
        ]);
        if (isCancelled) return;

        setStats(statsData);
        setRequests(logsData.items.map(mapLogToEMIRequest));
        setTotalItems(logsData.total);
        setTotalPages(logsData.total_pages);
      } catch (loadError) {
        if (isCancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load EMI requests');
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [currentPage, mode]);

  const handleViewDetails = (request: EMIRequest) => {
    setSelectedRequest(request);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <p className="section-kicker">Decision Queue</p>
          <h1 className="section-title">EMI Requests</h1>
          <p className="text-sm text-muted mt-2">Review and manage all EMI applications.</p>
        </div>

        {error && (
          <div className="card-subtle p-4 text-sm text-rose-700 border-rose-200/60">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Total Requests</p>
                <p className="text-2xl font-semibold text-ink mt-1">{stats.total_predictions}</p>
              </div>
              <div className="p-3 bg-ink/5 rounded-lg">
                <svg className="h-6 w-6 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Approved</p>
                <p className="text-2xl font-semibold text-highlight mt-1">
                  {Math.round(stats.total_predictions * stats.approval_rate)}
                </p>
              </div>
              <div className="p-3 bg-highlight/10 rounded-lg">
                <svg className="h-6 w-6 text-highlight" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Rejected</p>
                <p className="text-2xl font-semibold text-accent mt-1">
                  {Math.round(stats.total_predictions * stats.decline_rate)}
                </p>
              </div>
              <div className="p-3 bg-accent/10 rounded-lg">
                <svg className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <EMIRequestsTable
          requests={requests}
          onViewDetails={handleViewDetails}
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          totalItems={totalItems}
          totalPages={totalPages}
          isLoading={isLoading}
          onPageChange={setCurrentPage}
        />
      </div>

      <BuyerDetailsDrawer
        request={selectedRequest}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
      />
    </>
  );
}
