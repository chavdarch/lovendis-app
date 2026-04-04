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

// Lightweight PDF text extraction — no native dependencies
// Extracts readable strings from PDF binary without any canvas/DOM requirements
function extractTextFromPdfBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const text = new TextDecoder('latin1').decode(bytes)
  
  // Extract text between BT (Begin Text) and ET (End Text) markers
  const strings: string[] = []
  
  // Match parenthesized strings (PDF text objects)
  const parenRegex = /\(([^)\\]|\\.){1,200}\)/g
  let match
  while ((match = parenRegex.exec(text)) !== null) {
    const s = match[0]
      .slice(1, -1)
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .trim()
    // Only keep strings that look like readable text (has letters/numbers)
    if (s.length > 1 && /[a-zA-Z0-9]/.test(s) && !/^[01]+$/.test(s)) {
      strings.push(s)
    }
  }
  
  return strings.join(' ').slice(0, 3000)
}

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

    // Generate fresh signed URL server-side
    const storedUrl = doc.file_url || fileUrl
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
      const pdfRes = await fetch(fetchUrl)
      if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`)
      const pdfBuffer = await pdfRes.arrayBuffer()
      const base64Pdf = Buffer.from(pdfBuffer).toString('base64')

      // Send PDF directly to Claude — it natively understands PDF documents
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64Pdf,
                },
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
        console.error('Failed to parse Claude response:', content)
        extractedData = { confidence: 0.1 }
      }

    } else if (isImage) {
      const imageRes = await fetch(fetchUrl)
      if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.status}`)
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
