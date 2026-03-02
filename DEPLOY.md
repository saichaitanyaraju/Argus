# Argus Deployment Guide

## Quick Deploy to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "feat: switch AI to open-source LLM backend"
git push origin main
```

### 2. Deploy on Vercel

1. Go to https://vercel.com and sign in.
2. Click "Add New Project".
3. Import your GitHub repository: `saichaitanyaraju/Argus`.
4. Configure:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add Environment Variables (Project Settings > Environment Variables):

```env
# Open-source model via OpenAI-compatible API (default provider: Groq)
OPENAI_COMPAT_API_KEY=your_groq_api_key
OPENAI_COMPAT_BASE_URL=https://api.groq.com/openai/v1
OPENAI_COMPAT_MODEL=llama-3.3-70b-versatile

# Supabase (client-side)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

6. Click Deploy.

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

## Environment Variables (`.env.local`)

```env
# Open-source model via OpenAI-compatible API
OPENAI_COMPAT_API_KEY=your_groq_api_key
OPENAI_COMPAT_BASE_URL=https://api.groq.com/openai/v1
OPENAI_COMPAT_MODEL=llama-3.3-70b-versatile

# Optional aliases (supported)
# GROQ_API_KEY=your_groq_api_key
# GROQ_MODEL=llama-3.3-70b-versatile

# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## API Endpoints

- `POST /api/agent` - Ask the AI model with project context.
- `POST /api/agent` with `{ "mode": "health" }` - Connectivity precheck.
- `GET /api/ai-health` - Lightweight AI online/offline status for UI indicators.

## Troubleshooting

### Build fails

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### AI not responding

- Verify `OPENAI_COMPAT_API_KEY` (or `GROQ_API_KEY`) is set in Vercel.
- Verify `OPENAI_COMPAT_BASE_URL` is reachable.
- Verify `OPENAI_COMPAT_MODEL` exists for your provider account.
- Check Vercel Function logs for `/api/agent`.

