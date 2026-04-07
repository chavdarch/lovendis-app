import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/rag/embed-chunks
 * 
 * Embeds all chunks for a document using Anthropic's embeddings API.
 * Stores embeddings in pgvector for semantic search.
 * 
 * Request body:
 * {
 *   documentId: string    // Document ID whose chunks to embed
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   embedded: number,     // Number of chunks embedded
 *   totalTokens: number   // Total tokens in all chunks
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await req.json()

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
    }

    // Verify document belongs to user
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, user_id')
      .eq('id', documentId)
      .eq('user_id', session.user.id)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Get all chunks for this document
    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('id, content, tokens')
      .eq('document_id', documentId)
      .eq('user_id', session.user.id)
      .order('chunk_index', { ascending: true })

    if (chunksError || !chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: 'No chunks found for document' },
        { status: 404 }
      )
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Batch embeddings in groups for efficiency
    const batchSize = 10
    const embeddings: Array<{ id: string; embedding: number[] }> = []

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      const texts = batch.map(c => c.content)

      try {
        // Use Anthropic embeddings API
        // Note: Anthropic embeddings API may use different endpoint
        const response = await fetch('https://api.anthropic.com/v1/messages/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: texts,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          console.error('Anthropic embeddings error:', error)
          // Fallback to OpenAI
          throw new Error('Anthropic API failed')
        }

        const data = await response.json()
        const batchEmbeddings = data.data || []

        batch.forEach((chunk, index) => {
          if (batchEmbeddings[index]?.embedding) {
            embeddings.push({
              id: chunk.id,
              embedding: batchEmbeddings[index].embedding,
            })
          }
        })
      } catch (apiError) {
        // Fallback to OpenAI
        console.warn('Anthropic embeddings failed, trying OpenAI...')
        try {
          const openaiResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: texts,
            }),
          })

          if (!openaiResponse.ok) {
            throw new Error('OpenAI embeddings also failed')
          }

          const openaiData = await openaiResponse.json()
          const batchEmbeddings = openaiData.data || []

          batch.forEach((chunk, index) => {
            if (batchEmbeddings[index]?.embedding) {
              embeddings.push({
                id: chunk.id,
                embedding: batchEmbeddings[index].embedding,
              })
            }
          })
        } catch (fallbackError) {
          console.error('All embedding APIs failed:', fallbackError)
          return NextResponse.json(
            { error: 'Embeddings API unavailable', success: false },
            { status: 503 }
          )
        }
      }
    }

    // Update chunks with embeddings
    const updatePromises = embeddings.map(({ id, embedding }) =>
      supabase
        .from('document_chunks')
        .update({ embedding })
        .eq('id', id)
    )

    const updateResults = await Promise.all(updatePromises)

    // Check for errors
    const hasError = updateResults.some(result => result.error)
    if (hasError) {
      console.error('Failed to update chunks with embeddings')
      return NextResponse.json(
        { error: 'Failed to store embeddings', success: false },
        { status: 500 }
      )
    }

    const totalTokens = chunks.reduce((sum, chunk) => sum + (chunk.tokens || 0), 0)

    return NextResponse.json({
      success: true,
      embedded: embeddings.length,
      totalTokens,
      message: `Successfully embedded ${embeddings.length} chunks`,
    })
  } catch (err: unknown) {
    console.error('Embed chunks endpoint error:', err)
    const message = err instanceof Error ? err.message : 'Embedding chunks failed'
    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}
