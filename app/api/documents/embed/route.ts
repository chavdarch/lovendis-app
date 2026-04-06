import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/documents/embed
 * 
 * Generates and stores vector embeddings for a document.
 * 
 * Request body:
 * {
 *   documentId: string,      // Document ID to embed
 *   text: string            // Text content to embed (usually extracted from document)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   embedding?: number[],   // 1536-dimensional vector
 *   error?: string
 * }
 * 
 * Uses Anthropic's embeddings model (when available).
 * Falls back to text-embedding API if needed.
 * Cost: ~$0.02 per 1M tokens (negligible)
 */

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId, text } = await req.json()

    if (!documentId || !text) {
      return NextResponse.json(
        { error: 'documentId and text are required' },
        { status: 400 }
      )
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

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Generate embedding using Anthropic's embeddings model
    // NOTE: Using standard text/document content for embedding
    // The Anthropic embeddings API expects text input
    try {
      // Create embedding using Anthropic API
      // Using a text content approach since native embeddings model may not be available yet
      const response = await fetch('https://api.anthropic.com/v1/messages/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.slice(0, 8000), // Limit to first 8000 chars for efficiency
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Embedding API error:', error)
        
        // If embeddings endpoint doesn't exist, use fallback
        throw new Error('Embeddings API not available')
      }

      const data = await response.json()
      const embedding = data.data?.[0]?.embedding

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response')
      }

      // Store embedding in Supabase
      const { error: updateError } = await supabase
        .from('documents')
        .update({ embedding })
        .eq('id', documentId)

      if (updateError) {
        console.error('Failed to store embedding:', updateError)
        return NextResponse.json(
          { error: 'Failed to store embedding', success: false },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        embedding,
        message: 'Document embedded successfully',
      })
    } catch (apiError) {
      // Fallback: If Anthropic embeddings aren't available, use OpenAI text-embedding-3-small
      console.warn('Anthropic embeddings unavailable, attempting OpenAI fallback:', apiError)

      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: text.slice(0, 8000),
          }),
        })

        if (!openaiResponse.ok) {
          const error = await openaiResponse.json()
          console.error('OpenAI embeddings error:', error)
          throw new Error('Both Anthropic and OpenAI embeddings failed')
        }

        const openaiData = await openaiResponse.json()
        const embedding = openaiData.data?.[0]?.embedding

        if (!embedding || !Array.isArray(embedding)) {
          throw new Error('Invalid OpenAI embedding response')
        }

        // Store embedding in Supabase
        const { error: updateError } = await supabase
          .from('documents')
          .update({ embedding })
          .eq('id', documentId)

        if (updateError) {
          console.error('Failed to store embedding:', updateError)
          return NextResponse.json(
            { error: 'Failed to store embedding', success: false },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          embedding,
          message: 'Document embedded successfully (OpenAI)',
        })
      } catch (fallbackError) {
        console.error('All embedding attempts failed:', fallbackError)
        return NextResponse.json(
          {
            error: 'Embeddings API unavailable. Ensure ANTHROPIC_API_KEY or OPENAI_API_KEY is set.',
            success: false,
          },
          { status: 503 }
        )
      }
    }
  } catch (err: unknown) {
    console.error('Embed endpoint error:', err)
    const message = err instanceof Error ? err.message : 'Embedding failed'
    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}
