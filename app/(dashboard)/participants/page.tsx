export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import ParticipantsClientWrapper from '@/components/ParticipantsClientWrapper'

export default async function ParticipantsPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: participants } = await supabase
    .from('participants')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Participants</h1>
        <p className="text-gray-500 mt-1">Manage NDIS participants in your family</p>
      </div>

      <ParticipantsClientWrapper
        initialParticipants={participants || []}
        userId={user.id}
      />
    </div>
  )
}
