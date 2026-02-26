# Argus Deployment Guide

## Quick Deploy to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "feat: complete Argus implementation with Lyzr AI integration"
git push origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository: `saichaitanyaraju/Argus`
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. Add Environment Variables (in Vercel Dashboard > Project Settings > Environment Variables):

```
LYZR_API_KEY=sk-default-N0uuFzNtm7NVzE4BUyDgGrgRxXobr1zC
LYZR_AGENT_ID=69a0206173b2968d07361460
LYZR_USER_ID=chaitanyaraju567@gmail.com
LYZR_API_ENDPOINT=https://agent-prod.studio.lyzr.ai/v3/inference/chat/
NEXT_PUBLIC_SUPABASE_URL=https://ybjscpyxaauwntdxazbt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlianNjcHl4YWF1d250ZHhhemJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjAxNTMsImV4cCI6MjA4NzU5NjE1M30.h3UnZh39xEFEA6i8xqearmpHz9ik7LJM64S-0s_T8WE
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlianNjcHl4YWF1d250ZHhhemJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyMDE1MywiZXhwIjoyMDg3NTk2MTUzfQ.hdmOeeUHJafB-sZQZ6TJ_URd6vJO1Xd4ZcCTC_xrDHw
```

6. Click "Deploy"

### 3. Set Up Supabase Database

1. Go to your Supabase project: https://ybjscpyxaauwntdxazbt.supabase.co
2. Navigate to the SQL Editor
3. Open and run the file: `supabase/schema.sql`
4. This will create all tables, RLS policies, and seed the demo project

### 4. Configure Storage Bucket

1. In Supabase Dashboard, go to Storage
2. Ensure the `project-files` bucket exists (created by schema.sql)
3. Set bucket to public if not already done

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create `.env.local` in the project root:

```env
# Lyzr AI Agent
LYZR_API_KEY=sk-default-N0uuFzNtm7NVzE4BUyDgGrgRxXobr1zC
LYZR_AGENT_ID=69a0206173b2968d07361460
LYZR_USER_ID=chaitanyaraju567@gmail.com
LYZR_API_ENDPOINT=https://agent-prod.studio.lyzr.ai/v3/inference/chat/

# Supabase (Client-side)
VITE_SUPABASE_URL=https://ybjscpyxaauwntdxazbt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlianNjcHl4YWF1d250ZHhhemJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjAxNTMsImV4cCI6MjA4NzU5NjE1M30.h3UnZh39xEFEA6i8xqearmpHz9ik7LJM64S-0s_T8WE

# Supabase (Server-side only)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlianNjcHl4YWF1d250ZHhhemJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyMDE1MywiZXhwIjoyMDg3NTk2MTUzfQ.hdmOeeUHJafB-sZQZ6TJ_URd6vJO1Xd4ZcCTC_xrDHw
```

## Features Implemented

- ✅ Lyzr AI Agent Integration
- ✅ Project Context with global state
- ✅ Multi-project support
- ✅ Landing page with AI Ask Bar
- ✅ Dashboard with 4 modules (Manpower, Equipment, Progress, Cost)
- ✅ Project Overview dashboard
- ✅ Excel/CSV upload with fuzzy column mapping
- ✅ Chat interface with AI agent
- ✅ Auto-ask from landing page
- ✅ Typewriter placeholder animation
- ✅ Responsive design
- ✅ Dark theme with orange accent

## API Endpoints

- `POST /api/agent` - Send message to Lyzr AI agent

## Troubleshooting

### Build fails
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Supabase connection issues
- Verify environment variables are set correctly
- Check RLS policies allow access
- Ensure tables are created

### Lyzr agent not responding
- Verify LYZR_API_KEY is correct
- Check agent ID matches your Lyzr agent
- Review Vercel function logs
