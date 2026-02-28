# Argus — Project Visibility Copilot

[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

Argus is a **Project Visibility Copilot** for construction and oil & gas projects. Upload site Excel files, get instant dashboards and KPIs, and ask AI-powered questions about your project data.


## Features

- **Instant KPIs** — Auto-computed on Excel upload with fuzzy column mapping
- **Live Dashboards** — Real-time visualizations for Manpower, Equipment, Progress, and Cost
- **AI-Powered Q&A** — Ask questions in plain English, get answers from your real data (powered by Lyzr AI)
- **Multi-Project Support** — Switch between projects with a single click
- **Deterministic** — No AI hallucinations, answers are grounded in your uploaded data
- **Audit-Ready** — Timestamped records and full data lineage

## Tech Stack

- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL + Storage)
- **AI Agent**: Lyzr Chat Agent
- **Charts**: Recharts
- **Excel Parsing**: SheetJS (xlsx)

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- Vercel account (for deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/saichaitanyaraju/Argus.git
cd Argus

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev
```

### Database Setup

1. Go to your Supabase project SQL Editor
2. Run the schema from `supabase/schema.sql`
3. This creates all tables, RLS policies, and seeds the demo project

## Project Structure

```
argus/
├── api/                    # Vercel serverless functions
│   └── agent.ts           # Lyzr AI agent API endpoint
├── src/
│   ├── components/        # React components
│   │   ├── ai/           # AI-related components (AIAskBar, Typewriter)
│   │   ├── chat/         # Chat panel
│   │   ├── dashboard/    # Dashboard components (KPI cards, charts, etc.)
│   │   ├── how-it-works/ # How It Works section
│   │   ├── navbar/       # Navigation components
│   │   ├── ui/           # UI components (Badge, Footer, Logo)
│   │   └── upload/       # File upload zone
│   ├── context/          # React contexts
│   │   └── ProjectContext.tsx  # Global project state
│   ├── lib/              # Utility libraries
│   │   ├── demoData.ts   # Demo dashboard specs
│   │   ├── lyzrAgent.ts  # Lyzr AI agent client
│   │   └── supabase.ts   # Supabase client
│   ├── pages/            # Page components
│   │   ├── Landing.tsx   # Landing page
│   │   └── dashboard/    # Dashboard pages
│   │       ├── OverviewDashboard.tsx
│   │       ├── ManpowerDashboard.tsx
│   │       ├── EquipmentDashboard.tsx
│   │       ├── ProgressDashboard.tsx
│   │       └── CostDashboard.tsx
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   ├── App.tsx           # Main app component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── supabase/
│   └── schema.sql        # Database schema
├── .env.local            # Environment variables (not committed)
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vercel.json           # Vercel deployment config
└── vite.config.ts
```

## Environment Variables

Create `.env.local` with:

```env
# Lyzr AI Agent
LYZR_API_KEY=your_lyzr_api_key
LYZR_AGENT_ID=your_lyzr_agent_id
LYZR_USER_ID=your_email@example.com
LYZR_API_ENDPOINT=https://agent-prod.studio.lyzr.ai/v3/inference/chat/

# Supabase (Client-side)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Supabase (Server-side only)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Deployment

### Deploy to Vercel

```bash
# Push to GitHub
git add .
git commit -m "Ready for deployment"
git push origin main

# Deploy via Vercel CLI
npm i -g vercel
vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deployments.

### Environment Variables on Vercel

Add these in Vercel Dashboard > Project Settings > Environment Variables:

- `LYZR_API_KEY`
- `LYZR_AGENT_ID`
- `LYZR_USER_ID`
- `LYZR_API_ENDPOINT`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Usage

### Landing Page

1. Visit the home page
2. Use the AI Ask Bar to ask questions like:
   - "What is the overall project progress this week?"
   - "How many workers were on site yesterday?"
   - "Are we over budget on civil works?"
3. Click "Open Dashboard" to view detailed analytics

### Dashboard

1. Select a module: Manpower, Equipment, Progress, or Cost
2. Upload an Excel file or load demo data
3. View KPIs, charts, and insights
4. Ask the AI agent questions about the data

### File Upload

Supported formats: CSV, XLSX, XLS

The system automatically detects column names using fuzzy matching:
- `planned`, `plan`, `target` → `planned_count`
- `actual`, `act`, `current` → `actual_count`
- `discipline`, `trade`, `category` → `discipline`

## API

### POST /api/agent

Send a message to the Lyzr AI agent.

**Request:**
```json
{
  "projectId": "uuid",
  "projectName": "Demo Project",
  "periodDate": "2024-01-15",
  "modules": ["manpower", "equipment"],
  "userMessage": "What is the current manpower status?",
  "sessionId": "session-123"
}
```

**Response:**
```json
{
  "answer": "The current actual headcount is 221 workers...",
  "raw": { ... }
}
```

## Database Schema

### Tables

- `projects` — Project information
- `file_uploads` — Track uploaded files
- `manpower_records` — Manpower data
- `equipment_records` — Equipment data
- `progress_records` — Work progress data
- `cost_records` — Cost/financial data
- `kpi_snapshots` — Computed KPIs
- `agent_messages` — Chat history

See `supabase/schema.sql` for full schema.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

MIT License — see LICENSE file for details.

## Support

For issues and questions:
- GitHub Issues: [github.com/saichaitanyaraju/Argus/issues](https://github.com/saichaitanyaraju/Argus/issues)
- Email: chaitanyaraju567@gmail.com

---

Built with ❤️ for construction project control · Powered by Lyzr AI
