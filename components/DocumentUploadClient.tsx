'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AIExtractionResult } from '@/types'
import { NDIS_CATEGORIES, formatCurrency } from '@/lib/utils'
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, X } from 'lucide-react'

interface Participant {
  id: string
  name: string
}

interface Props {
  userId: string
  participants: Participant[]
}

type UploadState = 'idle' | 'uploading' | 'extracting' | 'review' | 'saving' | 'done' | 'error'

export default function DocumentUploadClient({ userId, participants }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [docId, setDocId] = useState<string | null>(null)

  // Extracted fields (editable)
  const [extracted, setExtracted] = useState<Partial<AIExtractionResult>>({})
  const [participantId, setParticipantId] = useState('')
  const [notes, setNotes] = useState('')

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const f = acceptedFiles[0]
    if (!f) return

    setFile(f)
    setState('uploading')
    setErrorMsg(null)
    setUploadProgress(0)

    try {
      // 1. Upload to Supabase Storage
      const filePath = `${userId}/${Date.now()}_${f.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, f, { upsert: false })

      if (uploadError) throw uploadError

      setUploadProgress(50)

      // 2. Get public URL (signed URL since bucket is private)
      const { data: { signedUrl } } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600)

      const url = signedUrl || ''
      setFileUrl(url)

      // 3. Create document record
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          file_name: f.name,
          file_url: url,
          participant_id: participantId || null,
        })
        .select()
        .single()

      if (docError) throw docError
      setDocId(docData.id)
      setUploadProgress(75)

      // 4. AI extraction
      setState('extracting')
      const extractRes = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docData.id, fileUrl: url }),
      })

      if (!extractRes.ok) {
        // Don't fail the whole flow if AI extraction fails
        console.warn('AI extraction failed, continuing without it')
        setState('review')
        return
      }

      const extractData = await extractRes.json()
      setExtracted(extractData.extracted || {})
      setUploadProgress(100)
      setState('review')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setErrorMsg(message)
      setState('error')
    }
  }, [userId, supabase, participantId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  })

  async function handleSave() {
    if (!docId) return
    setState('saving')

    const { error } = await supabase
      .from('documents')
      .update({
        provider_name: extracted.provider_name || null,
        doc_date: extracted.doc_date || null,
        amount: extracted.amount || null,
        file_type: extracted.document_type || null,
        support_category: extracted.support_category || null,
        description: extracted.description || null,
        notes: notes || null,
        participant_id: participantId || null,
        ai_extracted: true,
        ai_confidence: extracted.confidence || null,
      })
      .eq('id', docId)

    if (error) {
      setErrorMsg(error.message)
      setState('error')
      return
    }

    setState('done')
    setTimeout(() => router.push('/documents'), 1500)
  }

  function reset() {
    setFile(null)
    setState('idle')
    setUploadProgress(0)
    setFileUrl(null)
    setErrorMsg(null)
    setDocId(null)
    setExtracted({})
    setNotes('')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Dropzone */}
      {(state === 'idle' || state === 'error') && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-primary-600" />
          </div>
          <p className="text-gray-900 font-semibold text-lg mb-1">
            {isDragActive ? 'Drop it here!' : 'Drop your document here'}
          </p>
          <p className="text-gray-400 text-sm mb-4">or click to browse files</p>
          <p className="text-xs text-gray-400">Supports: PDF, JPG, PNG · Max 50MB</p>

          {errorMsg && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* Upload progress */}
      {(state === 'uploading' || state === 'extracting') && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <Loader2 className="w-10 h-10 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="font-semibold text-gray-900 mb-1">
            {state === 'uploading' ? 'Uploading document…' : '🤖 AI is extracting details…'}
          </p>
          <p className="text-sm text-gray-400 mb-6">
            {state === 'extracting' ? 'This usually takes 5–15 seconds' : `${file?.name}`}
          </p>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Review extracted data */}
      {state === 'review' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Review & Confirm</h3>
              <p className="text-sm text-gray-500">
                {file?.name} · AI extracted these details — please verify and edit if needed.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Provider Name"
              value={extracted.provider_name || ''}
              onChange={v => setExtracted(p => ({ ...p, provider_name: v }))}
              placeholder="e.g. Therapy Works"
            />
            <Field
              label="Date"
              type="date"
              value={extracted.doc_date || ''}
              onChange={v => setExtracted(p => ({ ...p, doc_date: v }))}
            />
            <Field
              label="Amount (AUD)"
              type="number"
              value={extracted.amount?.toString() || ''}
              onChange={v => setExtracted(p => ({ ...p, amount: parseFloat(v) || undefined }))}
              placeholder="0.00"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
              <select
                value={extracted.document_type || ''}
                onChange={e => setExtracted(p => ({ ...p, document_type: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select type…</option>
                <option value="receipt">Receipt</option>
                <option value="invoice">Invoice</option>
                <option value="therapy_report">Therapy Report</option>
                <option value="plan_review">Plan Review</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NDIS Category</label>
              <select
                value={extracted.support_category || ''}
                onChange={e => setExtracted(p => ({ ...p, support_category: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select category…</option>
                {Object.entries(NDIS_CATEGORIES).map(([code, { name }]) => (
                  <option key={code} value={code}>{code} — {name}</option>
                ))}
              </select>
            </div>
            {participants.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Participant</label>
                <select
                  value={participantId}
                  onChange={e => setParticipantId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select participant…</option>
                  {participants.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={extracted.description || ''}
              onChange={e => setExtracted(p => ({ ...p, description: e.target.value }))}
              placeholder="Brief description of the service"
              maxLength={100}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional notes…"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {extracted.confidence !== undefined && (
            <p className="text-xs text-gray-400">
              AI confidence: {Math.round((extracted.confidence || 0) * 100)}%
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              Save Document
            </button>
            <button
              onClick={reset}
              className="px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Saving */}
      {state === 'saving' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <Loader2 className="w-10 h-10 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="font-semibold text-gray-900">Saving document…</p>
        </div>
      )}

      {/* Done */}
      {state === 'done' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-4" />
          <p className="font-semibold text-gray-900 mb-1">Document saved!</p>
          <p className="text-sm text-gray-400">Redirecting to documents…</p>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>
  )
}
