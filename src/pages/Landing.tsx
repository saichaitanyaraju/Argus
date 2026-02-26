import { useNavigate } from 'react-router-dom'
import { Users, Wrench, BarChart3, DollarSign, ArrowRight, Eye, Zap, Shield, Clock, Search } from 'lucide-react'
<<<<<<< HEAD
import { useState, useRef } from 'react'
=======
import { useState, useRef, type KeyboardEvent } from 'react'
>>>>>>> 89c15af (Fix: cost module, xlsx upload, security + deploy fixes)
import ArgusLogo from '../components/ui/ArgusLogo'
import Badge from '../components/ui/Badge'

const modules = [
  {
    id: 'manpower',
    icon: Users,
    label: 'Analyze Man Power',
    desc: 'Headcount tracking, planned vs actual, discipline breakdown, variance analysis.',
    path: '/dashboard?module=manpower',
    color: 'from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:border-blue-500/40',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    id: 'equipment',
    icon: Wrench,
    label: 'Analyze Equipment',
    desc: 'Fleet status, utilization rates, idle & breakdown tracking per discipline.',
    path: '/dashboard?module=equipment',
    color: 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/20 hover:border-yellow-500/40',
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-500/10 border-yellow-500/20',
  },
  {
    id: 'progress',
    icon: BarChart3,
    label: 'Analyze Work Progress',
    desc: 'Schedule performance, slippage detection, completion % by discipline.',
    path: '/dashboard?module=progress',
    color: 'from-green-500/10 to-green-600/5 border-green-500/20 hover:border-green-500/40',
    iconColor: 'text-green-400',
    iconBg: 'bg-green-500/10 border-green-500/20',
  },
  {
    id: 'cost',
    icon: DollarSign,
    label: 'Analyze Cost',
    desc: 'Budget tracking, cost variance, spend by discipline, and financial KPIs.',
    path: '/dashboard?module=cost',
    color: 'from-accent/10 to-orange-600/5 border-accent/20 hover:border-accent/40',
    iconColor: 'text-accent',
    iconBg: 'bg-accent/10 border-accent/20',
  },
]

const SUGGESTIONS = [
  { icon: '👷', text: 'What is the current manpower status?' },
  { icon: '🔧', text: 'Which equipment is idle right now?' },
  { icon: '📊', text: 'Summarize work progress by discipline' },
  { icon: '💰', text: 'Show cost variance this week' },
]

const features = [
  { icon: Zap, label: 'Instant KPIs', desc: 'Auto-computed on upload' },
  { icon: Eye, label: 'Live Dashboards', desc: 'Spec-driven rendering' },
  { icon: Shield, label: 'Deterministic', desc: 'No AI hallucinations' },
  { icon: Clock, label: 'Audit-ready', desc: 'Timestamped records' },
]

export default function Landing() {
  const navigate = useNavigate()
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = (text: string) => {
    setSearchValue(text)
    setSearchFocused(false)
    navigate('/dashboard?module=manpower&q=' + encodeURIComponent(text))
  }

<<<<<<< HEAD
  const handleKey = (e: React.KeyboardEvent) => {
=======
  const handleKey = (e: KeyboardEvent) => {
>>>>>>> 89c15af (Fix: cost module, xlsx upload, security + deploy fixes)
    if (e.key === 'Enter' && searchValue.trim()) handleSearch(searchValue.trim())
  }

  return (
    <div className="min-h-screen bg-bg grid-bg relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/6">
        <ArgusLogo size="md" />
        <div className="flex items-center gap-3">
          <Badge variant="default">v1.0 · Public Mode</Badge>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-xl transition-colors"
          >
            Open Dashboard <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      <main className="relative z-10 max-w-5xl mx-auto px-8 pt-20 pb-32">
        {/* Hero */}
        <div className="text-center mb-16 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-mono uppercase tracking-widest mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Project Visibility Copilot
          </div>
          <h1 className="text-6xl font-display font-bold text-white mb-5 leading-tight tracking-tight">
            Welcome to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-orange-300">
              Argus
            </span>
          </h1>
          <p className="text-lg text-white/40 max-w-lg mx-auto leading-relaxed font-body">
            Upload site files. Get dashboards and KPIs automatically.<br />
            No configuration. No manual formulas.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-14 animate-slide-up delay-100" style={{ opacity: 0, animationFillMode: 'forwards' }}>
          {features.map(f => (
            <div key={f.label} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-white/8">
              <f.icon size={14} className="text-accent" />
              <span className="text-sm font-medium text-white/60">{f.label}</span>
              <span className="text-xs text-white/25">·</span>
              <span className="text-xs text-white/30">{f.desc}</span>
            </div>
          ))}
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-2 gap-4 mb-14">
          {modules.map((mod, i) => (
            <button
              key={mod.id}
              onClick={() => navigate(mod.path)}
              className={`group relative text-left p-6 rounded-2xl bg-gradient-to-br border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 animate-slide-up ${mod.color}`}
              style={{ animationDelay: `${i * 80 + 200}ms`, animationFillMode: 'both', opacity: 0 }}
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border mb-4 ${mod.iconBg}`}>
                <mod.icon size={18} className={mod.iconColor} />
              </div>
              <h3 className="text-base font-display font-semibold text-white mb-1.5">{mod.label}</h3>
              <p className="text-sm text-white/35 leading-relaxed">{mod.desc}</p>
              <ArrowRight size={16} className="absolute bottom-5 right-5 text-white/20 group-hover:text-white/50 transition-all group-hover:translate-x-1" />
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="animate-slide-up delay-400 max-w-2xl mx-auto relative" style={{ opacity: 0, animationFillMode: 'forwards' }}>
          <div
            className={`flex items-center gap-3 px-5 py-3.5 bg-card border rounded-2xl transition-all duration-200 cursor-text ${
              searchFocused
                ? 'border-accent/35 shadow-[0_0_0_3px_rgba(255,106,0,0.07)] bg-card2'
                : 'border-white/10 hover:border-white/16'
            }`}
            onClick={() => inputRef.current?.focus()}
          >
            <Search size={16} className={`flex-shrink-0 transition-colors ${searchFocused ? 'text-accent' : 'text-white/25'}`} />
            <input
              ref={inputRef}
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={handleKey}
              placeholder="Search across all modules — manpower, equipment, cost, progress…"
              className="flex-1 bg-transparent text-sm text-white/75 placeholder-white/20 outline-none"
            />
            <kbd className="flex-shrink-0 px-1.5 py-0.5 rounded bg-white/4 border border-white/8 text-white/15 text-xs font-mono">⏎</kbd>
          </div>

          {/* Suggestions dropdown */}
          {searchFocused && (
            <div className="absolute top-full mt-1.5 left-0 right-0 bg-card2 border border-white/9 rounded-2xl overflow-hidden shadow-2xl z-50">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onMouseDown={() => handleSearch(s.text)}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-white/50 hover:bg-accent/5 hover:text-white/85 transition-colors border-b border-white/4 last:border-none text-left"
                >
                  <span className="text-base">{s.icon}</span>
                  {s.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
