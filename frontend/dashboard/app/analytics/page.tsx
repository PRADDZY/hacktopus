'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BackendLogItem, BackendStats } from '@/types';
import { fetchLogs, fetchStats } from '@/utils/fairlensApi';

type MonthlyRiskPoint = {
  month: string;
  predicted: number;
  actual: number;
};

type MonthlyDistributionPoint = {
  month: string;
  low: number;
  medium: number;
  high: number;
};

const initialStats: BackendStats = {
  total_predictions: 0,
  approval_rate: 0,
  decline_rate: 0,
  risk_score_distribution: { low: 0, medium: 0, high: 0 },
};

const formatMonth = (isoDate: string): string =>
  new Date(isoDate).toLocaleString('en-US', { month: 'short' });

export default function AnalyticsPage() {
  const [stats, setStats] = useState<BackendStats>(initialStats);
  const [logs, setLogs] = useState<BackendLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [statsData, logsData] = await Promise.all([fetchStats(), fetchLogs(1, 200)]);
        if (isCancelled) return;

        setStats(statsData);
        setLogs(logsData.items);
      } catch (loadError) {
        if (isCancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load analytics');
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      isCancelled = true;
    };
  }, []);

  const { monthlyDefaultData, riskTrendData, topRiskFactors } = useMemo(() => {
    const grouped = new Map<
      string,
      { count: number; riskSum: number; declines: number; low: number; medium: number; high: number }
    >();

    logs.forEach((log) => {
      const month = formatMonth(log.created_at);
      if (!grouped.has(month)) {
        grouped.set(month, {
          count: 0,
          riskSum: 0,
          declines: 0,
          low: 0,
          medium: 0,
          high: 0,
        });
      }

      const bucket = grouped.get(month)!;
      bucket.count += 1;
      bucket.riskSum += log.risk_probability;
      if (log.decision === 'Decline') bucket.declines += 1;

      if (log.risk_probability < 0.33) bucket.low += 1;
      else if (log.risk_probability < 0.66) bucket.medium += 1;
      else bucket.high += 1;
    });

    const monthlyDefaultData: MonthlyRiskPoint[] = Array.from(grouped.entries()).map(
      ([month, data]) => ({
        month,
        predicted: Number(((data.riskSum / Math.max(data.count, 1)) * 100).toFixed(2)),
        actual: Number(((data.declines / Math.max(data.count, 1)) * 100).toFixed(2)),
      })
    );

    const riskTrendData: MonthlyDistributionPoint[] = Array.from(grouped.entries()).map(
      ([month, data]) => ({
        month,
        low: Number(((data.low / Math.max(data.count, 1)) * 100).toFixed(2)),
        medium: Number(((data.medium / Math.max(data.count, 1)) * 100).toFixed(2)),
        high: Number(((data.high / Math.max(data.count, 1)) * 100).toFixed(2)),
      })
    );

    const average = (selector: (log: BackendLogItem) => number): number => {
      if (logs.length === 0) return 0;
      const value = Math.round((logs.reduce((sum, item) => sum + selector(item), 0) / logs.length) * 100);
      return Math.max(0, Math.min(100, value));
    };

    const topRiskFactors = [
      { label: 'Total Burden Ratio', value: average((log) => log.total_burden_ratio), color: 'bg-red-500' },
      { label: 'Purchase to Inflow Ratio', value: average((log) => log.purchase_to_inflow_ratio), color: 'bg-amber-500' },
      { label: 'Inflow Volatility', value: average((log) => log.inflow_volatility), color: 'bg-blue-500' },
      { label: 'Stress Index', value: average((log) => log.stress_index), color: 'bg-purple-500' },
    ];

    return { monthlyDefaultData, riskTrendData, topRiskFactors };
  }, [logs]);

  const approvalRatePercent = Math.round(stats.approval_rate * 100);
  const declineRatePercent = Math.round(stats.decline_rate * 100);
  const avgRiskPercent =
    logs.length === 0
      ? 0
      : Math.round((logs.reduce((sum, item) => sum + item.risk_probability, 0) / logs.length) * 100);

  const distribution = stats.risk_score_distribution;
  const distributionTotal = distribution.low + distribution.medium + distribution.high || 1;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-600 mt-1">Track risk trends and default predictions</p>
      </div>

      {error && (
        <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <p className="text-sm text-gray-600">Approval Rate</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{approvalRatePercent}%</p>
          <p className="text-xs text-green-600 mt-2">From live /stats endpoint</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-600">Decline Rate</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{declineRatePercent}%</p>
          <p className="text-xs text-red-600 mt-2">Model decline outcomes</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-600">Avg Risk Probability</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{avgRiskPercent}%</p>
          <p className="text-xs text-blue-600 mt-2">From latest transactions</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-600">Total Transactions</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.total_predictions}</p>
          <p className="text-xs text-gray-600 mt-2">Stored in PostgreSQL</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Monthly Default Prediction</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={monthlyDefaultData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="predicted" stroke="#3b82f6" strokeWidth={2} name="Average Risk %" />
            <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} name="Actual Decline %" />
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
            {topRiskFactors.map((factor) => (
              <div key={factor.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{factor.label}</span>
                  <span className="font-medium text-gray-900">{factor.value}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`${factor.color} h-2 rounded-full`} style={{ width: `${factor.value}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Distribution</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-700">Low Risk</span>
              <span className="text-sm font-medium text-gray-900">
                {Math.round((distribution.low / distributionTotal) * 100)}%
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-700">Medium Risk</span>
              <span className="text-sm font-medium text-gray-900">
                {Math.round((distribution.medium / distributionTotal) * 100)}%
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-700">High Risk</span>
              <span className="text-sm font-medium text-gray-900">
                {Math.round((distribution.high / distributionTotal) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading analytics...</div>}
    </div>
  );
}
