import { NDIS_CATEGORIES } from '@/lib/utils'

interface Props {
  code: string
  showCode?: boolean
}

export default function CategoryBadge({ code, showCode = false }: Props) {
  const cat = NDIS_CATEGORIES[code]
  const color = cat?.color ?? '#7c3aed'
  const name = cat?.name ?? code

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${color}18`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      {showCode && <span className="font-mono opacity-70">{code}</span>}
      {name}
    </span>
  )
}
