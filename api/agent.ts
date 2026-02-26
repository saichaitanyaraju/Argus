import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const LYZR_API_KEY = process.env.LYZR_API_KEY || 'sk-default-N0uuFzNtm7NVzE4BUyDgGrgRxXobr1zC';
const LYZR_AGENT_ID = process.env.LYZR_AGENT_ID || '69a0206173b2968d07361460';
const LYZR_USER_ID = process.env.LYZR_USER_ID || 'chaitanyaraju567@gmail.com';
const LYZR_API_ENDPOINT = process.env.LYZR_API_ENDPOINT || 'https://agent-prod.studio.lyzr.ai/v3/inference/chat/';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Initialize Supabase client with service role for server-side operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AgentRequestBody {
  projectId: string;
  projectName: string;
  periodDate?: string;
  modules: string[];
  userMessage: string;
  sessionId: string;
}

/**
 * Fetches KPI snapshots for a project and modules
 */
async function fetchKpiSnapshots(projectId: string, modules: string[]) {
  const { data, error } = await supabase
    .from('kpi_snapshots')
    .select('*')
    .eq('project_id', projectId)
    .in('module', modules)
    .order('computed_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching KPI snapshots:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetches records from module tables for a project
 */
async function fetchModuleRecords(projectId: string, module: string) {
  const tableMap: Record<string, string> = {
    manpower: 'manpower_records',
    equipment: 'equipment_records',
    progress: 'progress_records',
    cost: 'cost_records',
  };

  const tableName = tableMap[module];
  if (!tableName) return [];

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error(`Error fetching ${module} records:`, error);
    return [];
  }

  return data || [];
}

/**
 * Persists a message to the agent_messages table
 */
async function persistAgentMessage(
  projectId: string,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  contextModules: string[] = []
) {
  const { error } = await supabase.from('agent_messages').insert({
    project_id: projectId,
    session_id: sessionId,
    role,
    content,
    context_modules: contextModules,
  });

  if (error) {
    console.error('Error persisting agent message:', error);
  }
}

/**
 * Calls the Lyzr AI Agent with project context and data
 */
async function askLyzrAgent(
  projectId: string,
  projectName: string,
  periodDate: string | null,
  modules: string[],
  kpiSnapshots: any[],
  records: any[],
  userMessage: string,
  sessionId: string
) {
  const res = await fetch(LYZR_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': LYZR_API_KEY,
    },
    body: JSON.stringify({
      user_id: LYZR_USER_ID,
      agent_id: LYZR_AGENT_ID,
      session_id: `${projectId}-${sessionId}`,
      message: `
[DATA CONTEXT]
Project: ${projectName}
Period: ${periodDate || 'Latest'}
Module(s): ${modules.join(', ')}
KPI Snapshots: ${JSON.stringify(kpiSnapshots)}
Records Sample (first 20 rows): ${JSON.stringify(records.slice(0, 20))}
[END CONTEXT]

[USER QUESTION]
${userMessage}
`,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Lyzr API error: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  return {
    answer: data.response || data.message || 'No response from agent',
    raw: data,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      projectId,
      projectName,
      periodDate,
      modules,
      userMessage,
      sessionId,
    } = req.body as AgentRequestBody;

    if (!projectId || !userMessage || !sessionId) {
      return res.status(400).json({
        error: 'Missing required fields: projectId, userMessage, sessionId',
      });
    }

    // Persist user message
    await persistAgentMessage(projectId, sessionId, 'user', userMessage, modules);

    // Fetch KPI snapshots and records for context
    const kpiSnapshots = await fetchKpiSnapshots(projectId, modules);
    const allRecords: any[] = [];

    for (const mod of modules) {
      const records = await fetchModuleRecords(projectId, mod);
      allRecords.push(...records);
    }

    // Call Lyzr agent
    const response = await askLyzrAgent(
      projectId,
      projectName || 'Demo Project',
      periodDate || new Date().toISOString().split('T')[0],
      modules,
      kpiSnapshots,
      allRecords,
      userMessage,
      sessionId
    );

    // Persist assistant message
    await persistAgentMessage(projectId, sessionId, 'assistant', response.answer, modules);

    return res.status(200).json({
      answer: response.answer,
      raw: response.raw,
    });
  } catch (error) {
    console.error('Agent API error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
