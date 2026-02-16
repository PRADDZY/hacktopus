'use client';

import { EMIRequest } from '@/types';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BuyerDetailsDrawerProps {
  request: EMIRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function BuyerDetailsDrawer({ request, isOpen, onClose }: BuyerDetailsDrawerProps) {
  if (!request) return null;

  const incomeExpenseData = [
    { name: 'Income', value: request.monthlyIncome },
    { name: 'EMIs', value: request.existingEmis },
    { name: 'Expenses', value: request.fixedExpenses },
    { name: 'Savings', value: request.savingsBuffer },
  ];

  const emiBurdenData = [
    { name: 'EMI Burden', value: request.existingEmis + request.emiAmount },
    {
      name: 'Available',
      value: Math.max(0, request.monthlyIncome - request.existingEmis - request.emiAmount - request.fixedExpenses),
    },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6b7280'];
  const PIE_COLORS = ['#ef4444', '#10b981'];

  const riskBreakdown = [
    { label: 'Credit Score Weight', value: request.creditScoreWeight, color: 'bg-blue-500' },
    { label: 'DTI Weight', value: request.dtiWeight, color: 'bg-green-500' },
    { label: 'EMI Load', value: request.emiLoad, color: 'bg-amber-500' },
    { label: 'Savings', value: request.savingsWeight, color: 'bg-purple-500' },
    { label: 'Stability', value: request.stabilityScore, color: 'bg-indigo-500' },
  ];

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}
      
      <div className={`fixed right-0 top-0 h-full w-[600px] bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">Buyer Details</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4">
                <div className="text-sm text-gray-600">Buyer ID</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">{request.buyerId}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm text-gray-600">Buyer Name</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">{request.buyerName}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm text-gray-600">Credit Score</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">{request.creditScore}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm text-gray-600">DTI Ratio</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">{request.dti}%</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Overview</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4">
                <div className="text-sm text-gray-600">Monthly Income</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">₹{request.monthlyIncome.toLocaleString()}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm text-gray-600">Existing EMIs</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">₹{request.existingEmis.toLocaleString()}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm text-gray-600">Fixed Expenses</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">₹{request.fixedExpenses.toLocaleString()}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm text-gray-600">Savings Buffer</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">₹{request.savingsBuffer.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Income vs Expense Breakdown</h3>
            <div className="card p-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={incomeExpenseData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6">
                    {incomeExpenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">EMI Burden</h3>
              <div className="card p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={emiBurdenData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}`}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {emiBurdenData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Debt Trap Probability</h3>
              <div className="card p-4 flex items-center justify-center h-[248px]">
                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center w-32 h-32">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#e5e7eb"
                        strokeWidth="12"
                        fill="none"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke={request.debtProbability > 40 ? '#ef4444' : request.debtProbability > 25 ? '#f59e0b' : '#10b981'}
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${(request.debtProbability / 100) * 351.86} 351.86`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute">
                      <span className="text-3xl font-bold text-gray-900">{request.debtProbability}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Breakdown</h3>
            <div className="card p-4 space-y-4">
              {riskBreakdown.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{item.label}</span>
                    <span className="font-medium text-gray-900">{item.value}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`${item.color} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button className="flex-1 btn-success">
              Approve Request
            </button>
            <button className="flex-1 btn-danger">
              Reject Request
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
