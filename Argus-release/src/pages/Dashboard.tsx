import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Users, Wrench, BarChart3, DollarSign, Download, RefreshCw, Calendar } from 'lucide-react'
import ArgusLogo from '../components/ui/ArgusLogo'
import Badge from '../components/ui/Badge'
import KPICard from '../components/dashboard/KPICard'
import VisualCard from '../components/dashboard/VisualCard'
import InsightsPanel from '../components/dashboard/InsightsPanel'
import Filters from '../components/dashboard/Filters'
import UploadZone from '../components/upload/UploadZone'
import ChatPanel, { ChatButton } from '../components/chat/ChatPanel'
import { Module, DashboardSpec } from '../types'
import { getDemoSpec } from '../lib/demoData'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

const MODULE_CONFIG: Record<Module, { label: string; icon: typeof Users; color: string }> = {
  manpower: { label: 'Man Power', icon: Users, color: 'text-blue-400' },
  equipment: { label: 'Equipment', icon: Wrench, color: 'text-yellow-400' },
  progress: { label: 'Work Progress', icon: BarChart3, color: 'text-green-400' },
  cost: { label: 'Cost', icon: DollarSign, color: 'text-accent' },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const moduleParam = searchParams.get('module') as Module | null
  const activeModule: Module = moduleParam || 'manpower'

  const [specs, setSpecs] = useState<Partial<Record<Module, DashboardSpec>>>({})
  const [highlightedKpi, setHighlightedKpi] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [filterDisciplines, setFilterDisciplines] = useState<string[]>([])
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [useDemoData, setUseDemoData] = useState(false)

  const currentSpec = specs[activeModule]
  const hasData = !!currentSpec

  const setModule = (m: Module) => {
    setSearchParams({ module: m })
    setFilterDisciplines([])
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  useEffect(() => {
    if (specs[activeModule]) return
    loadSpec(activeModule)
  }, [activeModule])

  const loadSpec = async (mod: Module) => {
    try {
      const { data } = await supabase.functions.invoke('get-dashboard', { body: { module: mod } })
      if (data?.spec) setSpecs(prev => ({ ...prev, [mod]: data.spec }))
    } catch { /* silent — user will upload */ }
  }

  const handleSpecLoaded = (spec: DashboardSpec) => {
    setSpecs(prev => ({ ...prev, [activeModule]: spec }))
    setFilterDisciplines([])
    setFilterDateFrom(spec.meta.dateMin)
    setFilterDateTo(spec.meta.dateMax)
    setUseDemoData(false)
  }

  const handleLoadDemo = () => {
    const demo = getDemoSpec(activeModule)
    if (demo) {
      setSpecs(prev => ({ ...prev, [activeModule]: demo }))
      setFilterDisciplines([])
      setFilterDateFrom(demo.meta.dateMin)
      setFilterDateTo(demo.meta.dateMax)
      setUseDemoData(true)
    }
  }

  const handleExport = async () => {
    if (!currentSpec) return
    setIsExporting(true)
    try {
      const { data, error } = await supabase.functions.invoke('export-report', {
        body: { module: activeModule, disciplines: filterDisciplines, dateFrom: filterDateFrom, dateTo: filterDateTo, spec: currentSpec },
      })
      if (error) throw error
      if (data?.pdf_url) window.open(data.pdf_url, '_blank')
      if (data?.excel_url) window.open(data.excel_url, '_blank')
    } catch {
      alert('Export requires Supabase edge functions to be deployed. See SETUP.md.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleHighlightKpi = (id: string) => {
    setHighlightedKpi(id)
    setTimeout(() => setHighlightedKpi(null), 3000)
  }

  const handleFilterChange = (filters: { disciplines: string[]; dateFrom: string; dateTo: string }) => {
    setFilterDisciplines(filters.disciplines)
    setFilterDateFrom(filters.dateFrom)
    setFilterDateTo(filters.dateTo)
  }

  const filteredSpec: DashboardSpec | undefined = currentSpec ? {
    ...currentSpec,
    visuals: currentSpec.visuals.map(v => ({
      ...v,
      data: v.data?.filter(row => {
        if (filterDisciplines.length > 0) {
          const disc = row.discipline as string
          if (disc && !filterDisciplines.includes(disc)) return false
        }
        return true
      }),
    })),
  } : undefined

  return (
    <div className="min-h-screen bg-bg">
      {/* Top Nav */}
      <nav className="sticky top-0 z-30 bg-bg/95 backdrop-blur-md border-b border-white/6 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors text-sm">
            <ArrowLeft size={16} /><span className="hidden sm:inline">Back</span>
          </button>
          <div className="w-px h-5 bg-white/8" />
          <ArgusLogo size="sm" />
        </div>
        <div className="flex items-center gap-3">
          {hasData && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-card hover:bg-card2 border border-white/10 rounded-xl text-xs text-white/60 hover:text-white transition-all"
            >
              {isExporting ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
              Export Report
            </button>
          )}
          <Badge variant="default">Public Mode</Badge>
        </div>
      </nav>

      {/* Module Tabs */}
      <div className="border-b border-white/6 bg-card/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 overflow-x-auto">
          {(Object.keys(MODULE_CONFIG) as Module[]).map(mod => {
            const cfg = MODULE_CONFIG[mod]
            const isActive = mod === activeModule
            const hasModData = !!specs[mod]
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
                {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-full" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <UploadZone module={activeModule} onSpecLoaded={handleSpecLoaded} />
            <div className="mt-8 text-center">
              <p className="text-white/20 text-xs font-mono mb-3">— or —</p>
              <button
                onClick={handleLoadDemo}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all mx-auto"
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
                <KPICard key={kpi.id} kpi={kpi} highlighted={highlightedKpi === kpi.id} index={i} />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSpec!.visuals.filter(v => v.type !== 'table').map((v, i) => (
                <VisualCard key={v.id} visual={v} index={i} />
              ))}
            </div>

            {filteredSpec!.visuals.filter(v => v.type === 'table').map((v, i) => (
              <VisualCard key={v.id} visual={v} index={i} />
            ))}

            <InsightsPanel insights={filteredSpec!.insights} />
          </div>
        )}
      </div>

      {!chatOpen && <ChatButton onClick={() => setChatOpen(true)} isOpen={chatOpen} />}
      <ChatPanel
        module={activeModule}
        spec={currentSpec}
        onHighlightKpi={handleHighlightKpi}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  )
}
