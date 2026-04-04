import { formatCurrency, NDIS_CATEGORIES } from '@/lib/utils'

interface Props {
  data: Record<string, number>
  maxBars?: number
}

export default function SpendingChart({ data, maxBars = 8 }: Props) {
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxBars)

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400 text-sm">
        No spending data to display yet.
      </div>
    )
  }

  const maxVal = Math.max(...entries.map(([, v]) => v))

  return (
    <div className="space-y-2.5">
      {entries.map(([code, amount]) => {
        const cat = NDIS_CATEGORIES[code]
        const pct = (amount / maxVal) * 100
        return (
          <div key={code} className="flex items-center gap-3">
            <div className="w-32 text-right flex-shrink-0">
              <span className="text-xs text-gray-500 truncate block">{cat?.name ?? code}</span>
            </div>
            <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg flex items-center justify-end pr-2"
                style={{ width: `${pct}%`, backgroundColor: cat?.color ?? '#7c3aed' }}
              >
                <span className="text-white text-xs font-medium whitespace-nowrap">
                  {formatCurrency(amount)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
