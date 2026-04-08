# loveNDIS 💜

**AI-powered NDIS document intelligence platform for Australian families.**

Upload receipts, invoices, and therapy reports. AI extracts details automatically. Ask questions about your documents using RAG. Track your NDIS budget by support category. Everything you need in one place.

---

## Features

### 🤖 AI-Powered Document Intelligence
- **AI Extraction** — Claude reads PDFs & images, extracts provider, date, amount, category (95% accuracy)
- **RAG Chat** — "Ask Documents" — Ask natural language questions, get grounded answers with citations
- **Semantic Search** — Find docs by meaning using vector embeddings ("show me speech therapy invoices")
- **Smart Chunking** — Documents split into semantic chunks for efficient retrieval

### 📄 Document Management
- Drag & drop upload (PDF, JPG, PNG) — up to 50MB
- Auto-detection of document type (receipt, invoice, therapy report, plan review)
- View, search, filter, and delete documents
- Filter by NDIS support category or document type
- Download documents as CSV with all extracted data

### 💰 Budget Tracking
- Set allocations per NDIS support category
- Track spending vs budget in real-time
- Progress bars and percentage indicators
- Visual alerts when nearing limits
- Summary cards showing total allocated, spent, remaining

### 👥 Multi-Participant Support
- Manage multiple family members in one account
- Track allocations per participant
- View participant-specific documents and budgets

### 🔐 Security & Privacy
- Row-Level Security on all data
- Users only see their own documents
- Email confirmation for signups
- Secure API endpoints
- Zero exposure of sensitive data

### 📱 Responsive Design
- Mobile-friendly interface
- Works on phones, tablets, desktops
- Optimized for NDIS families on the go

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL + Auth) |
| Storage | Supabase Cloud Storage |
| AI/Extraction | Anthropic Claude (Opus + Haiku) |
| Vector Search | Supabase pgvector + Anthropic embeddings |
| Deployment | Vercel (auto-deploy from GitHub) |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm
- Supabase account (free tier works)
- Anthropic API key

### 1. Clone & Install

```bash
git clone https://github.com/chavdarch/lovendis-app.git
cd lovendis-app
npm install
```

### 2. Environment Setup

```bash
cp .env.local.example .env.local
```

Fill in your keys:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# AI
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Database Setup

Go to Supabase SQL Editor and run these in order:

1. **Enable pgvector:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Run core schema:** Copy contents of `supabase/schema.sql`

3. **Run storage setup:** Copy contents of `supabase/storage.sql`

4. **Enable RAG:** Copy contents of `migrations/002_add_document_chunks_for_rag.sql`

### 4. Start Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## API Endpoints

### Documents
- `POST /api/documents` — Upload document (extract + store)
- `GET /api/documents` — List user's documents
- `DELETE /api/documents/:id` — Delete document
- `POST /api/documents/search` — Semantic search documents
- `POST /api/documents/chunk` — Manual chunk trigger
- `POST /api/documents/rechunk` — Re-chunk all documents

### RAG (AI Q&A)
- `POST /api/rag/ask` — Ask question, get grounded answer with sources

---

## Project Structure

```
lovendis-app/
├── app/
│   ├── (auth)/           # Login & signup pages
│   ├── (dashboard)/      # Main app (auth-protected)
│   │   ├── dashboard/    # Overview & stats
│   │   ├── documents/    # Upload & manage docs
│   │   ├── ask/          # RAG chat interface
│   │   ├── budget/       # Budget tracking
│   │   ├── participants/ # Multi-user management
│   │   ├── settings/     # Account settings
│   │   └── debug/        # Dev tools
│   ├── api/              # API routes
│   └── layout.tsx        # Root layout
├── components/           # Reusable UI components
├── lib/
│   ├── supabase/         # Auth helpers
│   ├── chunking.ts       # Text splitting logic
│   └── utils.ts          # NDIS categories, helpers
├── types/                # TypeScript definitions
├── supabase/             # SQL schema files
├── migrations/           # Database migrations
├── scripts/              # Evaluation & testing
└── public/               # Static assets
```

---

## How RAG Works

1. **Upload Document** → Claude extracts text + metadata
2. **Chunking** → Text split into 500-1000 token chunks
3. **Embedding** → Each chunk converted to vector (1536 dims)
4. **Storage** → Chunks + vectors stored in pgvector
5. **Query** → User asks question
6. **Search** → Query embedded, top-5 similar chunks found
7. **Generation** → Claude generates answer from chunks
8. **Citation** → Sources shown with dates/providers

**Example:**
- Upload: `therapy_report_jan.pdf`
- Ask: "What therapy did I get in January?"
- Answer: "Based on your therapy report (Jan 15) from Sarah's Speech Therapy: You received 4 sessions of 1-hour speech therapy. Cost: $80/session ($320 total)."

---

## NDIS Support Categories

All 15 NDIS support categories supported:

- 01 — Daily Activities
- 02 — Health & Wellbeing
- 03 — Home Living
- 04 — Lifelong Learning
- 05 — Work
- 06 — Social & Community
- 07 — Relationships
- 08 — Choice & Control
- 09 — Daily Activities (CB)
- 10 — Plan Management
- 11 — Support Coordination
- 12 — Improved Living
- 13 — Improved Health
- 14 — Improved Learning
- 15 — Increased Work

---

## Evaluation & Testing

### Run RAG Evaluation

Test RAG quality on sample questions:

```bash
npx ts-node scripts/evaluate-rag.ts
```

Outputs metrics:
- Relevance (is answer on-topic?)
- Correctness (is it accurate?)
- Grounding (is it from the docs?)

### Manual Testing

1. Go to `/debug/rechunk` — re-chunk existing documents
2. Go to `/ask` — test the RAG chat
3. Try example questions provided in UI

---

## Deployment

### Deploy to Vercel

1. Push to GitHub:
```bash
git push origin main
```

2. Connect repo to Vercel (auto-deploys on push)

3. Add environment variables in Vercel dashboard

4. Done! Live at `https://your-domain.vercel.app`

### Custom Domain

Set up DNS:
- A record: `76.76.21.21`
- CNAME: `cname.vercel-dns.com`

---

## Database Schema

### Key Tables

**documents** — Extracted document metadata
- user_id, file_name, provider_name, doc_date, amount, support_category, file_type, description, extracted_data (JSON)

**document_chunks** — RAG chunks with embeddings
- user_id, document_id, content, tokens, embedding (pgvector), doc_metadata

**budgets** — Budget allocations
- user_id, participant_id, support_category, allocated_amount, year

**participants** — Family members
- user_id, name, ndis_plan_number, plan_year

**rag_conversations** — Chat history (future multi-turn support)
- user_id, title, created_at

**rag_messages** — Individual messages
- conversation_id, user_id, role, content, sources (JSONB)

All tables have RLS policies — users only access their own data.

---

## Performance

| Operation | Latency | Cost |
|-----------|---------|------|
| Upload + extract | 5-10s | ~$0.01 |
| Embed chunk | 200ms | ~$0.0002 |
| Semantic search | 100ms | ~$0 |
| RAG answer | 3-5s | ~$0.003 |

---

## Contributing

This is an MVP. Issues and PRs welcome!

- Found a bug? [Open an issue](https://github.com/chavdarch/lovendis-app/issues)
- Have an idea? [Start a discussion](https://github.com/chavdarch/lovendis-app/discussions)

---

## Privacy & Security

- All data encrypted in transit (HTTPS)
- Row-Level Security prevents data leakage
- No third-party tracking
- NDIS data never shared with external services
- Regular security audits (GitHub dependabot)

---

## Built With ❤️

For Australian families navigating the NDIS.

---

## License

MIT
