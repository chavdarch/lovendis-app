import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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

Respond with valid JSON only, no markdown, no other text. Example:
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

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, user_id, file_name, file_url')
    .eq('id', documentId)
    .eq('user_id', session.user.id)
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Generate a fresh signed URL server-side for reliable access
    const filePath = `${session.user.id}/${doc.file_name}`
    const storedUrl = doc.file_url || fileUrl
    // Extract the storage path from the stored URL
    const pathMatch = storedUrl.match(/\/object\/sign\/documents\/(.+?)\?/) ||
                      storedUrl.match(/\/object\/authenticated\/documents\/(.+)/)
    let fetchUrl = storedUrl
    if (pathMatch) {
      const { data: freshSigned } = await supabase.storage
        .from('documents')
        .createSignedUrl(pathMatch[1], 300)
      if (freshSigned?.signedUrl) fetchUrl = freshSigned.signedUrl
    }

    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(doc.file_name)
    const isPDF = /\.pdf$/i.test(doc.file_name)
    let extractedData = null

    if (isPDF) {
      // Fetch PDF bytes and extract text using dynamic import
      const pdfRes = await fetch(fetchUrl)
      const pdfBuffer = await pdfRes.arrayBuffer()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const pdfData = await pdfParse(Buffer.from(pdfBuffer))
      const pdfText = (pdfData.text as string).slice(0, 3000)

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `${EXTRACTION_PROMPT}\n\nHere is the extracted text from the PDF:\n\n${pdfText}`,
          },
        ],
      })

      const content = response.content[0]?.type === 'text' ? response.content[0].text : ''
      try {
        const cleaned = content.replace(/```json\n?|```/g, '').trim()
        extractedData = JSON.parse(cleaned)
      } catch {
        extractedData = { confidence: 0.1 }
      }

    } else if (isImage) {
      const imageRes = await fetch(fetchUrl)
      const imageBuffer = await imageRes.arrayBuffer()
      const base64 = Buffer.from(imageBuffer).toString('base64')
      const mimeType = doc.file_name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mimeType, data: base64 },
              },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      })

      const content = response.content[0]?.type === 'text' ? response.content[0].text : ''
      try {
        const cleaned = content.replace(/```json\n?|```/g, '').trim()
        extractedData = JSON.parse(cleaned)
      } catch {
        extractedData = { confidence: 0.1 }
      }

    } else {
      extractedData = { confidence: 0.1 }
    }

    if (!extractedData) {
      return NextResponse.json({ error: 'Could not extract data' }, { status: 422 })
    }

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

    return NextResponse.json({ success: true, extracted: extractedData })
  } catch (err: unknown) {
    console.error('AI extraction error:', err)
    const message = err instanceof Error ? err.message : 'AI extraction failed'
    return NextResponse.json({ error: message, extracted: null }, { status: 422 })
  }
}
