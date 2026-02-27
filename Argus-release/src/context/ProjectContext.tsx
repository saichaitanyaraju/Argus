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
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const STORAGE_KEY = 'argus.activeProject';

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [project, setProjectState] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all projects from Supabase
  const fetchProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projects:', error);
        // Fallback to demo project if fetch fails
        const demoProject: Project = {
          id: 'demo-project-id',
          name: 'Demo Project',
          code: 'DEMO-001',
          client: 'Argus Demo Client',
          location: 'Abu Dhabi, UAE',
          currency: 'AED',
        };
        setProjects([demoProject]);
        return;
      }

      const fetchedProjects = data || [];
      setProjects(fetchedProjects);

      // If no projects exist, use demo project
      if (fetchedProjects.length === 0) {
        const demoProject: Project = {
          id: 'demo-project-id',
          name: 'Demo Project',
          code: 'DEMO-001',
          client: 'Argus Demo Client',
          location: 'Abu Dhabi, UAE',
          currency: 'AED',
        };
        setProjects([demoProject]);
      }
    } catch (err) {
      console.error('Unexpected error fetching projects:', err);
    }
  }, []);

  // Set active project
  const setProject = useCallback((selectedProject: Project) => {
    setProjectId(selectedProject.id);
    setProjectName(selectedProject.name);
    setProjectState(selectedProject);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProject));
  }, []);

  // Refresh projects list
  const refreshProjects = useCallback(async () => {
    setLoading(true);
    await fetchProjects();
    setLoading(false);
  }, [fetchProjects]);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await fetchProjects();

      // Try to load from localStorage first
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed: Project = JSON.parse(stored);
          setProjectId(parsed.id);
          setProjectName(parsed.name);
          setProjectState(parsed);
          setLoading(false);
          return;
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      // Default to Demo Project if available
      const { data: demoProject } = await supabase
        .from('projects')
        .select('*')
        .eq('code', 'DEMO-001')
        .single();

      if (demoProject) {
        setProject(demoProject as Project);
      } else if (projects.length > 0) {
        setProject(projects[0]);
      }

      setLoading(false);
    };

    initialize();
  }, [fetchProjects, setProject]);

  const value: ProjectContextType = {
    projectId,
    projectName,
    project,
    projects,
    loading,
    setProject,
    refreshProjects,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextType {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

export default ProjectContext;
