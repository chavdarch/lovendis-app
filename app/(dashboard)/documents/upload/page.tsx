export const dynamic = 'force-dynamic'

import DocumentUploadClient from '@/components/DocumentUploadClient'
import { createServerClient } from '@/lib/supabase/server'

export default async function UploadPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: participants } = await supabase
    .from('participants')
    .select('id, name')
    .eq('user_id', user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Document</h1>
        <p className="text-gray-500 mt-1">Upload receipts, invoices, or therapy reports. AI will extract the key details.</p>
      </div>

      <DocumentUploadClient userId={user.id} participants={participants || []} />
    </div>
  )
}
