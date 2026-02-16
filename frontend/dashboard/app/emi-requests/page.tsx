'use client';

import { useEffect, useState } from 'react';
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

export default function EMIRequestsPage() {
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
  }, [currentPage]);

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
          <h1 className="text-2xl font-semibold text-gray-900">EMI Requests</h1>
          <p className="text-sm text-gray-600 mt-1">Review and manage all EMI applications</p>
        </div>

        {error && (
          <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Requests</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.total_predictions}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-semibold text-green-700 mt-1">
                  {Math.round(stats.total_predictions * stats.approval_rate)}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rejected</p>
                <p className="text-2xl font-semibold text-red-700 mt-1">
                  {Math.round(stats.total_predictions * stats.decline_rate)}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
