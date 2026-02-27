import { useState, useEffect, useCallback, type ComponentType } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Wrench,
  BarChart3,
  DollarSign,
  Download,
  RefreshCw,
  Calendar,
  MessageSquare,
  X,
  Bot,
  Send,
  Loader2,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { supabase } from '../../lib/supabase';
import { Module, DashboardSpec, ChatMessage } from '../../types';
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
import Filters from '../../components/dashboard/Filters';
import UploadZone from '../../components/upload/UploadZone';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';

const MODULE_CONFIG: Record<Module, { label: string; icon: typeof Users; color: string }> = {
  manpower: { label: 'Man Power', icon: Users, color: 'text-blue-400' },
  equipment: { label: 'Equipment', icon: Wrench, color: 'text-yellow-400' },
  progress: { label: 'Work Progress', icon: BarChart3, color: 'text-green-400' },
  cost: { label: 'Cost', icon: DollarSign, color: 'text-[#FF6A00]' },
};

interface DashboardLayoutProps {
  module: Module;
  label: string;
  icon: ComponentType<{ size?: string | number; className?: string }>;
  iconColor: string;
}

export default function DashboardLayout({ module, label }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { project, projectId } = useProject();

  const [specs, setSpecs] = useState<Partial<Record<Module, DashboardSpec>>>({});
  const [highlightedKpi, setHighlightedKpi] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [filterDisciplines, setFilterDisciplines] = useState<string[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [useDemoData, setUseDemoData] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);

  const currentSpec = specs[module];
  const hasData = !!currentSpec;

  // Handle auto-ask from URL params
  useEffect(() => {
    const q = searchParams.get('q');
    const autoask = searchParams.get('autoask');

    if (autoask === 'true' && q && hasData) {
      setChatOpen(true);
      setChatInput(q);
      // Auto-send after a brief delay to allow UI to render
      const timer = setTimeout(() => {
        handleSendMessage(q);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, hasData]);

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

  const loadSpec = async (mod: Module) => {
    try {
      // Try to fetch from Supabase edge function
      const { data } = await supabase.functions.invoke('get-dashboard', {
        body: { module: mod, project_id: projectId },
      });
      if (data?.spec) {
        setSpecs((prev) => ({ ...prev, [mod]: data.spec }));
      }
    } catch {
      // Silent fail - user will upload
    }
  };

  useEffect(() => {
    if (specs[module]) return;
    loadSpec(module);
  }, [module, projectId]);

  const handleSpecLoaded = (spec: DashboardSpec) => {
    setSpecs((prev) => ({ ...prev, [module]: spec }));
    setFilterDisciplines([]);
    setFilterDateFrom(spec.meta.dateMin);
    setFilterDateTo(spec.meta.dateMax);
    setUseDemoData(false);
  };

  const handleLoadDemo = () => {
    const demo = getDemoSpec(module);
    if (demo) {
      setSpecs((prev) => ({ ...prev, [module]: demo }));
      setFilterDisciplines([]);
      setFilterDateFrom(demo.meta.dateMin);
      setFilterDateTo(demo.meta.dateMax);
      setUseDemoData(true);
    }
  };

  const handleExport = async () => {
    if (!currentSpec) return;
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-report', {
        body: {
          module,
          disciplines: filterDisciplines,
          dateFrom: filterDateFrom,
          dateTo: filterDateTo,
          spec: currentSpec,
        },
      });
      if (error) throw error;
      if (data?.pdf_url) window.open(data.pdf_url, '_blank');
      if (data?.excel_url) window.open(data.excel_url, '_blank');
    } catch {
      alert('Export requires Supabase edge functions to be deployed. See SETUP.md.');
    } finally {
      setIsExporting(false);
    }
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
      await persistAgentMessage(projectId, sessionId, 'user', text, [module]);

      // Fetch KPI snapshots and records for context
      const kpiSnapshots = await fetchKpiSnapshots(projectId, [module]);
      const records = await fetchModuleRecords(projectId, module);

      // Call Lyzr agent
      const response = await askLyzrAgent({
        projectId,
        projectName: project?.name || 'Demo Project',
        periodDate: new Date().toISOString().split('T')[0],
        modules: [module],
        kpiSnapshots,
        records,
        userMessage: text,
        sessionId,
      });

      // Persist assistant message
      await persistAgentMessage(projectId, sessionId, 'assistant', response.answer, [module]);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Error calling agent:', error);
      // Fallback to deterministic response
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

  const handleFilterChange = (filters: {
    disciplines: string[];
    dateFrom: string;
    dateTo: string;
  }) => {
    setFilterDisciplines(filters.disciplines);
    setFilterDateFrom(filters.dateFrom);
    setFilterDateTo(filters.dateTo);
  };

  const filteredSpec: DashboardSpec | undefined = currentSpec
    ? {
        ...currentSpec,
        visuals: currentSpec.visuals.map((v) => ({
          ...v,
          data: v.data?.filter((row) => {
            if (filterDisciplines.length > 0) {
              const disc = row.discipline as string;
              if (disc && !filterDisciplines.includes(disc)) return false;
            }
            return true;
          }),
        })),
      }
    : undefined;

  const setModule = (m: Module) => {
    navigate(`/dashboard/${m}`);
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
            <span className="text-sm font-display font-semibold text-white">{label}</span>
            {project && (
              <span className="text-xs text-white/40">· {project.name}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasData && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#171a21] hover:bg-[#1c202a] border border-white/10 rounded-xl text-xs text-white/60 hover:text-white transition-all"
            >
              {isExporting ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              Export Report
            </button>
          )}
          <Badge variant="default">Public Mode</Badge>
        </div>
      </nav>

      {/* Module Tabs */}
      <div className="border-b border-white/6 bg-[#171a21]/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 overflow-x-auto">
          {(Object.keys(MODULE_CONFIG) as Module[]).map((mod) => {
            const cfg = MODULE_CONFIG[mod];
            const isActive = mod === module;
            const hasModData = !!specs[mod];
            return (
              <button
                key={mod}
                onClick={() => setModule(mod)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap ${
                  isActive ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                <cfg.icon size={15} className={isActive ? cfg.color : ''} />
                {cfg.label}
                {hasModData && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6A00] rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <UploadZone module={module} onSpecLoaded={handleSpecLoaded} />
            <div className="mt-8 text-center">
              <p className="text-white/20 text-xs font-mono mb-3">— or —</p>
              <button
                onClick={handleLoadDemo}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171a21] border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all mx-auto"
              >
                <BarChart3 size={14} />
                Load demo data
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <Filters
                disciplines={currentSpec!.meta.disciplines}
                dateMin={currentSpec!.meta.dateMin}
                dateMax={currentSpec!.meta.dateMax}
                selectedDisciplines={filterDisciplines}
                dateFrom={filterDateFrom || currentSpec!.meta.dateMin}
                dateTo={filterDateTo || currentSpec!.meta.dateMax}
                onChange={handleFilterChange}
              />
              <div className="flex items-center gap-2 text-xs text-white/25 font-mono">
                <Calendar size={11} />
                <span>Updated {format(new Date(currentSpec!.lastUpdated), 'MMM d, HH:mm')}</span>
                {useDemoData && <Badge variant="info">Demo Data</Badge>}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredSpec!.kpis.map((kpi, i) => (
                <KPICard
                  key={kpi.id}
                  kpi={kpi}
                  highlighted={highlightedKpi === kpi.id}
                  index={i}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSpec!.visuals
                .filter((v) => v.type !== 'table')
                .map((v, i) => (
                  <VisualCard key={v.id} visual={v} index={i} />
                ))}
            </div>

            {filteredSpec!.visuals
              .filter((v) => v.type === 'table')
              .map((v, i) => (
                <VisualCard key={v.id} visual={v} index={i} />
              ))}

            <InsightsPanel insights={filteredSpec!.insights} />
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
                  Ask me about {label.toLowerCase()} data, KPIs, or insights.
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
                'Give me a summary',
                "What's behind schedule?",
                'Show cost variance',
                'Equipment status',
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
                placeholder="Ask about the site data…"
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
