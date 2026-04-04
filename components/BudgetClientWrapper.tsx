'use client'

import { useState } from 'react'
import { Budget } from '@/types'
import { formatCurrency, NDIS_CATEGORIES } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import BudgetProgress from '@/components/BudgetProgress'
import { Plus, DollarSign } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  budgets: Budget[]
  spendingByCategory: Record<string, number>
  participantId: string | null
  planYear: number
}

export default function BudgetClientWrapper({ budgets, spendingByCategory, participantId, planYear }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [localBudgets, setLocalBudgets] = useState(budgets)

  async function handleAddBudget(e: React.FormEvent) {
    e.preventDefault()
    if (!participantId || !newCategory || !newAmount) return
    setSaving(true)

    const { data, error } = await supabase
      .from('budgets')
      .upsert({
        participant_id: participantId,
        support_category_code: newCategory,
        allocated_amount: parseFloat(newAmount),
        plan_year: planYear,
      }, { onConflict: 'participant_id,support_category_code,plan_year' })
      .select()
      .single()

    if (!error && data) {
      setLocalBudgets(prev => {
        const existing = prev.findIndex(b => b.support_category_code === newCategory)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = data
          return updated
        }
        return [...prev, data]
      })
      setNewCategory('')
      setNewAmount('')
      setShowAddForm(false)
      router.refresh()
    }
    setSaving(false)
  }

  // Merge budgets with spending data
  const summaries = localBudgets.map(budget => {
    const spent = spendingByCategory[budget.support_category_code] || 0
    const pct = budget.allocated_amount > 0 ? (spent / budget.allocated_amount) * 100 : 0
    const status = pct >= 100 ? 'over' : pct >= 80 ? 'warning' : 'ok'
    const cat = NDIS_CATEGORIES[budget.support_category_code]
    return {
      ...budget,
      spent,
      percentage: pct,
      status,
      categoryName: cat?.name ?? budget.support_category_code,
      categoryColor: cat?.color ?? '#7c3aed',
    }
  })

  // Also show categories with spending but no budget set
  const categoriesWithSpending = Object.entries(spendingByCategory)
    .filter(([code]) => !localBudgets.find(b => b.support_category_code === code))
    .map(([code, spent]) => {
      const cat = NDIS_CATEGORIES[code]
      return {
        code,
        spent,
        categoryName: cat?.name ?? code,
        categoryColor: cat?.color ?? '#7c3aed',
        noBudget: true,
      }
    })

  if (!participantId) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium text-gray-600">No participant set up yet</p>
        <p className="text-sm mt-1">Add a participant first to track your budget.</p>
        <a href="/participants" className="inline-block mt-4 text-primary-600 font-medium hover:underline text-sm">
          Add participant →
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Allocated</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(localBudgets.reduce((s, b) => s + b.allocated_amount, 0))}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Spent</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(Object.values(spendingByCategory).reduce((s, v) => s + v, 0))}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Remaining</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {formatCurrency(
              localBudgets.reduce((s, b) => s + b.allocated_amount, 0) -
              Object.values(spendingByCategory).reduce((s, v) => s + v, 0)
            )}
          </p>
        </div>
      </div>

      {/* Budget by category */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-semibold text-gray-900">Budget by Category</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 text-sm text-primary-600 font-medium hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Budget
          </button>
        </div>

        {/* Add budget form */}
        {showAddForm && (
          <form onSubmit={handleAddBudget} className="mb-6 p-4 bg-primary-50 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-primary-800">Add Budget Allocation</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                required
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select category…</option>
                {Object.entries(NDIS_CATEGORIES).map(([code, { name }]) => (
                  <option key={code} value={code}>{code} — {name}</option>
                ))}
              </select>
              <input
                type="number"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                placeholder="Allocated amount ($)"
                min="0"
                step="0.01"
                required
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-sm px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {summaries.length === 0 && categoriesWithSpending.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No budget allocations yet.</p>
            <p className="text-xs mt-1">Add budget categories to track your NDIS spending.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {summaries.map(s => (
              <BudgetProgress
                key={s.support_category_code}
                categoryCode={s.support_category_code}
                categoryName={s.categoryName}
                categoryColor={s.categoryColor}
                allocated={s.allocated_amount}
                spent={s.spent}
                percentage={s.percentage}
                status={s.status as 'ok' | 'warning' | 'over'}
              />
            ))}
            {categoriesWithSpending.map(c => (
              <div key={c.code} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">{c.categoryName}</span>
                  <span className="text-gray-500">{formatCurrency(c.spent)} <span className="text-gray-300">/ no budget set</span></span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-full w-full rounded-full opacity-40" style={{ backgroundColor: c.categoryColor }} />
                </div>
                <p className="text-xs text-amber-600">No budget allocated for this category</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
