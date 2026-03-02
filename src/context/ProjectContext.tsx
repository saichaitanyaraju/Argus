import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface Project {
  id: string;
  name: string;
  code: string;
  client?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  currency?: string;
}

interface ProjectContextType {
  projectId: string | null;
  projectName: string | null;
  project: Project | null;
  projects: Project[];
  loading: boolean;
  setProject: (project: Project) => void;
  createProject: (input: { name: string; code?: string }) => Promise<Project | null>;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const STORAGE_KEY = 'argus.activeProject';

interface ProjectProviderProps {
  children: ReactNode;
}

const DEMO_PROJECT: Project = {
  id: 'demo-project-id',
  name: 'Demo Project',
  code: 'DEMO-001',
  client: 'Argus Demo Client',
  location: 'Abu Dhabi, UAE',
  currency: 'AED',
};

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [project, setProjectState] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async (): Promise<Project[]> => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projects:', error);
        setProjects([DEMO_PROJECT]);
        return [DEMO_PROJECT];
      }

      const fetchedProjects = (data || []) as Project[];
      if (fetchedProjects.length === 0) {
        setProjects([DEMO_PROJECT]);
        return [DEMO_PROJECT];
      }

      setProjects(fetchedProjects);
      return fetchedProjects;
    } catch (err) {
      console.error('Unexpected error fetching projects:', err);
      setProjects([DEMO_PROJECT]);
      return [DEMO_PROJECT];
    }
  }, []);

  const setProject = useCallback((selectedProject: Project) => {
    setProjectId(selectedProject.id);
    setProjectName(selectedProject.name);
    setProjectState(selectedProject);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProject));
  }, []);

  const createProject = useCallback(
    async ({ name, code }: { name: string; code?: string }): Promise<Project | null> => {
      const trimmedName = name.trim();
      if (!trimmedName) return null;

      const generatedCode =
        code?.trim() ||
        `${trimmedName
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 12)}-${Date.now().toString().slice(-4)}`;

      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: trimmedName,
          code: generatedCode,
          status: 'active',
        })
        .select('*')
        .single();

      if (error || !data) {
        console.error('Error creating project:', error);
        return null;
      }

      const createdProject = data as Project;
      setProjects((prev) => [createdProject, ...prev.filter((p) => p.id !== createdProject.id)]);
      setProject(createdProject);
      return createdProject;
    },
    [setProject]
  );

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    await fetchProjects();
    setLoading(false);
  }, [fetchProjects]);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      const fetchedProjects = await fetchProjects();

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed: Project = JSON.parse(stored);
          const matched =
            fetchedProjects.find((proj) => proj.id === parsed.id) ||
            fetchedProjects.find((proj) => proj.code === parsed.code);
          if (matched) {
            setProject(matched);
            setLoading(false);
            return;
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      const demoFromList = fetchedProjects.find((proj) => proj.code === 'DEMO-001');
      if (demoFromList) {
        setProject(demoFromList);
      } else if (fetchedProjects.length > 0) {
        setProject(fetchedProjects[0]);
      } else {
        setProject(DEMO_PROJECT);
      }

      setLoading(false);
    };

    initialize();
  }, [fetchProjects, setProject]);

  useEffect(() => {
    if (!projectId && projects.length > 0 && !loading) {
      const fallback = projects.find((proj) => proj.code === 'DEMO-001') || projects[0];
      if (fallback) setProject(fallback);
    }
  }, [projectId, projects, loading, setProject]);

  const value: ProjectContextType = {
    projectId,
    projectName,
    project,
    projects,
    loading,
    setProject,
    createProject,
    refreshProjects,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextType {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

export default ProjectContext;
