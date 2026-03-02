import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getDemoSpec } from '../lib/demoData';
import type { DashboardSpec, Module } from '../types';
import { hasDashboardData } from '../utils/dashboardData';
import { useProject } from './ProjectContext';

export type ModuleDataSource = 'demo' | 'upload' | 'remote';

export interface ModuleDataEntry {
  spec: DashboardSpec;
  source: ModuleDataSource;
  loadedAt: string;
  recordsSample: Record<string, unknown>[];
  analysisProfile?: Record<string, unknown>;
}

type ProjectModuleData = Partial<Record<Module, ModuleDataEntry>>;
type ModuleDataByProject = Record<string, ProjectModuleData>;

interface SetModuleDataArgs {
  module: Module;
  spec: DashboardSpec;
  source: ModuleDataSource;
  loadedAt?: string;
  recordsSample?: Record<string, unknown>[];
  analysisProfile?: Record<string, unknown>;
}

interface DashboardDataContextType {
  moduleDataByProject: ModuleDataByProject;
  setModuleData: (args: SetModuleDataArgs, forProjectId?: string | null) => void;
  loadDemoModule: (module: Module, forProjectId?: string | null) => void;
  loadAllDemoModules: (forProjectId?: string | null) => void;
  clearModuleData: (module: Module, forProjectId?: string | null) => void;
  clearAllModuleData: (forProjectId?: string | null) => void;
  getModuleData: (module: Module, forProjectId?: string | null) => ModuleDataEntry | undefined;
  getProjectModuleData: (forProjectId?: string | null) => ProjectModuleData;
  hasModuleData: (module: Module, forProjectId?: string | null) => boolean;
}

const STORAGE_KEY_PREFIX = 'argus.moduleData.';
const MODULES: Module[] = ['manpower', 'equipment', 'progress', 'cost'];
const COST_DEFAULT_START = '2024-01-08';
const COST_DEFAULT_END = '2024-01-12';

const DashboardDataContext = createContext<DashboardDataContextType | undefined>(undefined);

function extractRecordsSampleFromSpec(spec: DashboardSpec): Record<string, unknown>[] {
  const tableVisual = spec.visuals.find((visual) => visual.type === 'table' && visual.data?.length);
  if (tableVisual?.data) return tableVisual.data.slice(0, 20);

  const firstVisual = spec.visuals.find((visual) => visual.data?.length);
  if (firstVisual?.data) return firstVisual.data.slice(0, 20);

  return [];
}

function isValidModuleDataEntry(value: unknown): value is ModuleDataEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as ModuleDataEntry;
  return Boolean(candidate.spec && candidate.source && candidate.loadedAt);
}

function cloneSpec(spec: DashboardSpec): DashboardSpec {
  return {
    ...spec,
    kpis: spec.kpis.map((kpi) => ({ ...kpi })),
    visuals: spec.visuals.map((visual) => ({
      ...visual,
      series: visual.series?.map((item) => ({ ...item })),
      data: visual.data?.map((row) => ({ ...row })),
      columns: visual.columns?.map((column) => ({ ...column })),
    })),
    insights: [...spec.insights],
    meta: {
      ...spec.meta,
      disciplines: [...spec.meta.disciplines],
    },
    lastUpdated: new Date().toISOString(),
  };
}

function withCostDateFallback(module: Module, spec: DashboardSpec): DashboardSpec {
  if (module !== 'cost') return spec;

  return {
    ...spec,
    meta: {
      ...spec.meta,
      dateMin: spec.meta.dateMin || COST_DEFAULT_START,
      dateMax: spec.meta.dateMax || COST_DEFAULT_END,
    },
  };
}

interface DashboardDataProviderProps {
  children: ReactNode;
}

export function DashboardDataProvider({ children }: DashboardDataProviderProps) {
  const { projectId } = useProject();
  const [moduleDataByProject, setModuleDataByProject] = useState<ModuleDataByProject>({});
  const hydratedProjectsRef = useRef<Set<string>>(new Set());

  const persistProjectData = useCallback((targetProjectId: string, data: ProjectModuleData) => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${targetProjectId}`, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to persist project module data:', error);
    }
  }, []);

  const resolveProjectId = useCallback(
    (forProjectId?: string | null): string | null => forProjectId || projectId || null,
    [projectId]
  );

  const hydrateProjectData = useCallback((targetProjectId: string) => {
    if (hydratedProjectsRef.current.has(targetProjectId)) return;
    hydratedProjectsRef.current.add(targetProjectId);

    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${targetProjectId}`);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const sanitized: ProjectModuleData = {};

      MODULES.forEach((module) => {
        const entry = parsed[module];
        if (isValidModuleDataEntry(entry)) {
          sanitized[module] = entry;
        }
      });

      if (Object.keys(sanitized).length > 0) {
        setModuleDataByProject((prev) => ({
          ...prev,
          [targetProjectId]: sanitized,
        }));
      }
    } catch (error) {
      console.error('Failed to hydrate project module data:', error);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${targetProjectId}`);
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    hydrateProjectData(projectId);
  }, [projectId, hydrateProjectData]);

  const setModuleData = useCallback(
    (args: SetModuleDataArgs, forProjectId?: string | null) => {
      const targetProjectId = resolveProjectId(forProjectId);
      if (!targetProjectId) return;

      setModuleDataByProject((prev) => {
        const previousData = prev[targetProjectId] || {};
        const nextEntry: ModuleDataEntry = {
          spec: withCostDateFallback(args.module, args.spec),
          source: args.source,
          loadedAt: args.loadedAt || new Date().toISOString(),
          recordsSample: (args.recordsSample || extractRecordsSampleFromSpec(args.spec)).slice(0, 20),
          analysisProfile: args.analysisProfile,
        };

        const nextProjectData: ProjectModuleData = {
          ...previousData,
          [args.module]: nextEntry,
        };

        persistProjectData(targetProjectId, nextProjectData);

        return {
          ...prev,
          [targetProjectId]: nextProjectData,
        };
      });
    },
    [persistProjectData, resolveProjectId]
  );

  const loadDemoModule = useCallback(
    (module: Module, forProjectId?: string | null) => {
      const spec = getDemoSpec(module);
      if (!spec) return;
      const normalizedSpec = cloneSpec(spec);

      setModuleData(
        {
          module,
          spec: normalizedSpec,
          source: 'demo',
          loadedAt: new Date().toISOString(),
          recordsSample: extractRecordsSampleFromSpec(normalizedSpec),
        },
        forProjectId
      );
    },
    [setModuleData]
  );

  const loadAllDemoModules = useCallback(
    (forProjectId?: string | null) => {
      loadDemoModule('manpower', forProjectId);
      loadDemoModule('equipment', forProjectId);
      loadDemoModule('progress', forProjectId);
      loadDemoModule('cost', forProjectId);
    },
    [loadDemoModule]
  );

  const clearModuleData = useCallback(
    (module: Module, forProjectId?: string | null) => {
      const targetProjectId = resolveProjectId(forProjectId);
      if (!targetProjectId) return;

      setModuleDataByProject((prev) => {
        const previousData = prev[targetProjectId] || {};
        if (!previousData[module]) return prev;

        const nextProjectData = { ...previousData };
        delete nextProjectData[module];
        persistProjectData(targetProjectId, nextProjectData);

        return {
          ...prev,
          [targetProjectId]: nextProjectData,
        };
      });
    },
    [persistProjectData, resolveProjectId]
  );

  const clearAllModuleData = useCallback(
    (forProjectId?: string | null) => {
      const targetProjectId = resolveProjectId(forProjectId);
      if (!targetProjectId) return;

      setModuleDataByProject((prev) => {
        const next = { ...prev, [targetProjectId]: {} };
        persistProjectData(targetProjectId, {});
        return next;
      });
    },
    [persistProjectData, resolveProjectId]
  );

  const getProjectModuleData = useCallback(
    (forProjectId?: string | null): ProjectModuleData => {
      const targetProjectId = resolveProjectId(forProjectId);
      if (!targetProjectId) return {};
      return moduleDataByProject[targetProjectId] || {};
    },
    [moduleDataByProject, resolveProjectId]
  );

  const getModuleData = useCallback(
    (module: Module, forProjectId?: string | null): ModuleDataEntry | undefined => {
      const projectData = getProjectModuleData(forProjectId);
      return projectData[module];
    },
    [getProjectModuleData]
  );

  const hasModuleData = useCallback(
    (module: Module, forProjectId?: string | null): boolean => {
      const entry = getModuleData(module, forProjectId);
      return hasDashboardData(entry?.spec, entry?.recordsSample);
    },
    [getModuleData]
  );

  const value = useMemo<DashboardDataContextType>(
    () => ({
      moduleDataByProject,
      setModuleData,
      loadDemoModule,
      loadAllDemoModules,
      clearModuleData,
      clearAllModuleData,
      getModuleData,
      getProjectModuleData,
      hasModuleData,
    }),
    [
      moduleDataByProject,
      setModuleData,
      loadDemoModule,
      loadAllDemoModules,
      clearModuleData,
      clearAllModuleData,
      getModuleData,
      getProjectModuleData,
      hasModuleData,
    ]
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData(): DashboardDataContextType {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error('useDashboardData must be used within DashboardDataProvider');
  }
  return context;
}
