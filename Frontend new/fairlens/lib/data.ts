export type Role = 'user' | 'admin'
export type Page =
  | 'login'
  | 'checkout'
  | 'upload'
  | 'risk'
  | 'history'
  | 'support'
  | 'admin-dashboard'
  | 'admin-cases'
  | 'admin-case-detail'

export interface Case {
  id: string
  name: string
  product: string
  risk: 'High' | 'Moderate' | 'Low'
  score: number
  amount: string
  status: 'pending' | 'approved' | 'rejected'
}

export const CASES: Case[] = [
  { id: 'FL-2024-4821', name: 'Aarav Rao',    product: 'Sony Xperia Pro-I',   risk: 'High',     score: 78, amount: '₹1,09,990', status: 'pending'  },
  { id: 'FL-2024-4818', name: 'Priya Mehta',   product: 'Canon EOS R6',        risk: 'Moderate', score: 44, amount: '₹2,29,000', status: 'pending'  },
  { id: 'FL-2024-4815', name: 'Karan Patel',   product: 'MacBook Pro M3',      risk: 'Low',      score: 18, amount: '₹1,99,900', status: 'approved' },
  { id: 'FL-2024-4810', name: 'Rohan Singh',   product: 'Samsung QLED TV',     risk: 'Low',      score: 12, amount: '₹74,990',   status: 'approved' },
  { id: 'FL-2024-4802', name: 'Kavya Iyer',    product: 'Gaming PC',           risk: 'High',     score: 71, amount: '₹1,89,000', status: 'rejected' },
  { id: 'FL-2024-4798', name: 'Anjali Kumar',  product: 'iPad Pro M4',         risk: 'Low',      score: 22, amount: '₹1,09,900', status: 'approved' },
  { id: 'FL-2024-4791', name: 'Dev Sharma',    product: 'OnePlus 12',          risk: 'Moderate', score: 51, amount: '₹64,999',   status: 'pending'  },
  { id: 'FL-2024-4785', name: 'Meera Nair',    product: 'Dyson V15',           risk: 'Low',      score: 15, amount: '₹54,900',   status: 'approved' },
]

export const BOT_RESPONSES: Record<string, string> = {
  rejected: "Your EMI may be rejected due to a high debt-to-income ratio or low credit score. I'd recommend paying down existing loans before reapplying.",
  risk:      "Your risk score is calculated using 5 factors: Credit Score (25%), DTI Ratio (30%), Savings Buffer (20%), Payment History (15%), and Income Stability (10%).",
  documents: "You'll need: ✓ Last 3 months bank statement ✓ PAN Card ✓ Latest salary slips ✓ CIBIL report (optional)",
  review:    "Bank review typically takes 1–2 business days. You'll receive an email/SMS once a decision is made.",
  emi:       "EMI stands for Equated Monthly Installment. FairLens uses AI to assess if the EMI amount is sustainable for your income profile.",
  default:   "Based on your current profile, I'd recommend reviewing your debt-to-income ratio. The FairLens AI engine analyzes 40+ data points to ensure responsible lending.",
}

export function getBotResponse(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('reject'))                   return BOT_RESPONSES.rejected
  if (m.includes('risk') || m.includes('score')) return BOT_RESPONSES.risk
  if (m.includes('document') || m.includes('need')) return BOT_RESPONSES.documents
  if (m.includes('review') || m.includes('long'))   return BOT_RESPONSES.review
  if (m.includes('emi'))                       return BOT_RESPONSES.emi
  return BOT_RESPONSES.default
}
