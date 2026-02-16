'use client';

import { useState } from 'react';

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  status: 'success' | 'warning' | 'error';
}

const mockAuditLogs: AuditLog[] = [
  {
    id: 'LOG001',
    timestamp: '2024-02-16T14:32:00Z',
    user: 'Risk Manager',
    action: 'Approved EMI Request',
    details: 'EMI003 - Business Entity C - ₹18,000',
    status: 'success'
  },
  {
    id: 'LOG002',
    timestamp: '2024-02-16T14:15:00Z',
    user: 'Risk Manager',
    action: 'Rejected EMI Request',
    details: 'EMI004 - Commercial User D - ₹35,000 - High DTI',
    status: 'error'
  },
  {
    id: 'LOG003',
    timestamp: '2024-02-16T13:45:00Z',
    user: 'System',
    action: 'Risk Alert Generated',
    details: 'Multiple EMIs detected for BUY2024002',
    status: 'warning'
  },
  {
    id: 'LOG004',
    timestamp: '2024-02-16T13:20:00Z',
    user: 'Risk Manager',
    action: 'Reviewed Application',
    details: 'EMI001 - Enterprise Customer A - Marked for manual review',
    status: 'success'
  },
  {
    id: 'LOG005',
    timestamp: '2024-02-16T12:55:00Z',
    user: 'System',
    action: 'Auto-Approved Request',
    details: 'EMI007 - Institution G - ₹15,000 - Low Risk',
    status: 'success'
  },
  {
    id: 'LOG006',
    timestamp: '2024-02-16T12:30:00Z',
    user: 'Risk Manager',
    action: 'Updated Risk Parameters',
    details: 'DTI threshold adjusted to 45%',
    status: 'success'
  },
  {
    id: 'LOG007',
    timestamp: '2024-02-16T11:45:00Z',
    user: 'System',
    action: 'Risk Alert Generated',
    details: 'Credit score below minimum for EMI008',
    status: 'warning'
  },
  {
    id: 'LOG008',
    timestamp: '2024-02-16T11:20:00Z',
    user: 'Risk Manager',
    action: 'Exported Report',
    details: 'Monthly risk analysis report - January 2024',
    status: 'success'
  },
];

export default function AuditLogsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredLogs = mockAuditLogs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-amber-100 text-amber-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-600 mt-1">Track all system activities and user actions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <p className="text-sm text-gray-600">Total Actions Today</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{mockAuditLogs.length}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-600">Successful Actions</p>
          <p className="text-2xl font-semibold text-green-600 mt-1">
            {mockAuditLogs.filter(l => l.status === 'success').length}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-600">Warnings Generated</p>
          <p className="text-2xl font-semibold text-amber-600 mt-1">
            {mockAuditLogs.filter(l => l.status === 'warning').length}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <h2 className="text-lg font-semibold text-gray-900">Activity Log</h2>
            <div className="flex space-x-3">
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field w-64"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field w-40"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredLogs.map((log) => (
            <div key={log.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(log.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{log.action}</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getStatusColor(log.status)}`}>
                      {log.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{log.details}</p>
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span className="flex items-center">
                      <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {log.user}
                    </span>
                    <span className="flex items-center">
                      <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
