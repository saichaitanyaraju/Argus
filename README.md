# Argus - Project Visibility Copilot

Argus is a construction/oil-and-gas dashboard app that ingests Excel files, computes KPIs, and enables AI Q&A over your module data (Manpower, Equipment, Progress, Cost).

## Stack

- Frontend: Vite + React + TypeScript + Tailwind
- Backend: Vercel Serverless Functions (`/api/agent`, `/api/ai-health`)
- Database: Supabase
- AI: Open-source LLM via OpenAI-compatible API (default: Groq + `llama-3.3-70b-versatile`)

## Environment Variables

Create `.env.local`:

```env
# Supabase (client)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# AI backend (server)
OPENAI_COMPAT_API_KEY=your_groq_api_key
OPENAI_COMPAT_BASE_URL=https://api.groq.com/openai/v1
OPENAI_COMPAT_MODEL=llama-3.3-70b-versatile

# Optional aliases
# GROQ_API_KEY=your_groq_api_key
# GROQ_MODEL=llama-3.3-70b-versatile
```

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy (Vercel)

1. Push your branch to GitHub.
2. Import the repo in Vercel.
3. Set the env vars listed above in Project Settings > Environment Variables.
4. Deploy.

## API

### `POST /api/agent`

Ask the model with project context.

Request body:

```json
{
  "mode": "ask",
  "projectId": "uuid",
  "projectName": "Demo Project",
  "periodDate": "2026-03-02",
  "modules": ["manpower", "equipment"],
  "userMessage": "Summarize manpower risk",
  "sessionId": "session-123",
  "context": {}
}
```

Response:

```json
{
  "answer": "...",
  "raw": {}
}
```

### `POST /api/agent` health mode

```json
{ "mode": "health" }
```

### `GET /api/ai-health`

Returns:

```json
{ "status": "ok" }
```

or

```json
{ "status": "down" }
```

