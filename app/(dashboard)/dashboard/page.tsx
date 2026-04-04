import { createServerClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, getGreeting, daysUntil, NDIS_CATEGORIES } from '@/lib/utils'
import { Document } from '@/types'
import Link from 'next/link'
import { FileText, DollarSign, AlertCircle, Calendar } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch data in parallel
  const [documentsResult, participantsResult] = await Promise.all([
    supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('participants')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const documents: Document[] = documentsResult.data || []
  const participant = participantsResult.data?.[0] ?? null

  // Stats
  const totalDocuments = documents.length
  const currentYear = new Date().getFullYear()
  const totalSpending = documents
    .filter(d => d.amount && new Date(d.created_at).getFullYear() === currentYear)
    .reduce((sum, d) => sum + (d.amount || 0), 0)
  const docsNeedingReview = documents.filter(d => !d.support_category).length
  const planDaysLeft = daysUntil(participant?.plan_end_date ?? null)
  const recentDocuments = documents.slice(0, 5)

  // Spending by category
  const spendingByCategory: Record<string, number> = {}
  documents.forEach(d => {
    if (d.support_category && d.amount) {
      spendingByCategory[d.support_category] = (spendingByCategory[d.support_category] || 0) + d.amount
    }
  })
  const topCategories = Object.entries(spendingByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  const maxAmount = Math.max(...topCategories.map(([, v]) => v), 1)

  const greeting = getGreeting()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, {user.email?.split('@')[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening with your NDIS plan.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5 text-primary-600" />}
          bg="bg-primary-50"
          label="Total Documents"
          value={totalDocuments.toString()}
          sub="uploaded"
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5 text-teal-600" />}
          bg="bg-teal-50"
          label="Total Spending"
          value={formatCurrency(totalSpending)}
          sub={`${currentYear} plan year`}
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-amber-600" />}
          bg="bg-amber-50"
          label="Needs Review"
          value={docsNeedingReview.toString()}
          sub="uncategorised docs"
          href={docsNeedingReview > 0 ? '/documents' : undefined}
        />
        <StatCard
          icon={<Calendar className="w-5 h-5 text-blue-600" />}
          bg="bg-blue-50"
          label="Days Until Plan End"
          value={planDaysLeft !== null ? planDaysLeft.toString() : '—'}
          sub={participant?.plan_end_date ? formatDate(participant.plan_end_date) : 'No plan set'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Spending by Category Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Spending by Category</h2>
          {topCategories.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No spending data yet</p>
              <Link href="/documents" className="text-primary-600 text-sm font-medium hover:underline mt-1 inline-block">
                Upload your first document →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {topCategories.map(([code, amount]) => {
                const cat = NDIS_CATEGORIES[code]
                const pct = (amount / maxAmount) * 100
                return (
                  <div key={code}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">{cat?.name ?? code}</span>
                      <span className="text-gray-500">{formatCurrency(amount)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: cat?.color ?? '#7c3aed' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Documents */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold text-gray-900">Recent Documents</h2>
            <Link href="/documents" className="text-primary-600 text-sm font-medium hover:underline">
              View all
            </Link>
          </div>
          {recentDocuments.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No documents yet</p>
              <Link href="/documents/upload" className="text-primary-600 text-sm font-medium hover:underline mt-1 inline-block">
                Upload your first document →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDocuments.map(doc => (
                <div key={doc.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {doc.provider_name || doc.file_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(doc.doc_date || doc.created_at)}
                      {doc.amount && ` · ${formatCurrency(doc.amount)}`}
                    </p>
                  </div>
                  {!doc.support_category && (
                    <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">
                      Review
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  bg,
  label,
  value,
  sub,
  href,
}: {
  icon: React.ReactNode
  bg: string
  label: string
  value: string
  sub: string
  href?: string
}) {
  const content = (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`${bg} w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}
