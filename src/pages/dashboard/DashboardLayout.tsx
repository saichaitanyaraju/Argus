import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  Wrench,
  BarChart3,
  DollarSign,
  Download,
  Calendar,
  MessageSquare,
  X,
  Bot,
  Send,
  Loader2,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useDashboardData } from '../../context/DashboardDataContext';
import { supabase } from '../../lib/supabase';
import { Module, DashboardSpec, ChatMessage } from '../../types';
import KPICard from '../../components/dashboard/KPICard';
import VisualCard from '../../components/dashboard/VisualCard';
import InsightsPanel from '../../components/dashboard/InsightsPanel';
import Filters from '../../components/dashboard/Filters';
import UploadZone from '../../components/upload/UploadZone';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';
import { exportModuleCsv } from '../../lib/exportReport';
import { useToast } from '../../components/ui/ToastHost';
import { useArgusChat } from '../../hooks/useArgusChat';
import { usePublicMode } from '../../hooks/usePublicMode';
import { toIsoDate } from '../../utils/dateParser';
import Skeleton from '../../components/ui/Skeleton';

const MODULE_CONFIG: Record<Module, { label: string; icon: typeof Users; color: string }> = {
  manpower: { label: 'Manpower', icon: Users, color: 'text-blue-400' },
  equipment: { label: 'Equipment', icon: Wrench, color: 'text-yellow-400' },
  progress: { label: 'Work Progress', icon: BarChart3, color: 'text-green-400' },
  cost: { label: 'Cost', icon: DollarSign, color: 'text-[#FF6A00]' },
};

const COST_DEFAULT_START = '2024-01-08';
const COST_DEFAULT_END = '2024-12-01';

interface DashboardLayoutProps {
  module: Module;
  label: string;
}

function normalizeDateValue(value: unknown): string {
  return toIsoDate(value);
}

function rowDate(row: Record<string, unknown>): string {
  return normalizeDateValue(row.date || row.timestamp || row.period_date || row.datetime);
}

function isWithinRange(dateValue: string, from: string, to: string): boolean {
  if (!dateValue) return true;
  if (from && dateValue < from) return false;
  if (to && dateValue > to) return false;
  return true;
}

function hasRangeOverlap(metaMin: string, metaMax: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!metaMin || !metaMax) return true;
  if (to && to < metaMin) return false;
  if (from && from > metaMax) return false;
  return true;
}

export default function DashboardLayout({ module, label }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { project, projectId } = useProject();
  const { pushToast } = useToast();
  const { sendMessage } = useArgusChat();
  const isPublicMode = usePublicMode();
  const {
    setModuleData,
    loadDemoModule,
    clearModuleData,
    getModuleData,
    hasModuleData,
  } = useDashboardData();

  const [highlightedKpi, setHighlightedKpi] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [lastFailedMessage, setLastFailedMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isHydratingRemote, setIsHydratingRemote] = useState(false);
  const [filterDisciplines, setFilterDisciplines] = useState<string[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const autoAskHandledRef = useRef(false);

  const currentEntry = getModuleData(module, projectId);
  const currentSpec = currentEntry?.spec;
  const hasData = Boolean(currentSpec);

  useEffect(() => {
    if (!projectId || hasData) return;

    let cancelled = false;
    setIsHydratingRemote(true);

    const loadRemoteSpec = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-dashboard', {
          body: { module, project_id: projectId },
        });

        if (cancelled || !data?.spec) return;

        setModuleData(
          {
            module,
            spec: data.spec as DashboardSpec,
            source: 'remote',
            recordsSample: [],
          },
          projectId
        );
      } catch {
        // Optional fallback only.
      } finally {
        if (!cancelled) {
          setIsHydratingRemote(false);
        }
      }
    };

    void loadRemoteSpec();

    return () => {
      cancelled = true;
      setIsHydratingRemote(false);
    };
  }, [module, projectId, hasData, setModuleData]);

  useEffect(() => {
    if (!currentSpec) return;
    const fallbackFrom = module === 'cost' ? COST_DEFAULT_START : '';
    const fallbackTo = module === 'cost' ? COST_DEFAULT_END : '';
    setFilterDisciplines([]);
    setFilterDateFrom(currentSpec.meta.dateMin || fallbackFrom);
    setFilterDateTo(currentSpec.meta.dateMax || fallbackTo);
  }, [module, currentSpec?.lastUpdated]);

  useEffect(() => {
    const q = searchParams.get('q');
    const autoask = searchParams.get('autoask');

    if (autoAskHandledRef.current || autoask !== 'true' || !q || !hasData) return;

    autoAskHandledRef.current = true;
    setChatOpen(true);

    const timer = window.setTimeout(() => {
      void handleSendMessage(q);
    }, 500);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('autoask');
    setSearchParams(nextParams, { replace: true });

    return () => window.clearTimeout(timer);
  }, [searchParams, hasData, setSearchParams]);

  const handleSpecLoaded = (payload: {
    spec: DashboardSpec;
    recordsSample: Record<string, unknown>[];
  }) => {
    if (!projectId) {
      pushToast('No project selected.', 'warning');
      return;
    }

    setModuleData(
      {
        module,
        spec: payload.spec,
        source: 'upload',
        recordsSample: payload.recordsSample,
      },
      projectId
    );

    pushToast(`${label} data loaded.`, 'success');
  };

  const handleLoadDemo = () => {
    if (!projectId) {
      pushToast('No project selected.', 'warning');
      return;
    }

    loadDemoModule(module, projectId);
    pushToast(`${label} demo data loaded.`, 'success');
  };

  const handleClearData = () => {
    if (!projectId) return;
    clearModuleData(module, projectId);
    setFilterDisciplines([]);
    setFilterDateFrom('');
    setFilterDateTo('');
    pushToast(`${label} data cleared.`, 'info');
  };

  const filteredSpec: DashboardSpec | undefined = useMemo(() => {
    if (!currentSpec) return undefined;

    const overlap = hasRangeOverlap(
      currentSpec.meta.dateMin,
      currentSpec.meta.dateMax,
      filterDateFrom,
      filterDateTo
    );

    const visuals = currentSpec.visuals.map((visual) => {
      if (!visual.data || visual.data.length === 0) return visual;
      if (!overlap) return { ...visual, data: [] };

      const filteredRows = visual.data.filter((row) => {
        if (filterDisciplines.length > 0) {
          const discipline = String(row.discipline || '').trim();
          if (discipline && !filterDisciplines.includes(discipline)) return false;
        }

        const candidateDate = rowDate(row);
        return isWithinRange(candidateDate, filterDateFrom, filterDateTo);
      });

      return {
        ...visual,
        data: filteredRows,
      };
    });

    const hasAnyVisualData = visuals.some((visual) => Boolean(visual.data && visual.data.length > 0));

    return {
      ...currentSpec,
      visuals,
      insights: hasAnyVisualData
        ? currentSpec.insights
        : ['No data for selected range. Adjust filters to view available results.'],
    };
  }, [currentSpec, filterDisciplines, filterDateFrom, filterDateTo]);

  const handleExport = async () => {
    if (!filteredSpec || !hasData) return;

    setIsExporting(true);
    try {
      const fileName = exportModuleCsv({
        module,
        spec: filteredSpec,
        projectName: project?.name,
        disciplines: filterDisciplines,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
      });
      pushToast('CSV exported successfully.', 'success');
      console.info('CSV export generated:', fileName);
    } catch (error) {
      console.error('Export failed:', error);
      pushToast('Failed to export report.', 'danger');
    } finally {
      setIsExporting(false);
    }
  };

  const buildShareLink = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('public', '1');

    const current = new URL(window.location.href);
    const hashPath = current.hash.split('?')[0] || `#/dashboard/${module}`;
    return `${current.origin}${current.pathname}${hashPath}?${nextParams.toString()}`;
  };

  const handlePublicModeToggle = async () => {
    const nextParams = new URLSearchParams(searchParams);

    if (isPublicMode) {
      nextParams.delete('public');
      setSearchParams(nextParams);
      pushToast('Public mode disabled.', 'info');
      return;
    }

    nextParams.set('public', '1');
    setSearchParams(nextParams);

    try {
      await navigator.clipboard.writeText(buildShareLink());
      pushToast('Public link copied!', 'success');
    } catch {
      pushToast('Public mode enabled. Copy link from address bar.', 'warning');
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const text = (messageText || chatInput).trim();
    if (!text || isChatLoading || !projectId) return;

    setChatError('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    const response = await sendMessage({
      projectId,
      projectName: project?.name || 'Demo Project',
      periodDate: new Date().toISOString().split('T')[0],
      modules: [module],
      userMessage: text,
      sessionId,
      context: {
        activeModule: module,
        filters: {
          disciplines: filterDisciplines,
          dateFrom: filterDateFrom,
          dateTo: filterDateTo,
        },
        moduleSpecs: currentSpec ? { [module]: currentSpec } : undefined,
        recordsSampleByModule: {
          [module]: currentEntry?.recordsSample || [],
        },
      },
    });

    if (response.ok) {
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
      setLastFailedMessage('');
    } else {
      setLastFailedMessage(text);
      setChatError(response.message);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    }

    setIsChatLoading(false);
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

  const handleRetryLastMessage = () => {
    if (!lastFailedMessage) return;
    void handleSendMessage(lastFailedMessage);
  };

  const setModule = (nextModule: Module | 'overview') => {
    const params = new URLSearchParams();
    if (isPublicMode) params.set('public', '1');
    if (nextModule === 'overview') {
      navigate(`/dashboard${params.toString() ? `?${params.toString()}` : ''}`);
      return;
    }
    navigate(`/dashboard/${nextModule}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleHighlightKpi = (id: string) => {
    setHighlightedKpi(id);
    window.setTimeout(() => setHighlightedKpi(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0f1117]">
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
            {project && <span className="text-xs text-white/40">· {project.name}</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isPublicMode && (
            <button
              onClick={handleExport}
              disabled={isExporting || !hasData}
              title={hasData ? 'Export current module data' : 'No data loaded'}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#171a21] hover:bg-[#1c202a] border border-white/10 rounded-xl text-xs text-white/60 hover:text-white transition-all disabled:opacity-40"
            >
              {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Export CSV
            </button>
          )}

          <button
            onClick={() => void handlePublicModeToggle()}
            title="Create and toggle shareable read-only mode"
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-mono font-medium border transition-colors ${
              isPublicMode
                ? 'bg-green-500/10 text-green-300 border-green-500/30'
                : 'bg-white/10 text-white/70 border-white/10 hover:bg-white/20'
            }`}
          >
            Share Public Link
          </button>
        </div>
      </nav>

      {isPublicMode && (
        <div className="px-6 py-2.5 border-b border-green-500/20 bg-green-500/10 text-green-200 text-sm font-medium">
          {'\u{1F441} Public View - Read Only'}
        </div>
      )}

      <div className="border-b border-white/6 bg-[#171a21]/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setModule('overview')}
            className="relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap text-white/40 hover:text-white/70"
          >
            <LayoutDashboard size={15} />
            Overview
          </button>

          {(Object.keys(MODULE_CONFIG) as Module[]).map((mod) => {
            const cfg = MODULE_CONFIG[mod];
            const isActive = mod === module;
            const hasModData = hasModuleData(mod, projectId);

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
                {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6A00] rounded-t-full" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {!hasData ? (
          isHydratingRemote ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="p-5 rounded-2xl border border-white/8 bg-card">
                    <Skeleton className="h-3 w-28 mb-3" />
                    <Skeleton className="h-9 w-20 mb-3" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
              <Skeleton className="h-52 w-full" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <UploadZone module={module} onSpecLoaded={handleSpecLoaded} readOnly={isPublicMode} />

              {!isPublicMode && (
                <div className="mt-8 text-center">
                  <p className="text-white/20 text-xs font-mono mb-3">- or -</p>
                  <button
                    onClick={handleLoadDemo}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171a21] border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all mx-auto"
                  >
                    <BarChart3 size={14} />
                    Load demo data
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <Filters
                disciplines={currentSpec!.meta.disciplines}
                selectedDisciplines={filterDisciplines}
                dateFrom={
                  filterDateFrom ||
                  currentSpec!.meta.dateMin ||
                  (module === 'cost' ? COST_DEFAULT_START : '')
                }
                dateTo={
                  filterDateTo ||
                  currentSpec!.meta.dateMax ||
                  (module === 'cost' ? COST_DEFAULT_END : '')
                }
                onChange={handleFilterChange}
                readOnly={isPublicMode}
              />

              <div className="flex items-center gap-2 text-xs text-white/25 font-mono">
                <Calendar size={11} />
                <span>Updated {format(new Date(currentEntry!.loadedAt), 'MMM d, HH:mm')}</span>
                {currentEntry?.source === 'demo' && <Badge variant="info">Demo Data</Badge>}
                {!isPublicMode && (
                  <button
                    onClick={handleClearData}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={11} />
                    Clear Data
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredSpec!.kpis.map((kpi, index) => (
                <button key={kpi.id} onClick={() => handleHighlightKpi(kpi.id)} className="text-left">
                  <KPICard kpi={kpi} highlighted={highlightedKpi === kpi.id} index={index} />
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSpec!.visuals
                .filter((visual) => visual.type !== 'table')
                .map((visual, index) => (
                  <VisualCard key={visual.id} visual={visual} index={index} />
                ))}
            </div>

            {filteredSpec!.visuals
              .filter((visual) => visual.type === 'table')
              .map((visual, index) => (
                <VisualCard key={visual.id} visual={visual} index={index} />
              ))}

            <InsightsPanel insights={filteredSpec!.insights} />
          </div>
        )}
      </div>

      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl bg-[#FF6A00] hover:bg-[#FF8C38] shadow-xl flex items-center justify-center transition-all duration-200 z-40 accent-glow"
        >
          <MessageSquare size={20} className="text-white" />
        </button>
      )}

      {chatOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[560px] bg-[#171a21] border border-white/10 rounded-3xl shadow-2xl flex flex-col z-50 animate-slide-up overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[#1c202a]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#FF6A00]/10 border border-[#FF6A00]/20 flex items-center justify-center">
                <Bot size={14} className="text-[#FF6A00]" />
              </div>
              <div>
                <p className="text-sm font-display font-semibold text-white">Argus Agent</p>
                <p className="text-xs text-white/30 font-mono">powered by open-source LLM</p>
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
                <p className="text-sm text-white/40">Ask me about {label.toLowerCase()} data, KPIs, or insights.</p>
              </div>
            )}

            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    msg.role === 'assistant' ? 'bg-[#FF6A00]/10 border border-[#FF6A00]/20' : 'bg-white/8'
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
                  {msg.content.split('\n').map((line, index) => (
                    <p key={index} className="text-sm leading-relaxed text-white/70">
                      {line.split('**').map((part, partIndex) =>
                        partIndex % 2 === 1 ? (
                          <strong key={partIndex} className="text-white">
                            {part}
                          </strong>
                        ) : (
                          <span key={partIndex}>{part}</span>
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

            {chatError && !isChatLoading && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2">
                <p className="text-xs text-red-200/90">{chatError}</p>
                <button
                  onClick={handleRetryLastMessage}
                  disabled={!lastFailedMessage}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-300/30 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <RotateCcw size={11} />
                  Retry
                </button>
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
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void handleSendMessage(prompt)}
                  className="px-2.5 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/8 text-white/50 hover:text-white border border-white/8 transition-colors"
                >
                  {prompt}
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
                    void handleSendMessage();
                  }
                }}
                placeholder="Ask about the site data..."
                className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/20 outline-none"
              />
              <button
                onClick={() => void handleSendMessage()}
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

