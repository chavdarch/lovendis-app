'use client'

import { useState } from 'react'
import { Search, Loader2, AlertCircle, X, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

interface SearchResult {
  id: string
  file_name: string
  provider_name: string | null
  description: string | null
  support_category: string | null
  doc_date: string | null
  amount: number | null
  similarity_score: number
}

interface Props {
  userId: string
  participantId?: string
}

export default function DocumentSearch({ userId, participantId }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setFallback(false)

    try {
      const res = await fetch('/api/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          limit: 10,
          participant_id: participantId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Search failed')
        return
      }

      setResults(data.results || [])
      setSearched(true)
      if (data.fallback) {
        setFallback(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setSearched(false)
    setError(null)
  }

  return (
    <div className="space-y-4">
      {/* Search box */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search documents by provider, service, date..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">Searching…</span>
            </>
          ) : (
            'Search'
          )}
        </button>
      </form>

      {/* Fallback notice */}
      {fallback && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Using keyword search (embeddings not available). Results may be less precise.
          </span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {searched && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {results.length === 0
                ? 'No documents found'
                : `Found ${results.length} document${results.length !== 1 ? 's' : ''}`}
            </p>
            {results.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear
              </button>
            )}
          </div>

          {results.map(result => (
            <Link
              key={result.id}
              href={`/documents/${result.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900 truncate text-sm">
                      {result.provider_name || 'Unknown Provider'}
                    </h4>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-medium text-primary-600">
                        {Math.round(result.similarity_score * 100)}% match
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 truncate mb-2">
                    {result.file_name}
                  </p>
                  {result.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {result.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {result.doc_date && <span>{formatDate(result.doc_date)}</span>}
                    {result.amount && (
                      <>
                        <span className="w-1 h-1 bg-gray-300 rounded-full" />
                        <span>{formatCurrency(result.amount)}</span>
                      </>
                    )}
                    {result.support_category && (
                      <>
                        <span className="w-1 h-1 bg-gray-300 rounded-full" />
                        <span>Category {result.support_category}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
