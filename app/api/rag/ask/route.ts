import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { formatChunksForPrompt } from '@/lib/chunking'

/**
 * POST /api/rag/ask
 * 
 * Main RAG endpoint that answers user questions about their documents.
 * Retrieves relevant chunks and uses Claude to generate grounded answers.
 * 
 * Request body:
 * {
 *   query: string,        // User's question
 *   documentId?: string   // Optional: filter to specific document
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   answer: string,       // Claude-generated answer grounded in documents
 *   sources: Array<{
 *     chunk_id: string,
 *     document_id: string,
 *     doc_name: string,
 *     doc_date: string,
 *     provider_name: string,
 *     excerpt: string     // First 200 chars of chunk
 *   }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query, documentId } = await req.json()

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Step 1: Retrieve relevant chunks via RAG retrieval
    const retrieveResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/rag/retrieve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          query,
          limit: 5,
          documentId,
        }),
      }
    )

    if (!retrieveResponse.ok) {
      console.error('Retrieval failed:', retrieveResponse.status)
      return NextResponse.json(
        { error: 'Failed to retrieve relevant documents' },
        { status: 503 }
      )
    }

    const retrieveData: any = await retrieveResponse.json()
    const chunks = retrieveData.chunks || []

    // Step 2: Format chunks for prompt
    const contextText = formatChunksForPrompt(
      chunks.map((chunk: any) => ({
        content: chunk.content,
        doc_name: chunk.doc_name,
        doc_date: chunk.doc_date,
      }))
    )

    // Step 3: Generate answer using Claude
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const systemPrompt = `You are an NDIS (National Disability Insurance Scheme) expert assistant. 
Your role is to help users understand their NDIS documents, including invoices, receipts, therapy reports, and plan reviews.

Answer questions about NDIS documents using ONLY the provided context. 
If the information is not available in the documents, clearly state: "I don't have that information in your documents."

Be concise, helpful, and always cite which documents you're referencing when possible.
Format your response for easy reading with clear paragraphs.`

    const userPrompt = contextText.length > 0
      ? `Based on the following document excerpts, please answer this question: "${query}"

DOCUMENT EXCERPTS:
${contextText}

Remember: Only use information from these excerpts. If the answer isn't in the documents, say so clearly.`
      : `The user is asking: "${query}"

However, no relevant documents were found in their document collection. Please let them know that you don't have documents matching their question and suggest what types of documents might help answer it.`

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    const answer = response.content[0]?.type === 'text' ? response.content[0].text : ''

    // Step 4: Format sources
    const sources = chunks.map((chunk: any) => ({
      chunk_id: chunk.id,
      document_id: chunk.document_id,
      doc_name: chunk.doc_name,
      doc_date: chunk.doc_date,
      provider_name: chunk.provider_name,
      doc_type: chunk.doc_type,
      similarity_score: Math.round(chunk.similarity * 100), // As percentage
      excerpt: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? '...' : ''),
    }))

    // Step 5: Optionally save conversation (for future multi-turn support)
    if (process.env.SAVE_RAG_HISTORY === 'true') {
      // This is optional - save conversation for audit trail
      try {
        await supabase
          .from('rag_messages')
          .insert([
            {
              user_id: session.user.id,
              role: 'user',
              content: query,
              conversation_id: null, // Could enhance with conversation management
            },
            {
              user_id: session.user.id,
              role: 'assistant',
              content: answer,
              sources,
              conversation_id: null,
            },
          ])
      } catch (historyError) {
        console.warn('Failed to save conversation history:', historyError)
        // Don't fail the request if history save fails
      }
    }

    return NextResponse.json({
      success: true,
      answer,
      sources,
      chunks_used: chunks.length,
    })
  } catch (err: unknown) {
    console.error('Ask endpoint error:', err)
    const message = err instanceof Error ? err.message : 'Failed to generate answer'
    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}
