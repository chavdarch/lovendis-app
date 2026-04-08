'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Source {
  chunk_id: string
  document_id: string
  doc_name: string
  doc_date: string
  provider_name?: string
  doc_type?: string
  similarity_score?: number
  excerpt: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

interface DocumentRAGChatProps {
  documentId?: string
}

const EXAMPLE_QUESTIONS = [
  'What therapy services did I receive in March?',
  'What expenses fall under capacity building?',
  'Summarise my therapy progress',
  'How much did I spend on physiotherapy?',
  'What providers have I used?',
]

export function DocumentRAGChat({ documentId }: DocumentRAGChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleAsk = async (questionText: string) => {
    const trimmed = questionText.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)
    setQuery('')

    // Add user message
    const userMessage: Message = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMessage])

    try {
      const response = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          documentId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to get answer')
      }

      const data = await response.json()
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('RAG error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-h-screen bg-white">
      {/* Header */}
      <div className="border-b bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-6">
        <h2 className="text-2xl font-bold text-gray-900">📋 Ask Your Documents</h2>
        <p className="text-sm text-gray-600 mt-2">
          Get answers about your NDIS documents powered by AI
        </p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-8 py-12">
            <div className="text-center space-y-4">
              <div className="text-5xl">💬</div>
              <h3 className="text-xl font-semibold text-gray-900">
                What would you like to know about your documents?
              </h3>
              <p className="text-gray-600 max-w-md">
                Ask questions about your NDIS invoices, receipts, therapy reports, and plan reviews.
                I'll find relevant information and explain it to you.
              </p>
            </div>

            {/* Example Questions */}
            <div className="w-full max-w-md space-y-2">
              <p className="text-sm font-semibold text-gray-700 px-4">💡 Example questions:</p>
              <div className="grid gap-2">
                {EXAMPLE_QUESTIONS.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => handleAsk(example)}
                    className="text-left p-3 rounded-lg bg-gray-50 hover:bg-purple-100 border border-gray-200 hover:border-purple-300 transition-colors text-sm text-gray-700 hover:text-purple-900"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-lg lg:max-w-2xl ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-2xl rounded-tr-none'
                      : 'bg-gray-100 text-gray-900 rounded-2xl rounded-tl-none'
                  } px-5 py-3 space-y-3`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-300 space-y-2">
                      <p className="text-xs font-semibold opacity-75">📌 Sources:</p>
                      <div className="space-y-2">
                        {msg.sources.map((source, i) => (
                          <div
                            key={i}
                            className="text-xs bg-white bg-opacity-20 rounded p-2 space-y-1"
                          >
                            <div className="font-semibold">
                              {source.doc_name}
                              {source.doc_date && ` (${source.doc_date})`}
                            </div>
                            {source.provider_name && (
                              <div>Provider: {source.provider_name}</div>
                            )}
                            {source.similarity_score !== undefined && (
                              <div>Match: {source.similarity_score}%</div>
                            )}
                            <p className="opacity-75 italic">{source.excerpt}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-tl-none px-5 py-3 flex items-center gap-2 text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Searching your documents...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-start">
                <div className="bg-red-50 border border-red-200 rounded-2xl rounded-tl-none px-5 py-3 flex items-start gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Error</p>
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t bg-gray-50 p-6">
        <div className="flex gap-3 max-w-4xl">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleAsk(query)
              }
            }}
            placeholder="Ask anything about your NDIS documents..."
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-200 disabled:cursor-not-allowed text-sm"
          />
          <button
            onClick={() => handleAsk(query)}
            disabled={loading || !query.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 flex items-center gap-2 transition-colors disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💡 Tip: Be specific with dates, providers, or categories for better results
        </p>
      </div>
    </div>
  )
}
