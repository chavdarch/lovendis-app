import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const EXTRACTION_PROMPT = `You are an expert at extracting information from Australian NDIS documents (receipts, invoices, therapy reports).

Extract the following information from this document:
- provider_name: Name of the service provider
- doc_date: Date of service or invoice (YYYY-MM-DD format)
- amount: Total amount in AUD (number only, no $ sign)
- document_type: One of: receipt, invoice, therapy_report, plan_review, other
- support_category: Best matching NDIS support category code (01-15) based on the service
- description: Brief description of the service (max 100 chars)
- confidence: Your confidence score 0-1

NDIS Support Categories for reference:
01 Daily Activities, 02 Health & Wellbeing, 03 Home Living, 04 Lifelong Learning,
05 Work, 06 Social & Community, 07 Relationships, 08 Choice & Control,
09 Daily Activities (CB), 10 Plan Management, 11 Support Coordination,
12 Improved Living, 13 Improved Health, 14 Improved Learning, 15 Increased Work

Respond with valid JSON only, no other text. Example:
{"provider_name":"Therapy Works","doc_date":"2024-01-15","amount":250.00,"document_type":"invoice","support_category":"01","description":"Occupational therapy session","confidence":0.92}`

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { documentId, fileUrl } = await req.json()

  if (!documentId || !fileUrl) {
    return NextResponse.json({ error: 'documentId and fileUrl are required' }, { status: 400 })
  }

  // Verify the document belongs to this user
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, user_id, file_name')
    .eq('id', documentId)
    .eq('user_id', session.user.id)
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    // Determine if it's a PDF or image
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(doc.file_name)
    const isPDF = /\.pdf$/i.test(doc.file_name)

    let extractedData = null

    if (isImage) {
      // Use GPT-4o vision for images
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: EXTRACTION_PROMPT,
              },
              {
                type: 'image_url',
                image_url: { url: fileUrl, detail: 'high' },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0,
      })

      const content = response.choices[0]?.message?.content ?? ''
      extractedData = JSON.parse(content.trim())
    } else if (isPDF) {
      // For PDFs, use text extraction approach with GPT-4o
      // Note: Full PDF text extraction would need additional library (pdf-parse)
      // For MVP, we use GPT-4o with the URL directly
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: `${EXTRACTION_PROMPT}\n\nNote: This is a PDF document at URL: ${fileUrl}\nFile name: ${doc.file_name}\n\nBased on the file name and any context available, provide your best extraction attempt. Set confidence appropriately low if you cannot read the actual content.`,
          },
        ],
        max_tokens: 500,
        temperature: 0,
      })
      const content = response.choices[0]?.message?.content ?? ''
      try {
        extractedData = JSON.parse(content.trim())
      } catch {
        extractedData = { confidence: 0.1 }
      }
    }

    if (!extractedData) {
      return NextResponse.json({ error: 'Could not extract data' }, { status: 422 })
    }

    // Update document record with extracted data
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        provider_name: extractedData.provider_name || null,
        doc_date: extractedData.doc_date || null,
        amount: extractedData.amount ? parseFloat(extractedData.amount) : null,
        file_type: extractedData.document_type || null,
        support_category: extractedData.support_category || null,
        description: extractedData.description || null,
        ai_extracted: true,
        ai_confidence: extractedData.confidence || null,
        raw_ai_response: extractedData,
      })
      .eq('id', documentId)

    if (updateError) {
      console.error('Failed to update document:', updateError)
    }

    return NextResponse.json({
      success: true,
      extracted: extractedData,
    })
  } catch (err: unknown) {
    console.error('AI extraction error:', err)
    const message = err instanceof Error ? err.message : 'AI extraction failed'

    // Don't fail silently — but also don't block the upload flow
    return NextResponse.json(
      { error: message, extracted: null },
      { status: 422 }
    )
  }
}
