# Argus — Complete Setup Guide

## Overview
Argus is a construction intelligence dashboard that uses:
- **Frontend**: React + TypeScript + Vite + Tailwind + Recharts (static)
- **Backend**: Supabase (Postgres + Storage + Edge Functions)
- **Hosting**: GitHub Pages (HashRouter compatible)

---

## Step 1: Supabase Project Setup

### 1.1 Create Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Name it `argus`, choose a region, set a DB password
4. Wait for provisioning (~2 min)

### 1.2 Run SQL Schema
1. In Supabase Dashboard → **SQL Editor**
2. Open `supabase/migrations/001_initial_schema.sql`
3. Paste the entire file and click **Run**
4. Confirm all tables are created in **Table Editor**

### 1.3 Create Storage Buckets
1. Go to **Storage** in the sidebar
2. Click **New bucket** → Name: `uploads` → **Public**: OFF → Create
3. Click **New bucket** → Name: `reports` → **Public**: OFF → Create

### 1.4 Storage Policies (for public mode)
In SQL Editor, run:
```sql
-- Allow public uploads
CREATE POLICY "public_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('uploads','reports'));
CREATE POLICY "public_select" ON storage.objects FOR SELECT USING (bucket_id IN ('uploads','reports'));
```

---

## Step 2: Deploy Edge Functions

### 2.1 Install Supabase CLI
```bash
npm install -g supabase
```

### 2.2 Login and link project
```bash
supabase login
supabase link --project-ref inobrxqbqtdzxnywecqdb
```

### 2.3 Deploy all functions
```bash
supabase functions deploy process-upload
supabase functions deploy get-dashboard
supabase functions deploy agent-brain
supabase functions deploy export-report
```

### 2.4 Verify deployment
In Supabase Dashboard → **Edge Functions** — all 4 should show as deployed.

---

## Step 3: Frontend Configuration

### 3.1 Set environment variables
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```
VITE_SUPABASE_URL=https://inobrxqbqtdzxnywecqdb.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon key from Project Settings → API>
```

### 3.2 Run locally
```bash
npm install
npm run dev
```
Visit: http://localhost:5173

### 3.3 Test with sample data
1. Go to `/#/dashboard?module=manpower`
2. Upload `sample-data/manpower.csv`
3. Dashboard should auto-generate
4. Repeat for equipment and progress modules

---

## Step 4: Deploy to GitHub Pages

### 4.1 Configure base path
In `vite.config.ts`, update `base`:
```ts
base: '/argus/',  // Replace 'argus' with your repo name
```

### 4.2 Build
```bash
npm run build
```

### 4.3 Deploy
Option A — GitHub Actions (recommended):
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to **Repository Settings → Secrets**.

Option B — Manual:
```bash
npm install -g gh-pages
npx gh-pages -d dist
```

---

## Step 5: Voice (Vapi) — Optional

1. Create account at [vapi.ai](https://vapi.ai)
2. Get your Public Key
3. Store in Supabase secrets (NOT in frontend):
   ```bash
   supabase secrets set VAPI_PUBLIC_KEY=your_key_here
   ```
4. The mic button in the chat panel is a UI placeholder ready for Vapi integration.
   See `src/components/chat/ChatPanel.tsx` — the `toggleVoice` function for the integration point.

---

## File Structure
```
argus/
├── src/
│   ├── App.tsx                        # Routes (HashRouter)
│   ├── main.tsx                       # Entry point
│   ├── index.css                      # Global styles + Tailwind
│   ├── types/index.ts                 # TypeScript types
│   ├── lib/
│   │   ├── supabase.ts                # Supabase client
│   │   └── demoData.ts                # Demo specs (no upload needed)
│   ├── pages/
│   │   ├── Landing.tsx                # Home page
│   │   └── Dashboard.tsx              # Main dashboard
│   └── components/
│       ├── ui/                        # ArgusLogo, Badge
│       ├── dashboard/                 # KPICard, ChartRenderer, DataTable, VisualCard, InsightsPanel, Filters
│       ├── upload/                    # UploadZone
│       └── chat/                      # ChatPanel
├── supabase/
│   ├── functions/
│   │   ├── process-upload/            # Parse CSV/XLSX → KPIs → Spec → DB
│   │   ├── get-dashboard/             # Fetch latest spec from DB
│   │   ├── agent-brain/               # Deterministic Q&A agent
│   │   └── export-report/             # Generate CSV/PDF report
│   └── migrations/
│       └── 001_initial_schema.sql     # Full DB schema
├── sample-data/
│   ├── manpower.csv
│   ├── equipment.csv
│   └── progress.csv
├── .env.example
├── vite.config.ts
├── tailwind.config.js
└── SETUP.md
```

---

## Column Mapping (Flexible)

The upload parser is fuzzy — it normalizes column names. These all work:
- `Planned Headcount`, `planned_headcount`, `PlannedHeadcount` → mapped to `planned_headcount`
- `Actual Headcount`, `actual_headcount`, `ActualHeadcount` → mapped to `actual_headcount`
- `Equipment ID`, `equipment_id`, `EquipmentID` → mapped to `equipment_id`

---

## What's Next (Phase 2)

- [ ] Authentication (Supabase Auth)
- [ ] Per-user/per-project data isolation
- [ ] XLSX parsing (add `xlsx` npm package to Edge Function)
- [ ] PDF export (add `pdfmake` or `jspdf`)
- [ ] Live Vapi voice integration
- [ ] Optional LLM (Claude API) in `agent-brain` for richer responses
- [ ] Anomaly detection & alert engine
- [ ] Safety/incident tracking module
- [ ] Mobile-optimized layout
