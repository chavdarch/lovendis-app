import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { chunkText, estimateTokens } from '@/lib/chunking'

/**
 * POST /api/documents/chunk
 * 
 * Chunks a document's raw text into overlapping segments
 * suitable for embedding and RAG retrieval.
 * 
 * Request body:
 * {
 *   documentId: string,    // Document ID to chunk
 *   rawText: string        // Full extracted text from document
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   chunked: number,       // Number of chunks created
 *   totalTokens: number,
 *   chunks: Array<{
 *     chunk_index: number,
 *     content: string,
 *     tokens: number
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

    const { documentId, rawText } = await req.json()

    if (!documentId || !rawText) {
      return NextResponse.json(
        { error: 'documentId and rawText are required' },
        { status: 400 }
      )
    }

    // Verify document belongs to user
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, user_id, file_name, file_type, doc_date, provider_name, support_category')
      .eq('id', documentId)
      .eq('user_id', session.user.id)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Chunk the text
    const chunks = chunkText(rawText)

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'Failed to chunk document text' },
        { status: 422 }
      )
    }

    // Prepare chunks for insertion
    const chunkRecords = chunks.map((chunk, index) => ({
      user_id: session.user.id,
      document_id: documentId,
      chunk_index: index,
      content: chunk.content,
      tokens: chunk.tokens,
      doc_type: doc.file_type,
      doc_date: doc.doc_date,
      provider_name: doc.provider_name,
      support_category: doc.support_category,
    }))

    // Insert chunks into database
    const { error: insertError } = await supabase
      .from('document_chunks')
      .insert(chunkRecords)

    if (insertError) {
      console.error('Failed to insert chunks:', insertError)
      return NextResponse.json(
        { error: 'Failed to store chunks', success: false },
        { status: 500 }
      )
    }

    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0)

    return NextResponse.json({
      success: true,
      chunked: chunks.length,
      totalTokens,
      chunks: chunkRecords.map((record, index) => ({
        chunk_index: record.chunk_index,
        content: record.content.slice(0, 100) + '...', // Preview
        tokens: record.tokens,
      })),
    })
  } catch (err: unknown) {
    console.error('Chunk endpoint error:', err)
    const message = err instanceof Error ? err.message : 'Chunking failed'
    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}
