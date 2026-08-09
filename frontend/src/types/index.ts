export interface Complaint {
  id: number
  title: string
  description: string
  structured_data?: string
  crime_type?: string
  amount?: number
  phone_number?: string
  upi_id?: string
  bank_name?: string
  risk_score: number
  duplicate_score?: number
  status: string
  agency?: string
  citizen_name: string
  citizen_email: string
  assigned_officer?: string
  evidence_hash?: string
  blockchain_tx?: string
  created_at: string
  updated_at?: string
}

export interface AuditLog {
  action: string
  performed_by: string
  details?: string
  timestamp: string
}

export interface ComplaintDetail {
  complaint: Complaint
  ai_analysis: Record<string, any>
  audit_logs: AuditLog[]
  duplicates: { id: number; title: string; risk_score: number; similarity: number }[]
  evidence_status: string
}

export interface ScamCheckResult {
  found: boolean
  message: string
  risk: string
  risk_score?: number
  total_reports: number
  complaints?: { id: number; title: string; crime_type: string; status: string; created_at: string }[]
}

export interface DashboardStats {
  total_complaints: number
  pending_review: number
  under_investigation: number
  resolved: number
  high_risk: number
  blockchain_verified: number
  unverified: number
  recent_7_days: number
}

export interface GraphNode {
  id: string
  label: string
  type: 'complaint' | 'phone' | 'upi'
  risk: number
  crime?: string
  title?: string
}

export interface GraphEdge {
  source: string
  target: string
  label: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface User {
  name: string
  email: string
  role: string
  cases?: number
  lastActive?: string
}

export interface Agency {
  id: number
  name: string
  cases: number
  status: string
}

export interface SafetyTip {
  id: number
  category: string
  title: string
  description: string
  icon: string
  severity: string
}

export interface AIMonitoring {
  total_processed: number
  success_rate: number
  failed: number
  avg_risk_score: number
  recent_errors: string[]
}

export interface ThreatCampaign {
  indicator: string
  type: string
  complaint_count: number
  risk_level: string
}

export interface DigitalSignature {
  exists: boolean
  verified?: boolean
  public_key_pem?: string
  algorithm?: string
  created_at?: string
  signed_hash?: string
}

export interface CopilotMessage {
  id: string
  role: 'ai' | 'user'
  content: string
}

export interface SignatureSubmit {
  complaint_id: number
  public_key_pem: string
  signature_hex: string
  signed_hash: string
  algorithm: string
}
