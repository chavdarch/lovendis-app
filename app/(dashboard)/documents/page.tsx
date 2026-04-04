export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, NDIS_CATEGORIES } from '@/lib/utils'
import { Document } from '@/types'
import Link from 'next/link'
import { Upload, FileText, Trash2, ExternalLink } from 'lucide-react'
import CategoryBadge from '@/components/CategoryBadge'
import DocumentsClientWrapper from '@/components/DocumentsClientWrapper'

export default async function DocumentsPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const docs: Document[] = documents || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500 mt-1">{docs.length} document{docs.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link
          href="/documents/upload"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 px-5 rounded-xl transition-colors shadow-sm"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </Link>
      </div>

      {/* Documents table */}
      <DocumentsClientWrapper initialDocuments={docs} userId={user.id} />
    </div>
  )
}
