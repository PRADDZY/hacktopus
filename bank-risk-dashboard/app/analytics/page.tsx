'use client';

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { monthlyDefaultData, riskTrendData } from '@/lib/mockData';

export default function AnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-600 mt-1">Track risk trends and default predictions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <p className="text-sm text-gray-600">Avg Default Rate</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">2.6%</p>
          <p className="text-xs text-green-600 mt-2">↓ 0.3% from last month</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-600">Total Volume</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">₹12.4M</p>
          <p className="text-xs text-blue-600 mt-2">↑ 8.2% from last month</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-600">Approval Rate</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">68%</p>
          <p className="text-xs text-green-600 mt-2">↑ 2.1% from last month</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-600">High Risk Cases</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">142</p>
          <p className="text-xs text-red-600 mt-2">↑ 5 from last month</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Monthly Default Prediction</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={monthlyDefaultData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis label={{ value: 'Default Rate (%)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="predicted" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Predicted Default Rate"
            />
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Actual Default Rate"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Risk Distribution Trend</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={riskTrendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="low" stackId="a" fill="#10b981" name="Low Risk" />
            <Bar dataKey="medium" stackId="a" fill="#f59e0b" name="Medium Risk" />
            <Bar dataKey="high" stackId="a" fill="#ef4444" name="High Risk" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Risk Factors</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">High DTI Ratio</span>
                <span className="font-medium text-gray-900">42%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full" style={{ width: '42%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">Low Credit Score</span>
                <span className="font-medium text-gray-900">35%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: '35%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">Multiple EMIs</span>
                <span className="font-medium text-gray-900">28%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '28%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">Low Savings Buffer</span>
                <span className="font-medium text-gray-900">22%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '22%' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Distribution</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-700">Electronics</span>
              <span className="text-sm font-medium text-gray-900">28%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-700">Furniture</span>
              <span className="text-sm font-medium text-gray-900">22%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-700">Home Appliances</span>
              <span className="text-sm font-medium text-gray-900">18%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-700">Automotive</span>
              <span className="text-sm font-medium text-gray-900">15%</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-700">Others</span>
              <span className="text-sm font-medium text-gray-900">17%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
