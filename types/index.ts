export interface Participant {
  id: string
  user_id: string
  name: string
  ndis_number: string | null
  plan_start_date: string | null
  plan_end_date: string | null
  created_at: string
}

export interface Document {
  id: string
  user_id: string
  participant_id: string | null
  file_name: string
  file_url: string
  file_type: 'receipt' | 'invoice' | 'therapy_report' | 'plan_review' | 'other' | null
  doc_date: string | null
  provider_name: string | null
  amount: number | null
  support_category: string | null
  support_item_number: string | null
  description: string | null
  ai_extracted: boolean
  ai_confidence: number | null
  raw_ai_response: AIExtractionResult | null
  notes: string | null
  created_at: string
  // Joined data
  support_categories?: SupportCategory
  participants?: Participant
}

export interface SupportCategory {
  id: number
  code: string
  name: string
  description: string | null
  color: string | null
}

export interface Budget {
  id: string
  participant_id: string
  support_category_code: string
  allocated_amount: number
  plan_year: number
  created_at: string
  // Joined data
  support_categories?: SupportCategory
}

export interface AIExtractionResult {
  provider_name: string | null
  doc_date: string | null
  amount: number | null
  document_type: string | null
  support_category: string | null
  description: string | null
  confidence: number
}

export interface BudgetSummary {
  category_code: string
  category_name: string
  category_color: string
  allocated: number
  spent: number
  percentage: number
  status: 'ok' | 'warning' | 'over'
}

export interface DashboardStats {
  totalDocuments: number
  totalSpending: number
  documentsNeedingReview: number
  daysUntilPlanEnd: number | null
  recentDocuments: Document[]
  spendingByCategory: BudgetSummary[]
}
