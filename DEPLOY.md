# Argus — Deployment Guide

## Prerequisites
- Node.js 18+
- Git
- A free [Supabase](https://supabase.com) account
- A [GitHub](https://github.com) account (for GitHub Pages hosting)

---

## Part 1 — Supabase Setup (Backend)

### 1.1 Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) → Sign in → **New Project**
2. Name: `argus` | Region: closest to you | Set a DB password → **Create Project**
3. Wait ~2 minutes for provisioning

### 1.2 Run the Database Schema
1. Supabase Dashboard → **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open `supabase/migrations/001_initial_schema.sql` from the project folder
4. Paste the entire file content → click **Run**
5. Confirm in **Table Editor** that these tables exist:
   - `uploads`, `manpower_records`, `equipment_records`, `progress_records`, `cost_records`, `dashboard_specs`

### 1.3 Create Storage Buckets
1. Supabase Dashboard → **Storage** → **New bucket**
   - Name: `uploads` | Public access: **OFF** → Create
2. **New bucket** again:
   - Name: `reports` | Public access: **OFF** → Create

### 1.4 Storage Access Policies
In SQL Editor, run this:

```sql
CREATE POLICY "public_upload_objects"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('uploads', 'reports'));

CREATE POLICY "public_read_objects"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('uploads', 'reports'));
```

### 1.5 Get Your API Keys
1. Supabase Dashboard → **Project Settings** (gear icon) → **API**
2. Copy these two values — you'll need them shortly:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public key** (long JWT string)

---

## Part 2 — Deploy Edge Functions

### 2.1 Install the Supabase CLI
```bash
npm install -g supabase
```

### 2.2 Login and Link to Your Project
```bash
supabase login
# Opens browser — log in with your Supabase account

supabase link --project-ref YOUR_PROJECT_REF
# Your project ref is the part after https:// in your project URL
<<<<<<< HEAD
# e.g. if URL is https://inobrxqbqtdzxnywecqdb.supabase.co
# then: supabase link --project-ref inobrxqbqtdzxnywecqdb
=======
# e.g. if URL is https://YOUR_PROJECT_REF.supabase.co
# then: supabase link --project-ref YOUR_PROJECT_REF
>>>>>>> 89c15af (Fix: cost module, xlsx upload, security + deploy fixes)
```

### 2.3 Deploy All Four Functions
Run from the root of the `argus/` folder:
```bash
supabase functions deploy process-upload
supabase functions deploy get-dashboard
supabase functions deploy agent-brain
supabase functions deploy export-report
```

### 2.4 Verify
Supabase Dashboard → **Edge Functions** — all 4 should show green/deployed status.

---

## Part 3 — Local Development

### 3.1 Configure Environment Variables
```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key_here
```

### 3.2 Install and Run
```bash
npm install
npm run dev
```

Visit **http://localhost:5173**

### 3.3 Test with Sample Data
1. Go to `http://localhost:5173/#/dashboard?module=manpower`
2. Upload `sample-data/manpower.csv` — dashboard auto-generates
3. Repeat for `equipment.csv`, `progress.csv`, `cost.csv`
4. Or click **"Load demo data"** to skip the upload step

---

## Part 4 — Deploy to GitHub Pages

### 4.1 Create a GitHub Repository
1. Go to [github.com](https://github.com) → **New repository**
2. Name it `argus` (or any name you prefer)
3. Set to **Public** (required for free GitHub Pages)
4. Don't add README/gitignore (the project already has one)

### 4.2 Push Your Code
```bash
cd argus
git init
git add .
git commit -m "Initial Argus commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/argus.git
git push -u origin main
```

### 4.3 Set the Base Path
Open `vite.config.ts` and update `base` to match your repo name:
```ts
export default defineConfig({
  plugins: [react()],
  base: '/argus/',   // ← Replace 'argus' with your actual repo name
  ...
})
```

Commit this change:
```bash
git add vite.config.ts
git commit -m "Set GitHub Pages base path"
git push
```

### 4.4 Add Repository Secrets
In GitHub → your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these two secrets:
| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon public key |

### 4.5 Create GitHub Actions Workflow
Create the file `.github/workflows/deploy.yml`:

```yaml
name: Deploy Argus to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Commit and push:
```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Pages deployment workflow"
git push
```

### 4.6 Enable GitHub Pages
1. GitHub repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **gh-pages** | Folder: **/ (root)**
4. Save

### 4.7 Access Your Live App
After the GitHub Action completes (~2 min):
```
https://YOUR_USERNAME.github.io/argus/
```

---

## Part 5 — Optional: Voice (Vapi)

1. Create an account at [vapi.ai](https://vapi.ai)
2. Get your **Public Key** from the dashboard
3. Store it as a Supabase secret (never expose in frontend):
   ```bash
   supabase secrets set VAPI_PUBLIC_KEY=your_key_here
   ```
4. The microphone button in the chat panel is ready for Vapi integration.
   Hook it up in `src/components/chat/ChatPanel.tsx` inside the `toggleVoice` function.

---

## Module Summary

| Module | Tab | Required CSV Columns |
|---|---|---|
| Man Power | `?module=manpower` | `date, discipline, planned_headcount, actual_headcount` |
| Equipment | `?module=equipment` | `timestamp, discipline, equipment_id, status` |
| Work Progress | `?module=progress` | `date, discipline, planned_progress_pct, actual_progress_pct` |
| Cost | `?module=cost` | `date, discipline, budget_amount, actual_spend` |

Sample CSVs for all 4 modules are in `sample-data/`.

---

## Troubleshooting

**Dashboard shows blank / "No data"**
→ Check `.env.local` has correct Supabase URL and anon key
→ Check that edge functions are deployed (`supabase functions list`)

**Upload fails with 403**
→ Check storage bucket policies in SQL Editor (Part 1.4)

**GitHub Pages shows 404**
→ Ensure `base` in `vite.config.ts` matches your repo name exactly
→ Ensure GitHub Pages is set to `gh-pages` branch

**Edge functions return 500**
→ Check Supabase Dashboard → **Edge Functions** → click a function → **Logs**
