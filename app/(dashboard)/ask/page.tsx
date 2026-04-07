import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DocumentRAGChat } from '@/components/DocumentRAGChat'

export default async function AskPage() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  // Get user's documents to show document count
  const { data: documents } = await supabase
    .from('documents')
    .select('id')
    .eq('user_id', session.user.id)

  const documentCount = documents?.length || 0

  return (
    <div className="h-screen flex flex-col">
      {/* Header with document info */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ask Your Documents</h1>
          <p className="text-sm text-gray-600">
            {documentCount > 0
              ? `Search and ask questions about your ${documentCount} uploaded documents`
              : 'Upload documents first to start asking questions'}
          </p>
        </div>
      </div>

      {/* Chat Interface */}
      {documentCount > 0 ? (
        <DocumentRAGChat />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-6 max-w-md">
            <div className="text-6xl">📚</div>
            <h2 className="text-2xl font-bold text-gray-900">No documents yet</h2>
            <p className="text-gray-600">
              Upload your NDIS documents (invoices, receipts, therapy reports) to start asking
              questions powered by AI.
            </p>
            <a
              href="/dashboard/documents/upload"
              className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Upload Documents
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
