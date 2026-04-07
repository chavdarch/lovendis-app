import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/rag/retrieve
 * 
 * Retrieves relevant document chunks based on semantic similarity to a query.
 * Uses pgvector cosine similarity for efficient semantic search.
 * 
 * Request body:
 * {
 *   query: string,        // User's natural language question
 *   limit?: number,       // Max chunks to return (default: 5)
 *   documentId?: string   // Optional: filter to specific document
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   chunks: Array<{
 *     id: string,
 *     content: string,
 *     tokens: number,
 *     doc_name: string,
 *     doc_date: string,
 *     provider_name: string,
 *     document_id: string,
 *     similarity: number   // Cosine similarity score (0-1)
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

    const { query, limit = 5, documentId } = await req.json()

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Get embedding for the query
    let queryEmbedding: number[] | null = null

    try {
      // Try Anthropic embeddings first
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
      console.warn('Anthropic embeddings failed, trying OpenAI...')
    }

    // Fallback to OpenAI if Anthropic failed
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
        console.error('OpenAI embeddings also failed')
      }
    }

    if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
      return NextResponse.json(
        { error: 'Failed to generate query embedding' },
        { status: 503 }
      )
    }

    // Construct the embedding string for pgvector format
    const embeddingStr = `[${queryEmbedding.join(',')}]`

    // Perform semantic search using pgvector cosine similarity
    let queryBuilder = supabase
      .from('document_chunks')
      .select('*, documents!inner(file_name, doc_date)')
      .eq('user_id', session.user.id)

    if (documentId) {
      queryBuilder = queryBuilder.eq('document_id', documentId)
    }

    // Use RPC or raw SQL for similarity calculation
    // Since pgvector isn't fully exposed in Supabase JS client,
    // we'll use a simpler approach: fetch and calculate client-side
    // For production, use Supabase RPC with SQL function
    const { data: allChunks, error } = await queryBuilder

    if (error) {
      console.error('Chunks query error:', error)
      return NextResponse.json({ error: 'Failed to query chunks' }, { status: 500 })
    }

    if (!allChunks || allChunks.length === 0) {
      return NextResponse.json({
        success: true,
        chunks: [],
        message: 'No chunks found for query',
      })
    }

    // Calculate similarity scores (client-side for now)
    // For production, use pgvector RPC function
    const chunksWithScores = allChunks
      .filter((chunk: any) => chunk.embedding && Array.isArray(chunk.embedding))
      .map((chunk: any) => {
        // Calculate cosine similarity
        const similarity = cosineSimilarity(queryEmbedding, chunk.embedding)
        return {
          id: chunk.id,
          content: chunk.content,
          tokens: chunk.tokens,
          doc_type: chunk.doc_type,
          doc_date: chunk.doc_date,
          provider_name: chunk.provider_name,
          document_id: chunk.document_id,
          doc_name: chunk.documents?.file_name || 'Unknown',
          similarity,
        }
      })
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      chunks: chunksWithScores,
    })
  } catch (err: unknown) {
    console.error('Retrieve endpoint error:', err)
    const message = err instanceof Error ? err.message : 'Retrieval failed'
    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) return 0

  return dotProduct / (normA * normB)
}
