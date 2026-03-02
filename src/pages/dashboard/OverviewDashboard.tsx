import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  Wrench,
  BarChart3,
  DollarSign,
  Activity,
  MessageSquare,
  X,
  Bot,
  Send,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useDashboardData } from '../../context/DashboardDataContext';
import { supabase } from '../../lib/supabase';
import { Module, DashboardSpec, ChatMessage, KPI } from '../../types';
import KPICard from '../../components/dashboard/KPICard';
import InsightsPanel from '../../components/dashboard/InsightsPanel';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';
import { useToast } from '../../components/ui/ToastHost';
import { useArgusChat } from '../../hooks/useArgusChat';
import { usePublicMode } from '../../hooks/usePublicMode';
import { hasDashboardData } from '../../utils/dashboardData';
import { computeHealthScore } from '../../utils/healthScore';

const MODULE_CONFIG: Record<Module, { label: string; icon: typeof Users; color: string; bgColor: string }> = {
  manpower: { label: 'Manpower', icon: Users, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  equipment: { label: 'Equipment', icon: Wrench, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  progress: { label: 'Work Progress', icon: BarChart3, color: 'text-green-400', bgColor: 'bg-green-500/10' },
  cost: { label: 'Cost', icon: DollarSign, color: 'text-[#FF6A00]', bgColor: 'bg-[#FF6A00]/10' },
};

export default function OverviewDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { project, projectId, projectName } = useProject();
  const { pushToast } = useToast();
  const { sendMessage } = useArgusChat();
  const isPublicMode = usePublicMode();

  const {
    getProjectModuleData,
    hasModuleData,
    setModuleData,
    loadDemoModule,
    loadAllDemoModules,
  } = useDashboardData();

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatOfflineMode, setChatOfflineMode] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const autoAskHandledRef = useRef(false);
  const keyMetricsRef = useRef<HTMLDivElement>(null);

  const modules: Module[] = ['manpower', 'equipment', 'progress', 'cost'];

  const entries = getProjectModuleData(projectId);
  const specs: Partial<Record<Module, DashboardSpec>> = useMemo(() => {
    const next: Partial<Record<Module, DashboardSpec>> = {};
    modules.forEach((module) => {
      const entry = entries[module];
      if (entry?.spec && hasDashboardData(entry.spec, entry.recordsSample)) {
        next[module] = entry.spec;
      }
    });
    return next;
  }, [entries]);

  useEffect(() => {
    if (!projectId) return;

    const loadMissingFromRemote = async () => {
      for (const module of modules) {
        if (entries[module]) continue;
        try {
          const { data } = await supabase.functions.invoke('get-dashboard', {
            body: { module, project_id: projectId },
          });
          const remoteSpec = data?.spec as DashboardSpec | undefined;
          if (remoteSpec && hasDashboardData(remoteSpec)) {
            setModuleData(
              {
                module,
                spec: remoteSpec,
                source: 'remote',
                recordsSample: [],
              },
              projectId
            );
          }
        } catch {
          // Optional fallback only.
        }
      }
    };

    void loadMissingFromRemote();
  }, [projectId, entries, setModuleData]);

  useEffect(() => {
    const q = searchParams.get('q');
    const autoask = searchParams.get('autoask');

    if (autoAskHandledRef.current || autoask !== 'true' || !q) return;

    autoAskHandledRef.current = true;
    setChatOpen(true);

    const timer = window.setTimeout(() => {
      void handleSendMessage(q);
    }, 500);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('autoask');
    setSearchParams(nextParams, { replace: true });

    return () => window.clearTimeout(timer);
  }, [searchParams, setSearchParams]);

  const handleLoadDemo = (module: Module) => {
    if (!projectId) {
      pushToast('No project selected.', 'warning');
      return;
    }

    loadDemoModule(module, projectId);
    pushToast(`${MODULE_CONFIG[module].label} demo data loaded.`, 'success');
  };

  const handleLoadAllDemo = () => {
    if (!projectId) {
      pushToast('No project selected.', 'warning');
      return;
    }

    loadAllDemoModules(projectId);
    pushToast('All demo data loaded.', 'success');
    window.setTimeout(() => {
      keyMetricsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  const handleRefresh = async () => {
    if (!projectId) return;

    setIsRefreshing(true);
    try {
      for (const module of modules) {
        const { data } = await supabase.functions.invoke('get-dashboard', {
          body: { module, project_id: projectId },
        });
        if (data?.spec) {
          setModuleData(
            {
              module,
              spec: data.spec as DashboardSpec,
              source: 'remote',
              recordsSample: [],
            },
            projectId
          );
        }
      }
      pushToast('Overview refreshed.', 'info');
    } finally {
      setIsRefreshing(false);
    }
  };

  const buildShareLink = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('public', '1');

    const current = new URL(window.location.href);
    const hashPath = current.hash.split('?')[0] || '#/dashboard';
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

    const activeModules = modules.filter((module) => Boolean(specs[module]));
    const response = await sendMessage({
      projectId,
      projectName: projectName || 'Demo Project',
      periodDate: new Date().toISOString().split('T')[0],
      modules: activeModules.length > 0 ? activeModules : modules,
      userMessage: text,
      sessionId,
      context: {
        activeModule: 'overview',
        moduleSpecs: specs,
        recordsSampleByModule: modules.reduce((acc, module) => {
          acc[module] = entries[module]?.recordsSample || [];
          return acc;
        }, {} as Partial<Record<Module, Record<string, unknown>[]>>),
      },
    });

    if (response.ok) {
      setChatOfflineMode(Boolean(response.offlineMode));
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
      if (response.offlineMode) {
        setChatError('AI service unavailable. Showing offline answer.');
        setLastFailedMessage(text);
      } else {
        setChatError('');
        setLastFailedMessage('');
      }
    } else {
      setChatOfflineMode(false);
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

  const handleRetryLastMessage = () => {
    if (!lastFailedMessage) return;
    void handleSendMessage(lastFailedMessage);
  };

  const aggregateKpis = (): KPI[] => {
    const targetKpiByModule: Record<Module, string> = {
      manpower: 'variance_pct',
      equipment: 'breakdown_count',
      progress: 'slippage_pct',
      cost: 'total_budget',
    };

    return modules
      .map((module) => {
        const spec = specs[module];
        if (!spec) return null;

        const config = MODULE_CONFIG[module];
        const preferred = spec.kpis.find((kpi) => kpi.id === targetKpiByModule[module]);
        const fallback = spec.kpis.find((kpi) => kpi.status === 'danger') || spec.kpis[0];
        const selected = preferred || fallback;
        if (!selected) return null;

        return {
          ...selected,
          id: `${module}_${selected.id}`,
          label: `${config.label}: ${selected.label}`,
        } satisfies KPI;
      })
      .filter((item): item is KPI => Boolean(item));
  };

  const health = computeHealthScore(specs);
  const availableModules = modules.filter((module) => specs[module]);
  const totalModules = modules.length;
  const allInsights = modules.flatMap((module) => specs[module]?.insights || []).slice(0, 6);

  const navigateWithPublic = useCallback(
    (path: string) => {
      if (isPublicMode) {
        navigate(`${path}?public=1`);
      } else {
        navigate(path);
      }
    },
    [isPublicMode, navigate]
  );

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
            <LayoutDashboard size={18} className="text-[#FF6A00]" />
            <span className="text-sm font-display font-semibold text-white">Project Overview</span>
            {project && <span className="text-xs text-white/40">- {project.name}</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isPublicMode && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#171a21] hover:bg-[#1c202a] border border-white/10 rounded-xl text-xs text-white/60 hover:text-white transition-all"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
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
            onClick={() => navigateWithPublic('/dashboard')}
            className="relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap text-white"
          >
            <LayoutDashboard size={15} className="text-[#FF6A00]" />
            Overview
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6A00] rounded-t-full" />
          </button>

          {modules.map((mod) => {
            const cfg = MODULE_CONFIG[mod];
            const hasModData = hasModuleData(mod, projectId);
            return (
              <button
                key={mod}
                onClick={() => navigateWithPublic(`/dashboard/${mod}`)}
                className="relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap text-white/40 hover:text-white/70"
              >
                <cfg.icon size={15} />
                {cfg.label}
                {hasModData && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {!isPublicMode && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={handleLoadAllDemo}
              className="px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#FF8C38] text-white text-sm font-medium transition-colors"
            >
              Load All Demo Data
            </button>
          </div>
        )}

        <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-[#1E3A5F]/50 to-[#0f1117] border border-white/10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-display font-semibold text-white mb-1">Project Health Score</h2>
              <p className="text-sm text-white/40">
                {availableModules.length} of {totalModules} modules active
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div
                  className={`text-4xl font-display font-bold ${
                    health.status === 'good'
                      ? 'text-green-400'
                      : health.status === 'warning'
                        ? 'text-yellow-400'
                        : 'text-red-400'
                  }`}
                >
                  {health.score}%
                </div>
                <div className="text-xs text-white/40 uppercase tracking-wider">
                  {health.status === 'good'
                    ? 'HEALTHY'
                    : health.status === 'warning'
                      ? 'AT RISK'
                      : 'CRITICAL'}
                </div>
              </div>
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  health.status === 'good'
                    ? 'bg-green-500/10 border border-green-500/20'
                    : health.status === 'warning'
                      ? 'bg-yellow-500/10 border border-yellow-500/20'
                      : 'bg-red-500/10 border border-red-500/20'
                }`}
              >
                <Activity
                  size={28}
                  className={`${
                    health.status === 'good'
                      ? 'text-green-400'
                      : health.status === 'warning'
                        ? 'text-yellow-400'
                        : 'text-red-400'
                  } ${health.score < 50 ? 'animate-pulse' : ''}`}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {modules.map((module) => {
            const config = MODULE_CONFIG[module];
            const isActive = hasModuleData(module, projectId);
            const entry = entries[module];

            return (
              <button
                key={module}
                onClick={() => navigateWithPublic(`/dashboard/${module}`)}
                className="group relative p-5 rounded-2xl bg-[#171a21] border border-white/8 hover:border-white/16 transition-all text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${config.bgColor} border border-white/8 flex items-center justify-center`}>
                    <config.icon size={18} className={config.color} />
                  </div>
                  {isActive ? <span className="w-2 h-2 rounded-full bg-green-400" /> : <span className="w-2 h-2 rounded-full bg-white/20" />}
                </div>
                <h3 className="text-sm font-display font-semibold text-white mb-1">{config.label}</h3>
                <p className="text-xs text-white/40">{isActive ? 'Data available' : 'No data'}</p>
                {isActive && entry?.loadedAt && (
                  <p className="text-xs text-white/30 mt-2 font-mono">Updated {format(new Date(entry.loadedAt), 'MMM d')}</p>
                )}
              </button>
            );
          })}
        </div>

        {aggregateKpis().length > 0 && (
          <div className="mb-6" ref={keyMetricsRef}>
            <h3 className="text-sm font-display font-semibold text-white/60 uppercase tracking-wider mb-4">
              Key Metrics Across Modules
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {aggregateKpis().map((kpi, index) => (
                <KPICard key={kpi.id} kpi={kpi} index={index} />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#171a21] border border-white/8 rounded-2xl p-5">
            <h3 className="text-sm font-display font-semibold text-white/70 mb-4">Module Status</h3>
            <div className="space-y-3">
              {modules.map((module) => {
                const config = MODULE_CONFIG[module];
                const isActive = hasModuleData(module, projectId);

                return (
                  <div key={module} className="flex items-center justify-between py-2 border-b border-white/4 last:border-none">
                    <div className="flex items-center gap-3">
                      <config.icon size={14} className={config.color} />
                      <span className="text-sm text-white/60">{config.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isPublicMode && !isActive && (
                        <button
                          onClick={() => handleLoadDemo(module)}
                          className="text-xs text-[#FF6A00] hover:text-[#FF8C38] transition-colors"
                        >
                          Load demo
                        </button>
                      )}
                      <span className={`text-xs ${isActive ? 'text-green-400' : 'text-white/30'}`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#171a21] border border-white/8 rounded-2xl p-5">
            <h3 className="text-sm font-display font-semibold text-white/70 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {modules.map((module) => {
                const config = MODULE_CONFIG[module];
                return (
                  <button
                    key={module}
                    onClick={() => navigateWithPublic(`/dashboard/${module}`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                        <config.icon size={14} className={config.color} />
                      </div>
                      <span className="text-sm text-white/70">View {config.label}</span>
                    </div>
                    <span className="text-white/30">-&gt;</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {allInsights.length > 0 && <InsightsPanel insights={allInsights} />}

        {availableModules.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/40 mb-4">No module data available yet.</p>
            {!isPublicMode && (
              <div className="flex flex-wrap justify-center gap-3">
                {modules.map((module) => (
                  <button
                    key={module}
                    onClick={() => handleLoadDemo(module)}
                    className="px-4 py-2 rounded-xl bg-[#171a21] border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all"
                  >
                    Load {MODULE_CONFIG[module].label} Demo
                  </button>
                ))}
              </div>
            )}
            {isPublicMode && <Badge variant="warning">Read-only public view</Badge>}
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
                {chatOfflineMode && (
                  <p className="text-[10px] text-amber-300/80 font-mono mt-0.5">(Offline mode)</p>
                )}
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
                <p className="text-sm text-white/40">Ask about your project across all modules.</p>
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
                'Give me a project summary',
                'What are the main issues?',
                'Show overall progress',
                'Cost status across all modules',
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
                placeholder="Ask about your project..."
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
