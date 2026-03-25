export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice: number;
  discount: number;
  rating: number;
  reviewsCount: number;
  images: string[];
  description: string;
  specifications: Record<string, string>;
  highlights: string[];
  offers: Offer[];
  warranty: string;
  returnPolicy: string;
  inStock: boolean;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  type: 'bank' | 'cashback' | 'festival' | 'emi';
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  profileImage?: string;
  roles?: string[];
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  product: Product;
  quantity: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: string;
  deliveryDate?: string;
  address: Address;
  paymentMethod: string;
  emiDetails?: EMIDetails;
}

export interface EMIDetails {
  duration: number;
  monthlyPayment: number;
  bank: string;
  status: 'approved' | 'rejected' | 'pending';
  cardLastFour: string;
  applicationUuid?: string;
  assessmentId?: string;
  riskProbability?: number;
  decisionSource?: 'auto' | 'manual_override';
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'price_drop' | 'sale' | 'delivery' | 'order';
  read: boolean;
  timestamp: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

export interface AppState {
  auth: AuthState;
  cart: CartItem[];
  wishlist: Product[];
  orders: Order[];
  notifications: Notification[];
  addresses: Address[];
}

export type RequestStatus = 'Pending' | 'Approved' | 'Rejected';

export interface EMIRequest {
  id: string;
  applicationUuid?: string;
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
  autoDecision?: 'Approve' | 'Decline';
  finalDecision?: 'Approve' | 'Decline';
  decisionSource?: 'auto' | 'manual_override';
  reviewedBy?: string;
  overrideReason?: string;
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
  application_uuid?: string;
  user_sub?: string | null;
  order_amount_inr?: number | null;
  tenure_months?: number | null;
  monthly_income_inr?: number | null;
  bank?: string | null;
  card_type?: string | null;
  card_last_four_masked?: string | null;
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
  model_source?: string | null;
  auto_decision?: 'Approve' | 'Decline' | null;
  final_decision?: 'Approve' | 'Decline' | null;
  decision_source?: 'auto' | 'manual_override' | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  override_reason?: string | null;
  decision: 'Approve' | 'Decline';
  created_at: string;
  updated_at?: string;
}

export interface BackendLogsResponse {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  items: BackendLogItem[];
}

export interface CreateApplicationRequest {
  order_amount_inr: number;
  tenure_months: number;
  bank: string;
  monthly_income_inr: number;
  card_type: 'credit' | 'fairlens';
  card_last_four: string;
  metadata?: Record<string, unknown>;
}

export type StatementDirection = 'credit' | 'debit';

export interface StatementTransactionInput {
  booked_at: string;
  amount: number;
  balance: number;
  direction?: StatementDirection;
  description?: string;
}

export interface StatementFeaturePayload {
  segment: string;
  statement_window_days: number;
  purchase_amount: number;
  tenure_weeks: number;
  transactions: StatementTransactionInput[];
}

export interface WorkerDocumentItem {
  id: string;
  owner_sub?: string;
  source?: string;
  storage_key: string;
  file_name?: string | null;
  mime_type?: string | null;
  status?: string;
  extraction_job_id?: string | null;
  extraction_job_status?: string | null;
  external_job_id?: string | null;
}

export interface WorkerExtractionJobItem {
  id: string;
  document_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  external_job_id?: string | null;
  error_message?: string | null;
  document_status?: string | null;
}

export interface CreateAssessmentRequest {
  document_id: string;
  statement?: StatementFeaturePayload;
}

export interface WorkerAssessmentItem {
  id: string;
  owner_sub: string;
  document_id: string;
  extracted_feature_id?: string | null;
  risk_probability: number;
  auto_decision: 'Approve' | 'Decline';
  final_decision: 'Approve' | 'Decline';
  decision_source: 'auto' | 'manual_override';
  reviewed_by?: string | null;
  override_reason?: string | null;
}

export type BackendApplicationItem = BackendLogItem & {
  application_uuid: string;
  auto_decision: 'Approve' | 'Decline';
  final_decision: 'Approve' | 'Decline';
  decision_source: 'auto' | 'manual_override';
  updated_at: string;
};

export interface BackendApplicationsResponse {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  items: BackendApplicationItem[];
}

export interface AdminOverrideRequest {
  decision: 'Approve' | 'Decline';
  reason: string;
}

export type AuditLogStatus = 'success' | 'warning' | 'error';

export interface AuditLogItem {
  id: number;
  actor: string;
  action: string;
  details: string;
  status: AuditLogStatus;
  entity_id?: string | null;
  source?: string | null;
  created_at: string;
}

export interface BackendAuditLogsResponse {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  items: AuditLogItem[];
}

export interface DashboardAlert {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  isRead: boolean;
  timestamp: string;
}

export interface FairlensPredictRequest {
  segment: string;
  monthly_inflow: number;
  monthly_outflow: number;
  inflow_volatility_90d: number;
  outflow_volatility_90d: number;
  deposit_count_30d: number;
  days_since_last_income: number;
  avg_balance_30d: number;
  min_balance_30d: number;
  negative_balance_days_30d: number;
  essential_spend_ratio: number;
  active_loan_count: number;
  monthly_installment_burden: number;
  purchase_amount: number;
  tenure_weeks: number;
  purchase_to_inflow_ratio: number;
  installment_to_inflow_ratio: number;
  total_burden_ratio: number;
  buffer_ratio: number;
  stress_index: number;
}

export interface PredictionReason {
  code: string;
  feature: string;
  direction: 'up' | 'down';
  impact: number;
  message: string;
}

export interface FairlensPredictResponse {
  risk_probability: number;
  decision: 'Approve' | 'Decline';
  model_version: string;
  schema_version: string;
  calibration_bucket: string;
  reasons: PredictionReason[];
}

export type AssistantActionType = 'navigate' | 'retry' | 'contact' | 'none';

export interface AssistantAction {
  label: string;
  action: AssistantActionType;
  target?: string;
}

export interface AssistantEscalation {
  email: string;
  phone: string;
}

export interface AssistantQueryRequest {
  message: string;
  context?: Record<string, unknown>;
}

export interface AssistantQueryResponse {
  reply: string;
  category: 'checkout' | 'auth' | 'emi' | 'dashboard' | 'security' | 'general';
  suggested_actions: AssistantAction[];
  escalation?: AssistantEscalation;
  source?: 'rule_based' | 'remote';
}
