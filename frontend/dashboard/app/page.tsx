'use client';

import { useEffect, useMemo, useState } from 'react';
import KPICard from '@/components/dashboard/KPICard';
import EMIRequestsTable from '@/components/dashboard/EMIRequestsTable';
import BuyerDetailsDrawer from '@/components/dashboard/BuyerDetailsDrawer';
import { fetchLogs, fetchStats, mapLogToEMIRequest } from '@/utils/fairlensApi';
import { BackendStats, EMIRequest } from '@/types';

const PAGE_SIZE = 10;

const initialStats: BackendStats = {
  total_predictions: 0,
  approval_rate: 0,
  decline_rate: 0,
  risk_score_distribution: { low: 0, medium: 0, high: 0 },
};

export default function DashboardPage() {
  const [selectedRequest, setSelectedRequest] = useState<EMIRequest | null>(null);
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
          fetchStats(),
          fetchLogs(currentPage, PAGE_SIZE),
        ]);

        if (isCancelled) return;

        setStats(statsData);
        setRequests(logsData.items.map(mapLogToEMIRequest));
        setTotalItems(logsData.total);
        setTotalPages(logsData.total_pages);
      } catch (loadError) {
        if (isCancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard data');
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
  }, [currentPage]);

  const pendingRequests = 0;
  const highRiskAlerts = useMemo(
    () => stats.risk_score_distribution.high ?? requests.filter((r) => r.riskScore >= 75).length,
    [requests, stats.risk_score_distribution.high]
  );
  const approvedTotal = Math.round(stats.total_predictions * stats.approval_rate);
  const rejectedTotal = Math.round(stats.total_predictions * stats.decline_rate);

  const handleViewDetails = (request: EMIRequest) => {
    setSelectedRequest(request);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  return (
    <>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Risk Management Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Monitor and manage EMI requests in real-time</p>
        </div>

        {error && (
          <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Total Pending EMI Requests"
            value={pendingRequests}
            subtext="Awaiting review"
            color="blue"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <KPICard
            title="High-Risk Alerts Count"
            value={highRiskAlerts}
            subtext="Risk score >= 75"
            color="red"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
          <KPICard
            title="Auto-Approved"
            value={approvedTotal}
            subtext="From model decisions"
            color="green"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <KPICard
            title="Auto-Rejected"
            value={rejectedTotal}
            subtext="From model decisions"
            color="amber"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
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
