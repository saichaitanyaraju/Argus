import { supabase } from './supabase';

export interface AskLyzrAgentArgs {
  projectId: string;
  projectName: string;
  periodDate: string | null;
  modules: string[];
  kpiSnapshots: any[];
  records: any[];
  userMessage: string;
  sessionId: string;
}

export interface LyzrAgentResponse {
  answer: string;
  raw: any;
}

/**
 * Calls the Lyzr AI Agent with project context and data
 */
export async function askLyzrAgent(args: AskLyzrAgentArgs): Promise<LyzrAgentResponse> {
  const {
    projectId,
    projectName,
    periodDate,
    modules,
    kpiSnapshots,
    records,
    userMessage,
    sessionId,
  } = args;

  const apiKey = import.meta.env.LYZR_API_KEY || 'sk-default-N0uuFzNtm7NVzE4BUyDgGrgRxXobr1zC';
  const agentId = import.meta.env.LYZR_AGENT_ID || '69a0206173b2968d07361460';
  const userId = import.meta.env.LYZR_USER_ID || 'chaitanyaraju567@gmail.com';
  const endpoint = import.meta.env.LYZR_API_ENDPOINT || 'https://agent-prod.studio.lyzr.ai/v3/inference/chat/';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      user_id: userId,
      agent_id: agentId,
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

/**
 * Fetches KPI snapshots for a project and modules
 */
export async function fetchKpiSnapshots(projectId: string, modules: string[]): Promise<any[]> {
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
export async function fetchModuleRecords(projectId: string, module: string): Promise<any[]> {
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
    .limit(100);

  if (error) {
    console.error(`Error fetching ${module} records:`, error);
    return [];
  }

  return data || [];
}

/**
 * Persists a message to the agent_messages table
 */
export async function persistAgentMessage(
  projectId: string,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  contextModules: string[] = []
): Promise<void> {
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
 * Fetches chat history for a session
 */
export async function fetchChatHistory(projectId: string, sessionId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('agent_messages')
    .select('*')
    .eq('project_id', projectId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }

  return data || [];
}
