'use client';

import { useState } from 'react';
import EMIRequestsTable from '@/components/dashboard/EMIRequestsTable';
import BuyerDetailsDrawer from '@/components/dashboard/BuyerDetailsDrawer';
import { mockEMIRequests } from '@/lib/mockData';
import { EMIRequest } from '@/types';

export default function EMIRequestsPage() {
  const [selectedRequest, setSelectedRequest] = useState<EMIRequest | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Requests</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{mockEMIRequests.length}</p>
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
                <p className="text-sm text-gray-600">Pending Review</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {mockEMIRequests.filter(r => r.status === 'Pending').length}
                </p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Average Risk Score</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {Math.round(mockEMIRequests.reduce((sum, r) => sum + r.riskScore, 0) / mockEMIRequests.length)}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
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
