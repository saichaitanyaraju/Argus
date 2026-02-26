import { useNavigate } from 'react-router-dom';
import {
  Users,
  Wrench,
  BarChart3,
  DollarSign,
  ArrowRight,
  Eye,
  Zap,
  Shield,
  Clock,
  LayoutDashboard,
  FolderKanban,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import Navbar from '../components/navbar/Navbar';
import AIAskBar from '../components/ai/AIAskBar';
import HowItWorks from '../components/how-it-works/HowItWorks';
import Footer from '../components/ui/Footer';

const modules = [
  {
    id: 'manpower',
    icon: Users,
    label: 'Analyze Man Power',
    desc: 'Headcount tracking, planned vs actual, discipline breakdown, variance analysis.',
    path: '/dashboard/manpower',
    color: 'from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:border-blue-500/40',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    id: 'equipment',
    icon: Wrench,
    label: 'Analyze Equipment',
    desc: 'Fleet status, utilization rates, idle & breakdown tracking per discipline.',
    path: '/dashboard/equipment',
    color: 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/20 hover:border-yellow-500/40',
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-500/10 border-yellow-500/20',
  },
  {
    id: 'progress',
    icon: BarChart3,
    label: 'Analyze Work Progress',
    desc: 'Schedule performance, slippage detection, completion % by discipline.',
    path: '/dashboard/progress',
    color: 'from-green-500/10 to-green-600/5 border-green-500/20 hover:border-green-500/40',
    iconColor: 'text-green-400',
    iconBg: 'bg-green-500/10 border-green-500/20',
  },
  {
    id: 'cost',
    icon: DollarSign,
    label: 'Analyze Cost',
    desc: 'Budget tracking, cost variance, spend by discipline, and financial KPIs.',
    path: '/dashboard/cost',
    color: 'from-[#FF6A00]/10 to-orange-600/5 border-[#FF6A00]/20 hover:border-[#FF6A00]/40',
    iconColor: 'text-[#FF6A00]',
    iconBg: 'bg-[#FF6A00]/10 border-[#FF6A00]/20',
  },
];

const features = [
  { icon: Zap, label: 'Instant KPIs', desc: 'Auto-computed on upload' },
  { icon: Eye, label: 'Live Dashboards', desc: 'Spec-driven rendering' },
  { icon: Shield, label: 'Deterministic', desc: 'No AI hallucinations' },
  { icon: Clock, label: 'Audit-ready', desc: 'Timestamped records' },
  { icon: FolderKanban, label: 'Multi-Project', desc: 'One dashboard' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { project } = useProject();

  return (
    <div className="min-h-screen bg-[#0f1117] grid-bg relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-[#FF6A00]/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

      {/* Navbar */}
      <Navbar variant="landing" />

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="pt-16 pb-12 px-6">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FF6A00]/10 border border-[#FF6A00]/20 text-[#FF6A00] text-xs font-mono uppercase tracking-widest mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-pulse" />
              Project Visibility Copilot
            </div>

            {/* Heading */}
            <h1 className="text-5xl sm:text-6xl font-display font-bold text-white mb-5 leading-tight tracking-tight">
              Welcome to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6A00] to-orange-300">
                Argus
              </span>
            </h1>

            {/* Subtitle - Updated per spec */}
            <p className="text-lg text-white/40 max-w-xl mx-auto leading-relaxed font-body">
              Your construction site data, turned into decisions — instantly.
            </p>
          </div>
        </section>

        {/* Feature Pills */}
        <section className="pb-14 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-wrap justify-center gap-3">
              {features.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#171a21] border border-white/8"
                >
                  <f.icon size={14} className="text-[#FF6A00]" />
                  <span className="text-sm font-medium text-white/60">{f.label}</span>
                  <span className="text-xs text-white/25">·</span>
                  <span className="text-xs text-white/30">{f.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Module Cards Section */}
        <section className="pb-8 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project Overview Card - Full width */}
              <button
                onClick={() => navigate('/dashboard')}
                className="group md:col-span-2 relative text-left p-6 rounded-2xl bg-gradient-to-br from-[#1E3A5F] to-[#0f1117] border border-white/10 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-white/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1E3A5F] border border-white/10">
                      <LayoutDashboard size={22} className="text-blue-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-semibold text-white mb-1.5">
                        Project Overview
                      </h3>
                      <p className="text-sm text-white/40 max-w-md leading-relaxed">
                        Cross-module health score, live KPIs from all modules, recent upload
                        history, and AI-generated project status narrative.
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    size={20}
                    className="text-white/20 group-hover:text-white/50 group-hover:translate-x-1 transition-all"
                  />
                </div>
              </button>

              {/* Module Cards - 2x2 grid */}
              {modules.map((mod, i) => (
                <button
                  key={mod.id}
                  onClick={() => navigate(mod.path)}
                  className={`group relative text-left p-6 rounded-2xl bg-gradient-to-br border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${mod.color}`}
                >
                  <div
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border mb-4 ${mod.iconBg}`}
                  >
                    <mod.icon size={18} className={mod.iconColor} />
                  </div>
                  <h3 className="text-base font-display font-semibold text-white mb-1.5">
                    {mod.label}
                  </h3>
                  <p className="text-sm text-white/35 leading-relaxed">{mod.desc}</p>
                  <ArrowRight
                    size={16}
                    className="absolute bottom-5 right-5 text-white/20 group-hover:text-white/50 transition-all group-hover:translate-x-1"
                  />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <HowItWorks />

        {/* AI Ask Bar Section */}
        <section className="py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-xl font-display font-semibold text-white mb-2">
                Ask Argus Anything
              </h2>
              <p className="text-sm text-white/40">
                Get instant answers from your project data
              </p>
            </div>
            <AIAskBar />
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

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
