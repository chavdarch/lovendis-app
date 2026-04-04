'use client'

import { useState } from 'react'
import { Participant } from '@/types'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Users, Plus, Trash2, Edit2, Save, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  initialParticipants: Participant[]
  userId: string
}

const emptyForm = {
  name: '',
  ndis_number: '',
  plan_start_date: '',
  plan_end_date: '',
}

export default function ParticipantsClientWrapper({ initialParticipants, userId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [participants, setParticipants] = useState(initialParticipants)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data, error } = await supabase
      .from('participants')
      .insert({
        user_id: userId,
        name: form.name,
        ndis_number: form.ndis_number || null,
        plan_start_date: form.plan_start_date || null,
        plan_end_date: form.plan_end_date || null,
      })
      .select()
      .single()

    if (!error && data) {
      setParticipants(prev => [...prev, data])
      setForm(emptyForm)
      setShowAddForm(false)
    }
    setSaving(false)
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    const { data, error } = await supabase
      .from('participants')
      .update({
        name: editForm.name,
        ndis_number: editForm.ndis_number || null,
        plan_start_date: editForm.plan_start_date || null,
        plan_end_date: editForm.plan_end_date || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (!error && data) {
      setParticipants(prev => prev.map(p => p.id === id ? data : p))
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this participant? All associated documents will be unlinked.')) return
    setDeletingId(id)
    await supabase.from('participants').delete().eq('id', id)
    setParticipants(prev => prev.filter(p => p.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 px-5 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Participant
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">New Participant</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                  placeholder="Full name"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NDIS Number</label>
                <input
                  value={form.ndis_number}
                  onChange={e => setForm(p => ({ ...p, ndis_number: e.target.value }))}
                  placeholder="4XXXXXXXXX"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Start Date</label>
                <input
                  type="date"
                  value={form.plan_start_date}
                  onChange={e => setForm(p => ({ ...p, plan_start_date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan End Date</label>
                <input
                  type="date"
                  value={form.plan_end_date}
                  onChange={e => setForm(p => ({ ...p, plan_end_date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-60"
              >
                {saving ? 'Adding…' : 'Add Participant'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setForm(emptyForm) }}
                className="px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Participants list */}
      {participants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-600">No participants yet</p>
          <p className="text-sm mt-1">Add the NDIS participants in your family to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {participants.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              {editingId === p.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={editForm.name}
                      onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Name"
                    />
                    <input
                      value={editForm.ndis_number}
                      onChange={e => setEditForm(prev => ({ ...prev, ndis_number: e.target.value }))}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="NDIS Number"
                    />
                    <input
                      type="date"
                      value={editForm.plan_start_date}
                      onChange={e => setEditForm(prev => ({ ...prev, plan_start_date: e.target.value }))}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <input
                      type="date"
                      value={editForm.plan_end_date}
                      onChange={e => setEditForm(prev => ({ ...prev, plan_end_date: e.target.value }))}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(p.id)}
                      disabled={saving}
                      className="flex items-center gap-1.5 text-sm bg-primary-600 text-white px-4 py-2 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-700 font-bold text-lg">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{p.name}</h3>
                      {p.ndis_number && (
                        <p className="text-sm text-gray-500">NDIS: {p.ndis_number}</p>
                      )}
                      <div className="flex gap-4 mt-1">
                        {p.plan_start_date && (
                          <p className="text-xs text-gray-400">
                            Plan: {formatDate(p.plan_start_date)} → {p.plan_end_date ? formatDate(p.plan_end_date) : 'ongoing'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(p.id)
                        setEditForm({
                          name: p.name,
                          ndis_number: p.ndis_number || '',
                          plan_start_date: p.plan_start_date || '',
                          plan_end_date: p.plan_end_date || '',
                        })
                      }}
                      className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
