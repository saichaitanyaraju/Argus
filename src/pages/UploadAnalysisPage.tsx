import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, Bot, Loader2, RefreshCw } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useDashboardData } from '../context/DashboardDataContext';
import { useArgusChat } from '../hooks/useArgusChat';
import type { Module } from '../types';

const MODULE_LABELS: Record<Module, string> = {
  manpower: 'Manpower',
  equipment: 'Equipment',
  progress: 'Work Progress',
  cost: 'Cost',
};

function isModule(value: string | undefined): value is Module {
  return value === 'manpower' || value === 'equipment' || value === 'progress' || value === 'cost';
}

function extractActionItems(answer: string): string[] {
  const lines = answer
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line.length > 10);

  const unique = [...new Set(lines)];
  return unique.slice(0, 6);
}

export default function UploadAnalysisPage() {
  const { module: moduleParam } = useParams();
  const navigate = useNavigate();
  const { projectId, projectName } = useProject();
  const { sendMessage } = useArgusChat();
  const { getModuleData, setModuleData } = useDashboardData();

  const module = isModule(moduleParam) ? moduleParam : null;
  const entry = module && projectId ? getModuleData(module, projectId) : undefined;
  const analysisProfile = (entry?.analysisProfile || {}) as Record<string, unknown>;

  const [isLoading, setIsLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [error, setError] = useState('');
  const [offlineMode, setOfflineMode] = useState(false);

  const actionItems = useMemo(() => extractActionItems(analysisText), [analysisText]);

  const runAnalysis = useCallback(async () => {
    if (!module || !projectId || !entry?.spec) return;

    setIsLoading(true);
    setError('');

    const response = await sendMessage({
      projectId,
      projectName: projectName || 'Demo Project',
      periodDate: new Date().toISOString().split('T')[0],
      modules: [module],
      userMessage: [
        `Analyze the normalized ${MODULE_LABELS[module]} upload.`,
        'Return actionable insights with priority order:',
        '1) immediate actions for today',
        '2) medium-term controls',
        '3) dashboard focus KPIs and visuals',
      ].join(' '),
      sessionId: `upload-analysis-${Date.now()}`,
      context: {
        activeModule: module,
        moduleSpecs: { [module]: entry.spec },
        recordsSampleByModule: {
          [module]: entry.recordsSample || [],
        },
        filters: {
          disciplines: entry.spec.meta.disciplines || [],
          dateFrom: entry.spec.meta.dateMin || '',
          dateTo: entry.spec.meta.dateMax || '',
        },
      },
    });

    if (response.ok) {
      setAnalysisText(response.answer);
      setOfflineMode(Boolean(response.offlineMode));
    } else {
      setError(response.message);
      setOfflineMode(false);
    }

    setIsLoading(false);
  }, [module, projectId, entry?.loadedAt, projectName, sendMessage]);

  useEffect(() => {
    void runAnalysis();
  }, [runAnalysis]);

  const openDashboardWithInsights = () => {
    if (!module || !projectId || !entry?.spec) return;

    const mergedInsights = [...new Set([...actionItems, ...entry.spec.insights])].slice(0, 10);
    const nextProfile = {
      ...(entry.analysisProfile || {}),
      aiActionItems: actionItems,
      analyzedAt: new Date().toISOString(),
    };

    setModuleData(
      {
        module,
        spec: {
          ...entry.spec,
          insights: mergedInsights.length > 0 ? mergedInsights : entry.spec.insights,
        },
        source: entry.source,
        recordsSample: entry.recordsSample,
        analysisProfile: nextProfile,
      },
      projectId
    );

    navigate(`/dashboard/${module}`);
  };

  if (!module) {
    return (
      <div className="min-h-screen bg-[#0f1117] text-white flex items-center justify-center px-6">
        <div className="max-w-xl w-full bg-[#171a21] border border-white/10 rounded-2xl p-6 text-center">
          <p className="text-white/60 mb-4">Invalid module for analysis.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#FF8C38] text-white text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!entry?.spec) {
    return (
      <div className="min-h-screen bg-[#0f1117] text-white flex items-center justify-center px-6">
        <div className="max-w-xl w-full bg-[#171a21] border border-white/10 rounded-2xl p-6 text-center">
          <p className="text-white/60 mb-4">
            No normalized upload found for {MODULE_LABELS[module]}. Upload data first.
          </p>
          <button
            onClick={() => navigate(`/dashboard/${module}`)}
            className="px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#FF8C38] text-white text-sm"
          >
            Go to {MODULE_LABELS[module]} Upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate(`/dashboard/${module}`)}
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6"
        >
          <ArrowLeft size={16} />
          Back to {MODULE_LABELS[module]} Dashboard
        </button>

        <div className="bg-[#171a21] border border-white/10 rounded-2xl p-6 mb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FF6A00]/10 border border-[#FF6A00]/20 flex items-center justify-center">
                <Bot size={16} className="text-[#FF6A00]" />
              </div>
              <h1 className="text-lg font-display font-semibold">
                AI Actionable Insights - {MODULE_LABELS[module]}
              </h1>
            </div>
            {offlineMode && (
              <span className="text-xs px-2 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
                Offline mode
              </span>
            )}
          </div>

          <p className="text-sm text-white/55">
            Upload has been normalized to a Power BI-ready schema. Review recommendations, then
            open the dashboard generated from these insights.
          </p>
        </div>

        {entry?.analysisProfile && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-[#171a21] border border-white/8 rounded-xl p-3">
              <p className="text-xs text-white/40">Rows</p>
              <p className="text-sm font-semibold">{String(analysisProfile['rowCount'] ?? '-')}</p>
            </div>
            <div className="bg-[#171a21] border border-white/8 rounded-xl p-3">
              <p className="text-xs text-white/40">Disciplines</p>
              <p className="text-sm font-semibold">
                {String(analysisProfile['disciplineCount'] ?? '-')}
              </p>
            </div>
            <div className="bg-[#171a21] border border-white/8 rounded-xl p-3">
              <p className="text-xs text-white/40">From</p>
              <p className="text-sm font-semibold">{String(analysisProfile['dateMin'] ?? '-')}</p>
            </div>
            <div className="bg-[#171a21] border border-white/8 rounded-xl p-3">
              <p className="text-xs text-white/40">To</p>
              <p className="text-sm font-semibold">{String(analysisProfile['dateMax'] ?? '-')}</p>
            </div>
          </div>
        )}

        <div className="bg-[#171a21] border border-white/10 rounded-2xl p-6 mb-5 min-h-[280px]">
          {isLoading && (
            <div className="h-full flex items-center justify-center gap-2 text-white/60">
              <Loader2 size={16} className="animate-spin" />
              Analyzing normalized dataset...
            </div>
          )}

          {!isLoading && error && (
            <div className="text-red-300 text-sm">
              {error}
            </div>
          )}

          {!isLoading && !error && analysisText && (
            <div className="space-y-3">
              {analysisText.split('\n').map((line, index) => (
                <p key={index} className="text-sm text-white/75 leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={openDashboardWithInsights}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#FF8C38] text-white text-sm font-medium"
          >
            <BarChart3 size={14} />
            Open Dashboard With Insights
          </button>
          <button
            onClick={() => {
              setAnalysisText('');
              setError('');
              setOfflineMode(false);
              void runAnalysis();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/70 hover:text-white hover:border-white/20 text-sm"
          >
            <RefreshCw size={14} />
            Re-run Analysis
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/70 hover:text-white hover:border-white/20 text-sm"
          >
            Go to Overview
          </button>
        </div>
      </div>
    </div>
  );
}
