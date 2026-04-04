export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase/server'
import { formatCurrency, NDIS_CATEGORIES } from '@/lib/utils'
import { Budget, Document } from '@/types'
import BudgetClientWrapper from '@/components/BudgetClientWrapper'

export default async function BudgetPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Get the first participant for now (MVP: single participant view)
  const { data: participants } = await supabase
    .from('participants')
    .select('*')
    .eq('user_id', user.id)
    .limit(1)

  const participant = participants?.[0] ?? null

  const currentYear = new Date().getFullYear()

  let budgets: Budget[] = []
  let documents: Document[] = []

  if (participant) {
    const [budgetsRes, docsRes] = await Promise.all([
      supabase
        .from('budgets')
        .select('*')
        .eq('participant_id', participant.id)
        .eq('plan_year', currentYear),
      supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .not('support_category', 'is', null)
        .not('amount', 'is', null),
    ])
    budgets = budgetsRes.data || []
    documents = docsRes.data || []
  }

  // Compute spending by category
  const spendingByCategory: Record<string, number> = {}
  documents.forEach(d => {
    if (d.support_category && d.amount) {
      spendingByCategory[d.support_category] = (spendingByCategory[d.support_category] || 0) + d.amount
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
        <p className="text-gray-500 mt-1">
          {currentYear} plan year · {participant?.name ?? 'No participant set up yet'}
        </p>
      </div>

      <BudgetClientWrapper
        budgets={budgets}
        spendingByCategory={spendingByCategory}
        participantId={participant?.id ?? null}
        planYear={currentYear}
      />
    </div>
  )
}
