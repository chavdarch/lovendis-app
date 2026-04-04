import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount)
}

export function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '…'
}

export const NDIS_CATEGORIES: Record<string, { name: string; color: string }> = {
  '01': { name: 'Daily Activities', color: '#7c3aed' },
  '02': { name: 'Health & Wellbeing', color: '#0d9488' },
  '03': { name: 'Home Living', color: '#d97706' },
  '04': { name: 'Lifelong Learning', color: '#2563eb' },
  '05': { name: 'Work', color: '#16a34a' },
  '06': { name: 'Social & Community', color: '#dc2626' },
  '07': { name: 'Relationships', color: '#db2777' },
  '08': { name: 'Choice & Control', color: '#7c3aed' },
  '09': { name: 'Daily Activities (CB)', color: '#6d28d9' },
  '10': { name: 'Plan Management', color: '#4f46e5' },
  '11': { name: 'Support Coordination', color: '#0891b2' },
  '12': { name: 'Improved Living', color: '#ca8a04' },
  '13': { name: 'Improved Health', color: '#16a34a' },
  '14': { name: 'Improved Learning', color: '#2563eb' },
  '15': { name: 'Increased Work', color: '#059669' },
}
