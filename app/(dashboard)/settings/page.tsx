import { createServerClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      {/* Account info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Account</h2>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Email address</label>
          <p className="text-gray-900 font-medium">{user.email}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Account ID</label>
          <p className="text-gray-400 text-xs font-mono">{user.id}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Member since</label>
          <p className="text-gray-700 text-sm">
            {new Date(user.created_at).toLocaleDateString('en-AU', { dateStyle: 'long' })}
          </p>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">Data & Privacy</h2>
        <p className="text-sm text-gray-500">
          Your documents and data are stored securely and privately. Only you can access them.
          loveNDIS uses Supabase Row Level Security (RLS) to ensure your data is isolated.
        </p>
        <div className="bg-primary-50 rounded-xl p-4 text-sm text-primary-800">
          ✅ All data is encrypted at rest and in transit<br />
          ✅ Row Level Security enforced at the database level<br />
          ✅ Document files are stored in private Supabase Storage
        </div>
      </div>

      {/* Version */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-3">About loveNDIS</h2>
        <p className="text-sm text-gray-500">Version 0.1.0 — MVP</p>
        <p className="text-sm text-gray-400 mt-1">
          Family-first NDIS document management. Built with ❤️ for Australian families.
        </p>
      </div>
    </div>
  )
}
