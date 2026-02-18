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
  avg_monthly_inflow: number;
  inflow_volatility: number;
  avg_monthly_outflow: number;
  min_balance_30d: number;
  neg_balance_days_30d: number;
  purchase_to_inflow_ratio: number;
  total_burden_ratio: number;
  buffer_ratio: number;
  stress_index: number;
}

export interface FairlensPredictResponse {
  risk_probability: number;
  decision: 'Approve' | 'Decline';
}
