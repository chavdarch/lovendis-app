# loveNDIS RAG System

## Overview

The RAG (Retrieval-Augmented Generation) system transforms loveNDIS from a simple document management platform into an **AI-powered document intelligence platform**. Users can now ask questions about their NDIS documents and receive answers grounded in those specific documents with full citations.

## Architecture

### 1. Document Chunking Pipeline

When a document is uploaded and processed:

1. **Extraction** (`/api/documents/extract`) — Claude extracts text and metadata
2. **Chunking** (`/api/documents/chunk`) — Text is split into 500-1000 token chunks with overlap
3. **Embedding** (`/api/rag/embed-chunks`) — Each chunk is embedded using Anthropic embeddings API
4. **Storage** — Embeddings stored in pgvector for semantic search

### 2. Query Processing

When a user asks a question:

1. **Query Embedding** — User question is embedded using same model
2. **Semantic Retrieval** (`/api/rag/retrieve`) — Top-5 chunks found via cosine similarity
3. **Answer Generation** (`/api/rag/ask`) — Claude generates answer using only retrieved chunks
4. **Citation** — Sources are returned with similarity scores and excerpts

## Database Schema

### document_chunks Table

Stores individual chunks from each document:

```sql
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  user_id UUID,                    -- RLS: users see only their own
  document_id UUID,                -- Reference to parent document
  chunk_index INT,                 -- Sequence number (0, 1, 2, ...)
  content TEXT,                    -- Chunk text (400-1000 tokens)
  tokens INT,                      -- Token count for this chunk
  doc_type VARCHAR(50),            -- 'invoice', 'receipt', 'therapy_report'
  doc_date DATE,                   -- Document date (for sorting/filtering)
  provider_name TEXT,              -- Service provider name
  support_category VARCHAR(10),    -- NDIS support category (01-15)
  embedding vector(1536),          -- Semantic vector from embeddings API
  created_at TIMESTAMP
);
```

**Indexes:**
- `document_chunks_embedding_idx` — IVFFlat index on embedding for fast similarity search
- `document_chunks_user_idx` — For filtering by user
- `document_chunks_document_idx` — For document-specific retrieval

**Row-Level Security:**
- Users can only see/insert/update/delete their own chunks

## API Endpoints

### POST `/api/documents/chunk`

Chunks a document's raw text.

**Request:**
```json
{
  "documentId": "uuid",
  "rawText": "Full text extracted from document..."
}
```

**Response:**
```json
{
  "success": true,
  "chunked": 5,
  "totalTokens": 4250,
  "chunks": [
    {
      "chunk_index": 0,
      "content": "Preview of first chunk...",
      "tokens": 850
    }
  ]
}
```

### POST `/api/rag/embed-chunks`

Embeds all chunks for a document using Anthropic's embeddings API.

**Request:**
```json
{
  "documentId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "embedded": 5,
  "totalTokens": 4250,
  "message": "Successfully embedded 5 chunks"
}
```

### POST `/api/rag/retrieve`

Retrieves relevant chunks based on semantic similarity.

**Request:**
```json
{
  "query": "What therapy services did I receive?",
  "limit": 5,
  "documentId": "optional-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "chunks": [
    {
      "id": "chunk-uuid",
      "content": "Chunk text...",
      "tokens": 850,
      "doc_name": "therapy_report.pdf",
      "doc_date": "2024-03-15",
      "provider_name": "Therapy Works",
      "document_id": "doc-uuid",
      "similarity": 0.87
    }
  ]
}
```

### POST `/api/rag/ask`

Main RAG endpoint - answers user questions about documents.

**Request:**
```json
{
  "query": "What therapy services did I receive in March?",
  "documentId": "optional-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "answer": "Based on your therapy report from March 2024, you received occupational therapy sessions with Therapy Works. The report indicates 4 sessions focused on...",
  "sources": [
    {
      "chunk_id": "uuid",
      "document_id": "uuid",
      "doc_name": "therapy_report_march.pdf",
      "doc_date": "2024-03-20",
      "provider_name": "Therapy Works",
      "similarity_score": 92,
      "excerpt": "Occupational therapy session focusing on daily living skills..."
    }
  ],
  "chunks_used": 3
}
```

## Frontend

### "Ask Documents" Page

Located at `/dashboard/ask`

**Features:**
- Clean, intuitive chat interface
- Example questions for first-time users
- Real-time answer generation with loading states
- Source citations with document names, dates, and excerpt previews
- Error handling with user-friendly messages

### DocumentRAGChat Component

Reusable React component (`components/DocumentRAGChat.tsx`) that can be:
- Embedded in dashboard
- Used on dedicated page
- Integrated into document viewers

## Integration with Document Upload

When a document is uploaded and processed:

1. **Extract** (existing) → saves raw_text
2. **NEW: Chunk** → splits into chunks
3. **NEW: Embed** → generates and stores embeddings
4. **User can now ask** questions about that document

## Performance Considerations

### Token Economics

- **Chunking:** Free (client-side text processing)
- **Embedding:** ~$0.02 per 1M tokens
  - Average document: 3KB → 750 tokens → $0.000015
  - Batch processing 10 chunks at once
- **Retrieval:** Free (vector search in database)
- **Generation:** ~$0.015 per 1K tokens (Claude)
  - Typical answer: 200 tokens → $0.003

**Cost per question:** ~$0.003-0.005

### Optimization Strategies

1. **Batch embeddings** — Process multiple chunks in one API call
2. **Caching** — Cache popular query embeddings
3. **Hybrid search** — Combine semantic + keyword matching (future)
4. **Reranking** — Use smaller model to rerank before Claude (future)

## Evaluation

### Evaluation Script

Run: `npx ts-node scripts/evaluate-rag.ts`

Tests 5 predefined questions and measures:
- **Relevance** — Does answer match the question?
- **Grounding** — Are claims supported by source documents?
- **Citations** — Are sources properly cited?

**Output:** `evaluation-results.json`

Example results:
```json
{
  "timestamp": "2024-04-07T23:00:00Z",
  "testCases": 5,
  "passed": 4,
  "total": 5,
  "passRate": 0.8,
  "metrics": {
    "relevance": 0.82,
    "grounding": 0.85,
    "citations": 0.78
  }
}
```

## System Prompt

The RAG system uses this system prompt for answer generation:

```
You are an NDIS (National Disability Insurance Scheme) expert assistant. 
Your role is to help users understand their NDIS documents, including 
invoices, receipts, therapy reports, and plan reviews.

Answer questions about NDIS documents using ONLY the provided context. 
If the information is not available in the documents, clearly state: 
"I don't have that information in your documents."

Be concise, helpful, and always cite which documents you're referencing 
when possible. Format your response for easy reading with clear paragraphs.
```

## Data Flow Example

```
User uploads: therapy_report_march.pdf
  ↓
Extract text: "Patient received 4 OT sessions in March..."
  ↓
Chunk into 3-5 segments (500-1000 tokens each)
  ↓
Embed each chunk using Anthropic API
  ↓
Store in document_chunks table with embeddings in pgvector
  ↓
User asks: "What therapy services did I receive in March?"
  ↓
Embed question using same Anthropic API
  ↓
Search document_chunks using pgvector cosine similarity
  ↓
Find top 5 chunks (92%, 87%, 83%, 79%, 71% similarity)
  ↓
Send chunks to Claude with system prompt and question
  ↓
Claude generates: "Based on your March 2024 therapy report, 
                   you received 4 occupational therapy sessions 
                   focused on daily living skills..."
  ↓
Return answer + sources with doc name, date, and excerpts
  ↓
User sees answer with clickable source citations
```

## Limitations & Future Enhancements

### Current Limitations
- No multi-turn conversation history (each query independent)
- No document filtering UI (filter via API only)
- No custom RAG model fine-tuning
- Semantic search only (no keyword fallback yet)

### Planned Enhancements
- **Conversation history** — Multi-turn with context
- **Metadata filtering** — "Only show therapy reports after Jan 2024"
- **Hybrid search** — Combine semantic + BM25 keyword matching
- **Reranking** — Use smaller model to rerank before Claude
- **PDF export** — Export conversation + sources as PDF
- **Fine-tuning** — Custom embeddings model for NDIS domain
- **Caching** — Cache embeddings for repeated queries
- **Analytics** — Track popular questions and usage patterns

## Security

### Row-Level Security (RLS)

All tables use RLS to ensure users see only their own data:

```sql
-- Users can only see their own chunks
CREATE POLICY "Users can read their own chunks"
ON document_chunks FOR SELECT
USING (auth.uid() = user_id);
```

### Data Privacy

- Embeddings stored in user's own Supabase instance
- No data sent to third parties (only Anthropic/OpenAI for embeddings + Claude)
- Session-based auth with Supabase
- Signed URLs for document downloads

## Testing

### Manual Testing Checklist

- [ ] Upload a PDF document
- [ ] Verify chunks created in `document_chunks` table
- [ ] Verify embeddings stored (non-null vectors)
- [ ] Ask a question related to document
- [ ] Verify answer references correct document
- [ ] Verify sources show correct excerpts and dates
- [ ] Test with multiple documents
- [ ] Test question with no matching documents (should say "I don't have...")

### Automated Evaluation

Run evaluation script:
```bash
npx ts-node scripts/evaluate-rag.ts
```

Checks:
- Relevance of answers to questions
- Grounding in source documents
- Citation accuracy
- Overall pass rate

## Deployment

### Database Migrations

Apply migrations in order:
1. `migrations/001_add_vector_embeddings.sql` (if not already applied)
2. `migrations/002_add_document_chunks_for_rag.sql` ← NEW

```bash
# Via Supabase CLI
supabase db push

# Or manually in Supabase SQL editor
```

### Environment Variables

Required:
- `ANTHROPIC_API_KEY` — For embeddings and Claude
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Anon key
- `SUPABASE_SERVICE_ROLE_KEY` — For server-side operations

Optional:
- `OPENAI_API_KEY` — Fallback for embeddings if Anthropic fails
- `NEXT_PUBLIC_APP_URL` — For RAG endpoint URLs
- `SAVE_RAG_HISTORY` — Set to "true" to save conversation history

### Vercel Deployment

The system auto-deploys to Vercel when you push to GitHub:

1. Push code to GitHub
2. Vercel detects changes
3. Builds and deploys
4. APIs available at `https://your-domain.vercel.app/api/rag/*`

## Monitoring

### Logs to Check

- Claude API logs for answer generation errors
- Embeddings API logs for chunking/retrieval failures
- Supabase RLS policy violations
- Vector search performance (pgvector query time)

### Metrics to Track

- Average query response time
- Embedding generation time per chunk
- Vector search latency (should be <100ms with IVFFlat)
- User satisfaction with answer relevance
- Most common questions asked

## Cost Breakdown (Estimated Monthly)

For 100 users, 500 documents average, 10 chunks per doc:

| Service | Usage | Cost |
|---------|-------|------|
| Embeddings (Anthropic) | 50K chunks × 750 tokens | $0.75 |
| Claude Answers | 100 users × 10 q/day × 200 tokens | $30 |
| Supabase (pgvector) | Included in postgres | $25-50 |
| **Total** | | **$55-80/month** |

## Resources

- [Anthropic Embeddings API](https://docs.anthropic.com/embeddings)
- [pgvector Extension](https://github.com/pgvector/pgvector)
- [Supabase Documentation](https://supabase.com/docs)
- [NDIS Support Categories](https://www.ndis.gov.au/participants/support-categories)
