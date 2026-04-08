import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { chunkText } from '@/lib/chunking'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/documents/rechunk
 * 
 * Re-chunks all documents for a user (useful when adding RAG to existing docs)
 * Creates chunks from document descriptions and extracted content
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all documents for this user
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', session.user.id)

    if (docError || !documents) {
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    let successCount = 0
    let chunkCount = 0
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    for (const doc of documents) {
      // Combine all available text from the document
      const fullText = [
        doc.provider_name || '',
        doc.description || '',
        doc.file_name || '',
        doc.support_category || '',
      ]
        .filter(Boolean)
        .join(' ')

      if (!fullText.trim()) continue

      // Chunk the text
      const chunks = chunkText(fullText, 500, 1000)

      // Create chunks in database
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]

        // Get embedding for this chunk
        let embedding: number[] | null = null
        try {
          const embRes = await fetch('https://api.anthropic.com/v1/messages/embeddings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY || '',
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: chunk,
            }),
          })

          if (embRes.ok) {
            const data = await embRes.json()
            embedding = data.data?.[0]?.embedding
          }
        } catch (err) {
          console.warn('Failed to embed chunk:', err)
        }

        // Insert chunk with metadata
        const { error: insertError } = await supabase
          .from('document_chunks')
          .insert([
            {
              user_id: session.user.id,
              document_id: doc.id,
              chunk_index: i,
              content: chunk,
              tokens: Math.ceil(chunk.split(/\s+/).length * 1.3), // Rough estimate
              doc_type: doc.file_type || 'other',
              doc_date: doc.doc_date,
              provider_name: doc.provider_name,
              support_category: doc.support_category,
              embedding: embedding ? `[${embedding.join(',')}]` : null,
            },
          ])

        if (!insertError) {
          chunkCount++
        }
      }

      successCount++
    }

    return NextResponse.json({
      success: true,
      documents_processed: successCount,
      chunks_created: chunkCount,
      message: `Processed ${successCount} documents and created ${chunkCount} chunks. RAG is now ready!`,
    })
  } catch (err: unknown) {
    console.error('Rechunk error:', err)
    const message = err instanceof Error ? err.message : 'Rechunking failed'
    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}
