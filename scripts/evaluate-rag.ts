/**
 * RAG Evaluation Script
 * 
 * Tests the RAG system with predefined questions and evaluates:
 * - Answer relevance to the question
 * - Grounding in source documents
 * - Citation accuracy
 * - Overall quality metrics
 * 
 * Run: npx ts-node scripts/evaluate-rag.ts
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

interface TestCase {
  question: string
  expectedKeywords: string[]
  description: string
  minRelevanceScore: number
}

interface EvaluationResult {
  question: string
  answer: string
  sourcesUsed: number
  relevanceScore: number
  groundingScore: number
  citationAccuracy: number
  passed: boolean
  feedback: string
}

const TEST_CASES: TestCase[] = [
  {
    question: 'What therapy services did I receive?',
    expectedKeywords: ['therapy', 'service', 'provider', 'date'],
    description: 'Should identify therapy services from reports',
    minRelevanceScore: 0.7,
  },
  {
    question: 'What expenses fall under capacity building?',
    expectedKeywords: ['capacity', 'building', 'expense', 'cost', 'amount'],
    description: 'Should find expenses related to capacity building support category',
    minRelevanceScore: 0.6,
  },
  {
    question: 'Summarise my therapy progress',
    expectedKeywords: ['progress', 'therapy', 'improvement', 'session'],
    description: 'Should synthesize information from therapy reports',
    minRelevanceScore: 0.65,
  },
  {
    question: 'How much did I spend on physiotherapy?',
    expectedKeywords: ['physiotherapy', 'physio', 'amount', 'cost', 'spent'],
    description: 'Should calculate or identify physiotherapy expenses',
    minRelevanceScore: 0.7,
  },
  {
    question: 'What providers have I used?',
    expectedKeywords: ['provider', 'name', 'service'],
    description: 'Should list provider names from documents',
    minRelevanceScore: 0.65,
  },
]

async function evaluateRAG() {
  console.log('🚀 Starting RAG Evaluation\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials')
    process.exit(1)
  }

  if (!anthropicKey) {
    console.error('❌ Missing Anthropic API key')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  // Get test user (first user with documents)
  const { data: users, error: usersError } = await supabase
    .from('documents')
    .select('user_id')
    .limit(1)

  if (usersError || !users || users.length === 0) {
    console.log('⚠️  No users with documents found. Cannot evaluate.')
    return
  }

  const testUserId = users[0].user_id

  // Get documents for this user
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, file_name, provider_name, doc_date')
    .eq('user_id', testUserId)
    .limit(5)

  if (docsError || !documents || documents.length === 0) {
    console.log('⚠️  No documents found for evaluation.')
    return
  }

  console.log(`📄 Found ${documents.length} documents for evaluation:`)
  documents.forEach(doc => {
    console.log(`  - ${doc.file_name}`)
  })
  console.log()

  const results: EvaluationResult[] = []

  // Test each question
  for (const testCase of TEST_CASES) {
    console.log(`\n📝 Testing: "${testCase.question}"`)
    console.log(`   Purpose: ${testCase.description}`)

    try {
      // Call the RAG API (simulated here - in real deployment, use actual endpoint)
      // For now, retrieve chunks and evaluate them
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select('content, doc_name, doc_date')
        .eq('user_id', testUserId)
        .limit(5)

      if (!chunks || chunks.length === 0) {
        console.log('   ⚠️  No chunks found')
        continue
      }

      // Format context for Claude
      const context = chunks
        .map((c: any) => `[${c.doc_name}] ${c.content.slice(0, 300)}...`)
        .join('\n\n')

      // Generate answer using Claude
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Answer this question using only the following document excerpts. Be concise.

Question: "${testCase.question}"

Context:
${context}

Answer:`,
          },
        ],
      })

      const answer = response.content[0]?.type === 'text' ? response.content[0].text : ''

      // Evaluate answer quality
      const relevanceScore = calculateRelevanceScore(
        answer,
        testCase.question,
        testCase.expectedKeywords
      )
      const groundingScore = calculateGroundingScore(answer, chunks)
      const citationAccuracy = calculateCitationAccuracy(answer, documents)

      const passed = relevanceScore >= testCase.minRelevanceScore

      const result: EvaluationResult = {
        question: testCase.question,
        answer: answer.slice(0, 200),
        sourcesUsed: chunks.length,
        relevanceScore,
        groundingScore,
        citationAccuracy,
        passed,
        feedback: passed ? '✅ PASS' : '❌ FAIL',
      }

      results.push(result)

      console.log(`   Relevance: ${(relevanceScore * 100).toFixed(0)}%`)
      console.log(`   Grounding: ${(groundingScore * 100).toFixed(0)}%`)
      console.log(`   Citations: ${(citationAccuracy * 100).toFixed(0)}%`)
      console.log(`   ${result.feedback}`)
    } catch (error) {
      console.error(`   Error evaluating: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 EVALUATION SUMMARY')
  console.log('='.repeat(60))

  const passed = results.filter(r => r.passed).length
  const total = results.length

  const avgRelevance = results.reduce((sum, r) => sum + r.relevanceScore, 0) / total
  const avgGrounding = results.reduce((sum, r) => sum + r.groundingScore, 0) / total
  const avgCitations = results.reduce((sum, r) => sum + r.citationAccuracy, 0) / total

  console.log(`\nTests Passed: ${passed}/${total} (${((passed / total) * 100).toFixed(0)}%)`)
  console.log(`\nMetrics:`)
  console.log(`  Relevance:    ${(avgRelevance * 100).toFixed(0)}%`)
  console.log(`  Grounding:    ${(avgGrounding * 100).toFixed(0)}%`)
  console.log(`  Citations:    ${(avgCitations * 100).toFixed(0)}%`)

  // Save results
  const evalResults = {
    timestamp: new Date().toISOString(),
    testCases: TEST_CASES.length,
    passed,
    total,
    passRate: passed / total,
    metrics: {
      relevance: avgRelevance,
      grounding: avgGrounding,
      citations: avgCitations,
    },
    results,
  }

  console.log('\n✅ Evaluation complete. Results saved to evaluation-results.json')

  // Write results to file
  const fs = await import('fs/promises')
  await fs.writeFile(
    'evaluation-results.json',
    JSON.stringify(evalResults, null, 2)
  )
}

function calculateRelevanceScore(
  answer: string,
  question: string,
  expectedKeywords: string[]
): number {
  const lowerAnswer = answer.toLowerCase()
  const lowerQuestion = question.toLowerCase()

  let score = 0
  let matchedKeywords = 0

  // Check for expected keywords
  for (const keyword of expectedKeywords) {
    if (lowerAnswer.includes(keyword.toLowerCase())) {
      matchedKeywords++
    }
  }

  // Keyword matching: 50% of score
  score += (matchedKeywords / expectedKeywords.length) * 0.5

  // Length check: answer should be reasonably detailed
  if (answer.length > 50) score += 0.3
  if (answer.length > 200) score += 0.2

  return Math.min(score, 1)
}

function calculateGroundingScore(
  answer: string,
  chunks: Array<{ content: string }>
): number {
  if (!chunks || chunks.length === 0) return 0

  let matches = 0
  const chunkTexts = chunks.map(c => c.content.toLowerCase())

  // Check if answer concepts appear in source chunks
  const answerSentences = answer.split(/[.!?]/).slice(0, 3) // First 3 sentences
  const answerWords = answer.toLowerCase().split(/\s+/)

  for (const word of answerWords.slice(0, 10)) {
    if (word.length > 4) {
      // Check meaningful words
      const found = chunkTexts.some(text => text.includes(word))
      if (found) matches++
    }
  }

  return Math.min((matches / 10) * 1.5, 1) // Normalized to 0-1
}

function calculateCitationAccuracy(
  answer: string,
  documents: Array<{ file_name: string }>
): number {
  const answer_lower = answer.toLowerCase()

  // Check if documents are referenced
  let citedCount = 0
  for (const doc of documents) {
    const docNameLower = doc.file_name.toLowerCase()
    if (answer_lower.includes(docNameLower) || answer_lower.includes('document')) {
      citedCount++
    }
  }

  // At least mention sources
  const hasSources = answer.includes('based on') || answer.includes('according to')
  const score = hasSources ? 0.7 : citedCount > 0 ? 0.5 : 0.3

  return score
}

// Run evaluation
evaluateRAG().catch(console.error)
