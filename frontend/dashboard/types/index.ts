export type RequestStatus = 'Pending' | 'Approved' | 'Rejected';

export interface EMIRequest {
  id: string;
  buyerId: string;
  buyerName: string;
  creditScore: number;
  dti: number;
  riskScore: number;
  debtProbability: number;
  emiAmount: number;
  productCategory: string;
  status: RequestStatus;
  monthlyIncome: number;
  existingEmis: number;
  fixedExpenses: number;
  savingsBuffer: number;
  creditScoreWeight: number;
  dtiWeight: number;
  emiLoad: number;
  savingsWeight: number;
  stabilityScore: number;
  riskProbability: number;
  createdAt: string;
}

export interface BackendStats {
  total_predictions: number;
  approval_rate: number;
  decline_rate: number;
  risk_score_distribution: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface BackendLogItem {
  id: number;
  avg_monthly_inflow: number;
  inflow_volatility: number;
  avg_monthly_outflow: number;
  min_balance_30d: number;
  neg_balance_days_30d: number;
  purchase_to_inflow_ratio: number;
  total_burden_ratio: number;
  buffer_ratio: number;
  stress_index: number;
  risk_probability: number;
  decision: 'Approve' | 'Decline';
  created_at: string;
}

export interface BackendLogsResponse {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  items: BackendLogItem[];
}

export interface DashboardAlert {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  isRead: boolean;
  timestamp: string;
}
