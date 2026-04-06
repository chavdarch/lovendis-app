# loveNDIS 💜

**Family-first NDIS document management for Australian families.**

loveNDIS makes it simple to organise NDIS receipts, invoices, and therapy reports. Upload a document, and AI extracts the key details automatically. Search documents by provider, description, or keywords using semantic search. Track your NDIS budget by support category. No more spreadsheets.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database + Auth | Supabase (PostgreSQL + Auth + Storage) |
| AI Extraction | Anthropic Claude (native PDF support) |
| Vector Search | Supabase pgvector + Anthropic embeddings |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui + Radix UI |
| Deployment | Vercel |
| Language | TypeScript throughout |

---

## Features (MVP)

- 🔐 **Auth** — Email/password sign up & login via Supabase
- 📄 **Document Upload** — Drag & drop PDF/JPG/PNG uploads
- 🤖 **AI Extraction** — Claude reads receipts & invoices, extracts provider, date, amount, and NDIS category (95% accuracy)
- 🔍 **Semantic Search** — Find documents by meaning ("show me all speech therapy invoices") using vector embeddings
- 💰 **Budget Tracking** — Set allocations per NDIS support category, track spending vs budget
- 👤 **Participants** — Support multiple NDIS participants per family
- 📊 **Dashboard** — Overview of spending, document stats, plan timeline

---

## Local Development Setup

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- A Supabase account (free tier works)
- An Anthropic API key

### 1. Clone and install

```bash
git clone https://github.com/chavdarch/lovendis-app.git
cd lovendis-app
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your values (see below).

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Run `migrations/001_add_vector_embeddings.sql` — enables pgvector extension for semantic search
4. Run `supabase/schema.sql` — creates all tables with RLS policies
5. Run `supabase/storage.sql` — creates the documents storage bucket

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable | Description | Where to find it |
|----------|-------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only!) | Supabase Dashboard → Settings → API |
| `ANTHROPIC_API_KEY` | Anthropic API key for extraction & embeddings | [console.anthropic.com](https://console.anthropic.com) |

> ⚠️ **Security:** Never commit `.env.local` to git. The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — keep it server-side only.

---

## Supabase Setup (Step by Step)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a name, database password, and region (Australia recommended: `ap-southeast-2`)
3. Wait for project to spin up (~2 min)

### 2. Run Vector Extension SQL

1. In Supabase dashboard → **SQL Editor** → **New Query**
2. Paste the contents of `migrations/001_add_vector_embeddings.sql`
3. Click **Run**

This enables pgvector for semantic document search.

### 3. Run Schema SQL

1. New Query in SQL Editor
2. Paste the contents of `supabase/schema.sql`
3. Click **Run**

### 4. Run Storage SQL

1. New Query in SQL Editor
2. Paste the contents of `supabase/storage.sql`
3. Click **Run**

### 5. Enable Email Auth

1. Supabase dashboard → **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. Optionally disable email confirmation for development:
   - Authentication → Settings → Disable "Confirm email"

### 6. Copy API Keys

1. Settings → API
2. Copy `URL` → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## How Vector Search Works

When you upload a document:

1. **Extraction** — Claude reads the PDF/image and extracts provider, date, amount, category
2. **Embedding** — The document text is converted to a vector (1536 dimensions) using Anthropic embeddings
3. **Storage** — The embedding is stored in Supabase pgvector alongside the document metadata
4. **Search** — When you search, your query is embedded and compared against all document embeddings using cosine similarity

Result: Find documents by meaning, not just keywords.

**Cost:** ~$0.0002 per document for embeddings (negligible at scale)

---

## Deployment to Vercel

### 1. Push to GitHub

```bash
git remote add origin https://github.com/your-org/lovendis-app.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repository
3. Framework: **Next.js** (auto-detected)

### 3. Set Environment Variables

In Vercel project settings → Environment Variables, add all four variables from `.env.local`.

### 4. Deploy

Vercel will auto-deploy on every push to `main`.

---

## Project Structure

```
lovendis-app/
├── app/
│   ├── (auth)/
│   │   ├── login/          # Login page
│   │   └── signup/         # Sign up page
│   ├── (dashboard)/
│   │   ├── layout.tsx      # Sidebar + auth guard
│   │   ├── dashboard/      # Overview dashboard
│   │   ├── documents/      # Document list + search + upload
│   │   ├── budget/         # Budget tracking
│   │   ├── participants/   # Participant management
│   │   └── settings/       # Account settings
│   ├── api/
│   │   └── documents/
│   │       ├── route.ts           # GET/POST documents
│   │       ├── extract/route.ts   # AI extraction endpoint
│   │       ├── embed/route.ts     # Vector embedding endpoint
│   │       └── search/route.ts    # Semantic search endpoint
│   └── layout.tsx          # Root layout
├── components/
│   ├── Sidebar.tsx
│   ├── CategoryBadge.tsx
│   ├── BudgetProgress.tsx
│   ├── SpendingChart.tsx
│   ├── DocumentCard.tsx
│   ├── DocumentSearch.tsx
│   ├── DocumentUploadClient.tsx
│   ├── DocumentsClientWrapper.tsx
│   ├── BudgetClientWrapper.tsx
│   └── ParticipantsClientWrapper.tsx
├── lib/
│   ├── utils.ts            # Helpers + NDIS category data
│   └── supabase/
│       ├── client.ts       # Browser client
│       ├── server.ts       # Server component client
│       └── middleware.ts   # Auth middleware
├── types/
│   └── index.ts            # TypeScript types
├── supabase/
│   ├── schema.sql          # Database schema + RLS
│   └── storage.sql         # Storage bucket + policies
├── migrations/
│   └── 001_add_vector_embeddings.sql  # pgvector setup
└── middleware.ts           # Route protection
```

---

## NDIS Support Categories

The app supports all 15 NDIS support categories:

| Code | Category |
|------|----------|
| 01 | Daily Activities |
| 02 | Health & Wellbeing |
| 03 | Home Living |
| 04 | Lifelong Learning |
| 05 | Work |
| 06 | Social & Community |
| 07 | Relationships |
| 08 | Choice & Control |
| 09 | Daily Activities (CB) |
| 10 | Plan Management |
| 11 | Support Coordination |
| 12 | Improved Living |
| 13 | Improved Health |
| 14 | Improved Learning |
| 15 | Increased Work |

---

## Contributing

This is an MVP. Issues and PRs welcome. Built with love for Australian families navigating the NDIS.

---

## License

MIT
