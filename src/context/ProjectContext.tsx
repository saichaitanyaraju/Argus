import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export interface Project {
  id: string
  name: string
  code: string
}

interface ProjectContextValue {
  projects: Project[]
  selectedProject: Project | null
  selectProject: (proj: Project) => void
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined)

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('projects').select('id,name,code')
      if (error) {
        console.error('Failed to load projects', error)
        return
      }
      if (data) {
        const projList = data as Project[]
        setProjects(projList)
        if (!selectedProject && projList.length) {
          setSelectedProject(projList[0])
        }
      }
    }
    load()
  }, [])

  const selectProject = (proj: Project) => {
    setSelectedProject(proj)
  }

  return (
    <ProjectContext.Provider value={{ projects, selectedProject, selectProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export const useProject = () => {
  const ctx = useContext(ProjectContext)
  if (!ctx) {
    throw new Error('useProject must be used within ProjectProvider')
  }
  return ctx
}
