'use client';

import { useState } from 'react';
import KPICard from '@/components/dashboard/KPICard';
import EMIRequestsTable from '@/components/dashboard/EMIRequestsTable';
import BuyerDetailsDrawer from '@/components/dashboard/BuyerDetailsDrawer';
import { mockEMIRequests } from '@/lib/mockData';
import { EMIRequest } from '@/types';

export default function DashboardPage() {
  const [selectedRequest, setSelectedRequest] = useState<EMIRequest | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const pendingRequests = mockEMIRequests.filter(r => r.status === 'Pending').length;
  const highRiskAlerts = mockEMIRequests.filter(r => r.riskScore >= 75).length;
  const approvedToday = mockEMIRequests.filter(r => r.status === 'Approved').length;
  const rejectedToday = mockEMIRequests.filter(r => r.status === 'Rejected').length;

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
            subtext="Risk score ≥ 75"
            color="red"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
          <KPICard
            title="Auto-Approved Today"
            value={approvedToday}
            subtext="Low risk applications"
            color="green"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <KPICard
            title="Auto-Rejected Today"
            value={rejectedToday}
            subtext="High risk flagged"
            color="amber"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        <EMIRequestsTable 
          requests={mockEMIRequests} 
          onViewDetails={handleViewDetails}
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
