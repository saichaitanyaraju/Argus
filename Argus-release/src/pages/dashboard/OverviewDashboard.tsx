import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  Wrench,
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  MessageSquare,
  X,
  Bot,
  Send,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { supabase } from '../../lib/supabase';
import { Module, DashboardSpec, ChatMessage, KPI } from '../../types';
import { getDemoSpec } from '../../lib/demoData';
import {
  askLyzrAgent,
  fetchKpiSnapshots,
  fetchModuleRecords,
  persistAgentMessage,
  fetchChatHistory,
} from '../../lib/lyzrAgent';
import KPICard from '../../components/dashboard/KPICard';
import VisualCard from '../../components/dashboard/VisualCard';
import InsightsPanel from '../../components/dashboard/InsightsPanel';
import UploadZone from '../../components/upload/UploadZone';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';

interface ModuleSummary {
  module: Module;
  label: string;
  icon: typeof Users;
  color: string;
  bgColor: string;
  hasData: boolean;
  kpis: KPI[];
  lastUpdated?: string;
}

const MODULE_CONFIG: Record<Module, { label: string; icon: typeof Users; color: string; bgColor: string }> = {
  manpower: { label: 'Man Power', icon: Users, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  equipment: { label: 'Equipment', icon: Wrench, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  progress: { label: 'Work Progress', icon: BarChart3, color: 'text-green-400', bgColor: 'bg-green-500/10' },
  cost: { label: 'Cost', icon: DollarSign, color: 'text-[#FF6A00]', bgColor: 'bg-[#FF6A00]/10' },
};

export default function OverviewDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { project, projectId, projectName } = useProject();

  const [specs, setSpecs] = useState<Partial<Record<Module, DashboardSpec>>>({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);

  const modules: Module[] = ['manpower', 'equipment', 'progress', 'cost'];

  // Handle auto-ask from URL params
  useEffect(() => {
    const q = searchParams.get('q');
    const autoask = searchParams.get('autoask');

    if (autoask === 'true' && q) {
      setChatOpen(true);
      setChatInput(q);
      const timer = setTimeout(() => {
        handleSendMessage(q);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Load chat history when chat opens
  useEffect(() => {
    if (chatOpen && projectId) {
      loadChatHistory();
    }
  }, [chatOpen, projectId]);

  const loadChatHistory = async () => {
    if (!projectId) return;
    const history = await fetchChatHistory(projectId, sessionId);
    if (history.length > 0) {
      const messages: ChatMessage[] = history.map((h) => ({
        id: h.id,
        role: h.role as 'user' | 'assistant',
        content: h.content,
        timestamp: new Date(h.created_at || Date.now()),
      }));
      setChatMessages(messages);
    }
  };

  const loadAllSpecs = useCallback(async () => {
    if (!projectId) return;
    
    for (const mod of modules) {
      try {
        const { data } = await supabase.functions.invoke('get-dashboard', {
          body: { module: mod, project_id: projectId },
        });
        if (data?.spec) {
          setSpecs((prev) => ({ ...prev, [mod]: data.spec }));
        }
      } catch {
        // Silent fail
      }
    }
  }, [projectId]);

  useEffect(() => {
    loadAllSpecs();
  }, [loadAllSpecs]);

  const handleLoadDemo = (mod: Module) => {
    const demo = getDemoSpec(mod);
    if (demo) {
      setSpecs((prev) => ({ ...prev, [mod]: demo }));
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAllSpecs();
    setIsRefreshing(false);
  };

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || chatInput;
    if (!text.trim() || isChatLoading || !projectId) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Persist user message
      await persistAgentMessage(projectId, sessionId, 'user', text, modules);

      // Fetch KPI snapshots and records for all modules
      const kpiSnapshots = await fetchKpiSnapshots(projectId, modules);
      const allRecords: any[] = [];
      
      for (const mod of modules) {
        const records = await fetchModuleRecords(projectId, mod);
        allRecords.push(...records.slice(0, 5)); // Limit per module
      }

      // Call Lyzr agent with all modules context
      const response = await askLyzrAgent({
        projectId,
        projectName: projectName || 'Demo Project',
        periodDate: new Date().toISOString().split('T')[0],
        modules,
        kpiSnapshots,
        records: allRecords,
        userMessage: text,
        sessionId,
      });

      // Persist assistant message
      await persistAgentMessage(projectId, sessionId, 'assistant', response.answer, modules);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Error calling agent:', error);
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I am unable to connect to the AI agent right now. Please try again later.',
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Calculate health score based on available data
  const calculateHealthScore = (): { score: number; status: 'good' | 'warning' | 'danger' } => {
    const availableModules = modules.filter((m) => specs[m]);
    if (availableModules.length === 0) return { score: 0, status: 'danger' };

    let totalScore = 0;
    availableModules.forEach((mod) => {
      const spec = specs[mod];
      if (!spec) return;
      
      const dangerCount = spec.kpis.filter((k) => k.status === 'danger').length;
      const warningCount = spec.kpis.filter((k) => k.status === 'warning').length;
      
      if (dangerCount === 0 && warningCount === 0) totalScore += 25;
      else if (dangerCount === 0) totalScore += 15;
      else totalScore += 5;
    });

    const score = Math.min(100, totalScore);
    return {
      score,
      status: score >= 80 ? 'good' : score >= 50 ? 'warning' : 'danger',
    };
  };

  const health = calculateHealthScore();
  const availableModules = modules.filter((m) => specs[m]);
  const totalModules = modules.length;

  // Aggregate all insights
  const allInsights = modules
    .flatMap((m) => specs[m]?.insights || [])
    .slice(0, 6);

  // Aggregate all KPIs for summary
  const aggregateKpis = (): KPI[] => {
    const kpis: KPI[] = [];
    
    modules.forEach((mod) => {
      const spec = specs[mod];
      if (!spec) return;
      
      const config = MODULE_CONFIG[mod];
      const criticalKpi = spec.kpis.find((k) => k.status === 'danger') || spec.kpis[0];
      
      if (criticalKpi) {
        kpis.push({
          ...criticalKpi,
          id: `${mod}_${criticalKpi.id}`,
          label: `${config.label}: ${criticalKpi.label}`,
        });
      }
    });
    
    return kpis.slice(0, 4);
  };

  return (
    <div className="min-h-screen bg-[#0f1117]">
      {/* Top Nav */}
      <nav className="sticky top-0 z-30 bg-[#0f1117]/95 backdrop-blur-md border-b border-white/6 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="w-px h-5 bg-white/8" />
          <div className="flex items-center gap-2">
            <LayoutDashboard size={18} className="text-[#FF6A00]" />
            <span className="text-sm font-display font-semibold text-white">Project Overview</span>
            {project && (
              <span className="text-xs text-white/40">· {project.name}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#171a21] hover:bg-[#1c202a] border border-white/10 rounded-xl text-xs text-white/60 hover:text-white transition-all"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Badge variant="default">Public Mode</Badge>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Health Score Card */}
        <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-[#1E3A5F]/50 to-[#0f1117] border border-white/10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-display font-semibold text-white mb-1">
                Project Health Score
              </h2>
              <p className="text-sm text-white/40">
                {availableModules.length} of {totalModules} modules active
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className={`text-4xl font-display font-bold ${
                  health.status === 'good' ? 'text-green-400' : 
                  health.status === 'warning' ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {health.score}%
                </div>
                <div className="text-xs text-white/40 uppercase tracking-wider">
                  {health.status === 'good' ? 'Healthy' : 
                   health.status === 'warning' ? 'Needs Attention' : 'Critical'}
                </div>
              </div>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                health.status === 'good' ? 'bg-green-500/10 border border-green-500/20' : 
                health.status === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/20' : 
                'bg-red-500/10 border border-red-500/20'
              }`}>
                <Activity size={28} className={
                  health.status === 'good' ? 'text-green-400' : 
                  health.status === 'warning' ? 'text-yellow-400' : 'text-red-400'
                } />
              </div>
            </div>
          </div>
        </div>

        {/* Module Status Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {modules.map((mod) => {
            const config = MODULE_CONFIG[mod];
            const hasData = !!specs[mod];
            const spec = specs[mod];
            
            return (
              <button
                key={mod}
                onClick={() => navigate(`/dashboard/${mod}`)}
                className="group relative p-5 rounded-2xl bg-[#171a21] border border-white/8 hover:border-white/16 transition-all text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${config.bgColor} border border-white/8 flex items-center justify-center`}>
                    <config.icon size={18} className={config.color} />
                  </div>
                  {hasData ? (
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-white/20" />
                  )}
                </div>
                <h3 className="text-sm font-display font-semibold text-white mb-1">
                  {config.label}
                </h3>
                <p className="text-xs text-white/40">
                  {hasData ? 'Data available' : 'No data'}
                </p>
                {spec && (
                  <p className="text-xs text-white/30 mt-2 font-mono">
                    Updated {format(new Date(spec.lastUpdated), 'MMM d')}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Aggregate KPIs */}
        {aggregateKpis().length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-display font-semibold text-white/60 uppercase tracking-wider mb-4">
              Key Metrics Across Modules
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {aggregateKpis().map((kpi, i) => (
                <KPICard key={kpi.id} kpi={kpi} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Recent Uploads / Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Module Details */}
          <div className="bg-[#171a21] border border-white/8 rounded-2xl p-5">
            <h3 className="text-sm font-display font-semibold text-white/70 mb-4">
              Module Status
            </h3>
            <div className="space-y-3">
              {modules.map((mod) => {
                const config = MODULE_CONFIG[mod];
                const hasData = !!specs[mod];
                
                return (
                  <div
                    key={mod}
                    className="flex items-center justify-between py-2 border-b border-white/4 last:border-none"
                  >
                    <div className="flex items-center gap-3">
                      <config.icon size={14} className={config.color} />
                      <span className="text-sm text-white/60">{config.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!hasData && (
                        <button
                          onClick={() => handleLoadDemo(mod)}
                          className="text-xs text-[#FF6A00] hover:text-[#FF8C38] transition-colors"
                        >
                          Load demo
                        </button>
                      )}
                      <span className={`text-xs ${hasData ? 'text-green-400' : 'text-white/30'}`}>
                        {hasData ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-[#171a21] border border-white/8 rounded-2xl p-5">
            <h3 className="text-sm font-display font-semibold text-white/70 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-2">
              {modules.map((mod) => {
                const config = MODULE_CONFIG[mod];
                return (
                  <button
                    key={mod}
                    onClick={() => navigate(`/dashboard/${mod}`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                        <config.icon size={14} className={config.color} />
                      </div>
                      <span className="text-sm text-white/70">View {config.label}</span>
                    </div>
                    <span className="text-white/30">→</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* All Insights */}
        {allInsights.length > 0 && (
          <InsightsPanel insights={allInsights} />
        )}

        {/* Empty State */}
        {availableModules.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/40 mb-4">No module data available yet.</p>
            <div className="flex flex-wrap justify-center gap-3">
              {modules.map((mod) => (
                <button
                  key={mod}
                  onClick={() => handleLoadDemo(mod)}
                  className="px-4 py-2 rounded-xl bg-[#171a21] border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all"
                >
                  Load {MODULE_CONFIG[mod].label} Demo
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chat Button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl bg-[#FF6A00] hover:bg-[#FF8C38] shadow-xl flex items-center justify-center transition-all duration-200 z-40 accent-glow"
        >
          <MessageSquare size={20} className="text-white" />
        </button>
      )}

      {/* Chat Panel */}
      {chatOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[560px] bg-[#171a21] border border-white/10 rounded-3xl shadow-2xl flex flex-col z-50 animate-slide-up overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[#1c202a]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#FF6A00]/10 border border-[#FF6A00]/20 flex items-center justify-center">
                <Bot size={14} className="text-[#FF6A00]" />
              </div>
              <div>
                <p className="text-sm font-display font-semibold text-white">Argus Agent</p>
                <p className="text-xs text-white/30 font-mono">powered by Lyzr AI</p>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="w-7 h-7 rounded-lg hover:bg-white/8 flex items-center justify-center text-white/40 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <Bot size={32} className="text-[#FF6A00]/30 mx-auto mb-3" />
                <p className="text-sm text-white/40">
                  Ask me about any aspect of your project across all modules.
                </p>
              </div>
            )}
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    msg.role === 'assistant'
                      ? 'bg-[#FF6A00]/10 border border-[#FF6A00]/20'
                      : 'bg-white/8'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <Bot size={12} className="text-[#FF6A00]" />
                  ) : (
                    <span className="text-white/50 text-xs">You</span>
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 space-y-1 ${
                    msg.role === 'user'
                      ? 'bg-[#FF6A00]/15 border border-[#FF6A00]/20'
                      : 'bg-[#1c202a] border border-white/6'
                  }`}
                >
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i} className="text-sm leading-relaxed text-white/70">
                      {line.split('**').map((part, idx) =>
                        idx % 2 === 1 ? (
                          <strong key={idx} className="text-white">
                            {part}
                          </strong>
                        ) : (
                          <span key={idx}>{part}</span>
                        )
                      )}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex gap-2.5 items-center">
                <div className="w-6 h-6 rounded-lg bg-[#FF6A00]/10 border border-[#FF6A00]/20 flex items-center justify-center">
                  <Bot size={12} className="text-[#FF6A00]" />
                </div>
                <div className="bg-[#1c202a] border border-white/6 rounded-2xl px-3.5 py-2.5">
                  <Loader2 size={14} className="text-[#FF6A00] animate-spin" />
                </div>
              </div>
            )}
          </div>

          {chatMessages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {[
                'Give me a project summary',
                'What are the main issues?',
                'Show overall progress',
                'Cost status across all modules',
              ].map((p) => (
                <button
                  key={p}
                  onClick={() => handleSendMessage(p)}
                  className="px-2.5 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/8 text-white/50 hover:text-white border border-white/8 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className="p-3 border-t border-white/8 bg-[#1c202a]">
            <div className="flex items-center gap-2 bg-[#0f1117] border border-white/10 rounded-2xl px-3.5 py-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask about your project..."
                className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/20 outline-none"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!chatInput.trim() || isChatLoading}
                className="w-7 h-7 rounded-lg bg-[#FF6A00] flex items-center justify-center text-white disabled:opacity-30 hover:bg-[#FF8C38] transition-colors"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
