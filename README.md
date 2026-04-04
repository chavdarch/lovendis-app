# loveNDIS 💜

**Family-first NDIS document management for Australian families.**

loveNDIS makes it simple to organise NDIS receipts, invoices, and therapy reports. Upload a document, and AI extracts the key details automatically. Track your NDIS budget by support category. No more spreadsheets.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database + Auth | Supabase (PostgreSQL + Auth + Storage) |
| AI Extraction | OpenAI GPT-4o |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui + Radix UI |
| Deployment | Vercel |
| Language | TypeScript throughout |

---

## Features (MVP)

- 🔐 **Auth** — Email/password sign up & login via Supabase
- 📄 **Document Upload** — Drag & drop PDF/JPG/PNG uploads
- 🤖 **AI Extraction** — GPT-4o reads receipts & invoices, extracts provider, date, amount, and NDIS category
- 💰 **Budget Tracking** — Set allocations per NDIS support category, track spending vs budget
- 👤 **Participants** — Support multiple NDIS participants per family
- 📊 **Dashboard** — Overview of spending, document stats, plan timeline

---

## Local Development Setup

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- A Supabase account (free tier works)
- An OpenAI API key

### 1. Clone and install

```bash
git clone <your-repo>
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
3. Run `supabase/schema.sql` — creates all tables with RLS policies
4. Run `supabase/storage.sql` — creates the documents storage bucket

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
| `OPENAI_API_KEY` | OpenAI API key | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

> ⚠️ **Security:** Never commit `.env.local` to git. The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — keep it server-side only.

---

## Supabase Setup (Step by Step)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a name, database password, and region (Australia recommended: `ap-southeast-2`)
3. Wait for project to spin up (~2 min)

### 2. Run Schema SQL

1. In Supabase dashboard → **SQL Editor** → **New Query**
2. Paste the contents of `supabase/schema.sql`
3. Click **Run**

### 3. Run Storage SQL

1. New Query in SQL Editor
2. Paste the contents of `supabase/storage.sql`
3. Click **Run**

### 4. Enable Email Auth

1. Supabase dashboard → **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. Optionally disable email confirmation for development:
   - Authentication → Settings → Disable "Confirm email"

### 5. Copy API Keys

1. Settings → API
2. Copy `URL` → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

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
│   │   ├── documents/      # Document list + upload
│   │   ├── budget/         # Budget tracking
│   │   ├── participants/   # Participant management
│   │   └── settings/       # Account settings
│   ├── api/
│   │   └── documents/
│   │       ├── route.ts          # GET/POST documents
│   │       └── extract/route.ts  # AI extraction endpoint
│   └── layout.tsx          # Root layout
├── components/
│   ├── Sidebar.tsx
│   ├── CategoryBadge.tsx
│   ├── BudgetProgress.tsx
│   ├── SpendingChart.tsx
│   ├── DocumentCard.tsx
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
