import { formatCurrency } from '@/lib/utils'

interface Props {
  categoryCode: string
  categoryName: string
  categoryColor: string
  allocated: number
  spent: number
  percentage: number
  status: 'ok' | 'warning' | 'over'
}

export default function BudgetProgress({
  categoryCode,
  categoryName,
  categoryColor,
  allocated,
  spent,
  percentage,
  status,
}: Props) {
  const barColor =
    status === 'over'
      ? '#dc2626'
      : status === 'warning'
      ? '#d97706'
      : categoryColor

  const pct = Math.min(percentage, 100)

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: categoryColor }}
          />
          <span className="text-sm font-medium text-gray-800">{categoryName}</span>
          <span className="text-xs text-gray-400 font-mono">{categoryCode}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-semibold text-gray-900">{formatCurrency(spent)}</span>
          <span className="text-xs text-gray-400"> / {formatCurrency(allocated)}</span>
        </div>
      </div>

      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>

      <div className="flex justify-between items-center">
        <span
          className={`text-xs font-medium ${
            status === 'over'
              ? 'text-red-600'
              : status === 'warning'
              ? 'text-amber-600'
              : 'text-gray-400'
          }`}
        >
          {status === 'over'
            ? `⚠️ Over budget by ${formatCurrency(spent - allocated)}`
            : status === 'warning'
            ? `🟡 ${Math.round(percentage)}% used — approaching limit`
            : `${Math.round(percentage)}% used`}
        </span>
        <span className="text-xs text-gray-400">
          {formatCurrency(Math.max(0, allocated - spent))} remaining
        </span>
      </div>
    </div>
  )
}
