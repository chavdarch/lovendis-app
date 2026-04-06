'use client'

import { useState, useCallback } from 'react'
import { Document } from '@/types'
import { formatCurrency, formatDate, NDIS_CATEGORIES } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { FileText, Trash2, ExternalLink, Filter, Search } from 'lucide-react'
import CategoryBadge from '@/components/CategoryBadge'
import { useRouter } from 'next/navigation'

interface Props {
  initialDocuments: Document[]
  userId: string
}

export default function DocumentsClientWrapper({ initialDocuments, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [documents, setDocuments] = useState(initialDocuments)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterType, setFilterType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Document[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch('/api/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, query, limit: 10 }),
      })
      const data = await res.json()
      setSearchResults(data.results || [])
    } catch (err) {
      console.error('Search error:', err)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [userId])

  const displayDocs = searchQuery.trim() ? searchResults : documents

  const filtered = displayDocs.filter(doc => {
    if (filterCategory && doc.support_category !== filterCategory) return false
    if (filterType && doc.file_type !== filterType) return false
    return true
  })

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return
    setDeletingId(doc.id)

    // Delete from storage
    const storagePath = `${userId}/${doc.file_name}`
    await supabase.storage.from('documents').remove([storagePath])

    // Delete from database
    await supabase.from('documents').delete().eq('id', doc.id)

    setDocuments(prev => prev.filter(d => d.id !== doc.id))
    setDeletingId(null)
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <input
          type="text"
          placeholder="Search documents by provider, description, or keyword..."
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        />
        {isSearching && <p className="text-xs text-gray-400 mt-2">Searching...</p>}
        {searchQuery && !isSearching && <p className="text-xs text-gray-400 mt-2">Found {filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All categories</option>
          {Object.entries(NDIS_CATEGORIES).map(([code, { name }]) => (
            <option key={code} value={code}>{code} — {name}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All types</option>
          <option value="receipt">Receipt</option>
          <option value="invoice">Invoice</option>
          <option value="therapy_report">Therapy Report</option>
          <option value="plan_review">Plan Review</option>
          <option value="other">Other</option>
        </select>
        {(filterCategory || filterType) && (
          <button
            onClick={() => { setFilterCategory(''); setFilterType('') }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear filters
          </button>
        )}
        {!searchQuery && <span className="text-xs text-gray-400 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No documents found</p>
          <p className="text-sm mt-1">Try adjusting your filters or upload a new document.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Desktop table header */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_100px_1fr_120px_80px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <div>Document</div>
            <div>Provider</div>
            <div>Amount</div>
            <div>Category</div>
            <div>Date</div>
            <div>Actions</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {filtered.map(doc => (
              <div
                key={doc.id}
                className="md:grid md:grid-cols-[1fr_1fr_100px_1fr_120px_80px] gap-4 px-6 py-4 flex flex-col gap-2 hover:bg-gray-50/50 transition-colors"
              >
                {/* File name */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                    <p className="text-xs text-gray-400 md:hidden">{formatDate(doc.doc_date || doc.created_at)}</p>
                  </div>
                </div>

                {/* Provider */}
                <div className="flex items-center text-sm text-gray-600">
                  {doc.provider_name || <span className="text-gray-300">—</span>}
                </div>

                {/* Amount */}
                <div className="flex items-center text-sm font-medium text-gray-900">
                  {doc.amount ? formatCurrency(doc.amount) : <span className="text-gray-300">—</span>}
                </div>

                {/* Category */}
                <div className="flex items-center">
                  {doc.support_category ? (
                    <CategoryBadge code={doc.support_category} />
                  ) : (
                    <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-medium">
                      Needs review
                    </span>
                  )}
                </div>

                {/* Date */}
                <div className="hidden md:flex items-center text-sm text-gray-500">
                  {formatDate(doc.doc_date || doc.created_at)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                    title="View document"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
