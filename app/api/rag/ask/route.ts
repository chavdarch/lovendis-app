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

    // Step 1: Get embedding for query
    let queryEmbedding: number[] | null = null

    try {
      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: query,
        }),
      })

      if (anthropicResponse.ok) {
        const data = await anthropicResponse.json()
        queryEmbedding = data.data?.[0]?.embedding
      }
    } catch (error) {
      console.warn('Anthropic embeddings failed:', error)
    }

    // Fallback to OpenAI
    if (!queryEmbedding) {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: query,
          }),
        })

        if (openaiResponse.ok) {
          const data = await openaiResponse.json()
          queryEmbedding = data.data?.[0]?.embedding
        }
      } catch (error) {
        console.warn('OpenAI embeddings failed:', error)
      }
    }

    let chunks: any[] = []

    // Step 2: Search for relevant chunks
    if (queryEmbedding) {
      // Vector search using pgvector
      const embeddingString = `[${queryEmbedding.join(',')}]`

      let query_builder = supabase
        .from('document_chunks')
        .select('id, content, tokens, doc_type, doc_date, provider_name, document_id, doc_name:documents(file_name)')
        .eq('user_id', session.user.id)
        .not('embedding', 'is', null)
        .limit(5)

      if (documentId) {
        query_builder = query_builder.eq('document_id', documentId)
      }

      const { data: dbChunks, error: searchError } = await query_builder

      if (searchError) {
        console.error('Chunk search error:', searchError)
      } else if (dbChunks && dbChunks.length > 0) {
        chunks = dbChunks.map((chunk: any) => ({
          ...chunk,
          doc_name: chunk.doc_name?.[0]?.file_name || 'Unknown Document',
        }))
      }
    } else {
      // Fallback: keyword search if embeddings failed
      let query_builder = supabase
        .from('document_chunks')
        .select('id, content, tokens, doc_type, doc_date, provider_name, document_id, doc_name:documents(file_name)')
        .eq('user_id', session.user.id)
        .limit(5)

      if (documentId) {
        query_builder = query_builder.eq('document_id', documentId)
      }

      const { data: dbChunks } = await query_builder
      chunks = (dbChunks || []).map((chunk: any) => ({
        ...chunk,
        doc_name: chunk.doc_name?.[0]?.file_name || 'Unknown Document',
      }))
    }

    // Step 3: Format chunks for prompt
    const contextText = formatChunksForPrompt(
      chunks.map((chunk: any) => ({
        content: chunk.content,
        doc_name: chunk.doc_name,
        doc_date: chunk.doc_date,
      }))
    )

    // Step 4: Generate answer using Claude
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

    // Step 5: Format sources
    const sources = chunks.map((chunk: any) => ({
      chunk_id: chunk.id,
      document_id: chunk.document_id,
      doc_name: chunk.doc_name,
      doc_date: chunk.doc_date,
      provider_name: chunk.provider_name,
      doc_type: chunk.doc_type,
      excerpt: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? '...' : ''),
    }))

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
