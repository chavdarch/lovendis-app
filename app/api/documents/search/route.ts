import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

interface SearchResult {
  id: string
  file_name: string
  provider_name: string | null
  description: string | null
  support_category: string | null
  doc_date: string | null
  amount: number | null
  similarity_score: number
}

/**
 * POST /api/documents/search
 * 
 * Semantically searches documents using vector embeddings.
 * 
 * Request body:
 * {
 *   query: string,          // Search query (e.g., "physiotherapy invoices")
 *   limit?: number,         // Max results (default: 5)
 *   participant_id?: string // Optional: filter by participant
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   results: SearchResult[],
 *   query: string,
 *   count: number
 * }
 * 
 * How it works:
 * 1. Embed the search query using Anthropic embeddings
 * 2. Use pgvector cosine distance to find similar documents
 * 3. Return top K results with similarity scores (0-1)
 * 
 * Similarity score interpretation:
 * - 1.0 = identical
 * - 0.8-1.0 = very similar
 * - 0.6-0.8 = similar
 * - <0.6 = less relevant
 */

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query, limit = 5, participant_id } = await req.json()

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'query is required and must not be empty' },
        { status: 400 }
      )
    }

    // Step 1: Embed the search query
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
    } catch (err) {
      console.warn('Anthropic embeddings failed:', err)
    }

    // Fallback to OpenAI if Anthropic fails
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
      } catch (err) {
        console.warn('OpenAI embeddings failed:', err)
      }
    }

    // If no embedding could be generated, fall back to keyword search
    if (!queryEmbedding) {
      console.warn('Embeddings unavailable, falling back to keyword search')
      return performKeywordSearch(supabase, session.user.id, query, limit, participant_id)
    }

    // Step 2: Search Supabase using pgvector
    // Uses cosine distance: <-> operator
    // Returns docs ordered by similarity (most similar first)
    const embeddingString = `[${queryEmbedding.join(',')}]`

    let searchQuery = supabase
      .from('documents')
      .select(
        'id, file_name, provider_name, description, support_category, doc_date, amount, embedding'
      )
      .eq('user_id', session.user.id)
      .not('embedding', 'is', null)

    if (participant_id) {
      searchQuery = searchQuery.eq('participant_id', participant_id)
    }

    // Fetch all documents with embeddings, then calculate similarity client-side
    // (Supabase doesn't support ORDER BY distance in JS client yet)
    const { data: documents, error: searchError } = await searchQuery

    if (searchError) {
      console.error('Search error:', searchError)
      return NextResponse.json(
        { error: 'Search failed', success: false },
        { status: 500 }
      )
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        query,
        count: 0,
        message: 'No documents with embeddings found. Run embeddings on documents first.',
      })
    }

    // Step 3: Calculate similarity scores client-side using cosine similarity
    const results: SearchResult[] = documents
      .map((doc) => {
        const docEmbedding = doc.embedding as number[] | null
        if (!docEmbedding) return null

        const similarity = cosineSimilarity(queryEmbedding, docEmbedding)

        return {
          id: doc.id,
          file_name: doc.file_name,
          provider_name: doc.provider_name,
          description: doc.description,
          support_category: doc.support_category,
          doc_date: doc.doc_date,
          amount: doc.amount,
          similarity_score: similarity,
        }
      })
      .filter((r): r is SearchResult => r !== null)
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      results,
      query,
      count: results.length,
    })
  } catch (err: unknown) {
    console.error('Search endpoint error:', err)
    const message = err instanceof Error ? err.message : 'Search failed'
    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}

/**
 * Fallback keyword search when embeddings are unavailable
 * Simple full-text search across provider_name, description, file_name, support_category
 */
async function performKeywordSearch(
  supabase: any,
  userId: string,
  query: string,
  limit: number,
  participantId?: string
) {
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean)

  let dbQuery = supabase
    .from('documents')
    .select('id, file_name, provider_name, description, support_category, doc_date, amount')
    .eq('user_id', userId)

  if (participantId) {
    dbQuery = dbQuery.eq('participant_id', participantId)
  }

  const { data: documents, error } = await dbQuery

  if (error || !documents) {
    return NextResponse.json(
      { error: 'Keyword search failed', success: false },
      { status: 500 }
    )
  }

  // Score documents based on keyword matches
  const scored = documents
    .map((doc: any) => {
      const searchText = `${doc.file_name || ''} ${doc.provider_name || ''} ${doc.description || ''} ${doc.support_category || ''}`.toLowerCase()
      const matchCount = keywords.filter(k => searchText.includes(k)).length
      const score = matchCount / keywords.length

      return {
        doc,
        score,
      }
    })
    .filter(({ score }: any) => score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit)

  const results: SearchResult[] = scored.map(({ doc, score }: { doc: any; score: any }) => ({
    id: doc.id,
    file_name: doc.file_name,
    provider_name: doc.provider_name,
    description: doc.description,
    support_category: doc.support_category,
    doc_date: doc.doc_date,
    amount: doc.amount,
    similarity_score: score,
  }))

  return NextResponse.json({
    success: true,
    results,
    query,
    count: results.length,
    fallback: 'keyword_search',
  })
}

/**
 * Calculate cosine similarity between two vectors
 * Range: 0 (completely different) to 1 (identical)
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length')
  }

  let dotProduct = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    magnitudeA += vecA[i] * vecA[i]
    magnitudeB += vecB[i] * vecB[i]
  }

  magnitudeA = Math.sqrt(magnitudeA)
  magnitudeB = Math.sqrt(magnitudeB)

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0
  }

  // Convert to 0-1 range (cosine similarity is -1 to 1)
  const rawSimilarity = dotProduct / (magnitudeA * magnitudeB)
  return Math.max(0, (rawSimilarity + 1) / 2)
}
