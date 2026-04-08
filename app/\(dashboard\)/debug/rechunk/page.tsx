export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase/server'

export default async function RechunkPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Re-chunk Documents</h1>
        <p className="text-gray-600 mt-2">Create chunks from your existing documents for RAG</p>
      </div>

      <RechunkButton userId={user.id} />
    </div>
  )
}

function RechunkButton({ userId }: { userId: string }) {
  'use client'

  const [loading, setLoading] = require('react').useState(false)
  const [result, setResult] = require('react').useState<any>(null)
  const [error, setError] = require('react').useState<string | null>(null)

  const handleRechunk = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/documents/rechunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.success) {
        setResult(data)
      } else {
        setError(data.error || 'Failed to rechunk')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleRechunk}
        disabled={loading}
        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-2.5 px-5 rounded-xl transition-colors disabled:cursor-not-allowed"
      >
        {loading ? 'Processing...' : 'Start Re-chunking'}
      </button>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-900 font-semibold">✅ Success!</p>
          <p className="text-green-700 mt-1">{result.message}</p>
          <p className="text-green-600 text-sm mt-2">
            Documents: {result.documents_processed} | Chunks: {result.chunks_created}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-900 font-semibold">❌ Error</p>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}
    </div>
  )
}
