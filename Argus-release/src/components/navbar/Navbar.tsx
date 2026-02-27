import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Eye,
  LayoutDashboard,
  Users,
  Wrench,
  BarChart3,
  DollarSign,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useProject, type Project } from '../../context/ProjectContext';

interface NavbarProps {
  variant?: 'landing' | 'dashboard';
}

const navLinks = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/dashboard/manpower', label: 'Manpower', icon: Users },
  { path: '/dashboard/equipment', label: 'Equipment', icon: Wrench },
  { path: '/dashboard/progress', label: 'Progress', icon: BarChart3 },
  { path: '/dashboard/cost', label: 'Cost', icon: DollarSign },
];

export default function Navbar({ variant = 'landing' }: NavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { project, projects, setProject, loading } = useProject();
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProjectSelect = useCallback((selectedProject: Project) => {
    setProject(selectedProject);
    setIsProjectDropdownOpen(false);
  }, [setProject]);

  const isActiveRoute = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' && !location.search.includes('module=');
    }
    return location.pathname === path || location.search.includes(`module=${path.split('/').pop()}`);
  };

  return (
    <nav className="sticky top-0 z-50 bg-[#0f1117]/95 backdrop-blur-md border-b border-white/6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-[#FF6A00] rounded-full blur-sm opacity-50" />
              <Eye size={20} className="relative text-[#FF6A00]" strokeWidth={1.5} />
            </div>
            <span className="text-lg font-display font-bold tracking-tight text-white">
              Argus
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = isActiveRoute(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white bg-white/5'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-[#FF6A00]' : ''} />
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-[#FF6A00] rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side: Project selector + CTA */}
          <div className="flex items-center gap-3">
            {/* Project Selector */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white transition-all"
              >
                <span className="text-white/40 text-xs">Project:</span>
                <span className="font-medium truncate max-w-[120px]">
                  {project?.name || 'Demo'}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-white/40 transition-transform ${
                    isProjectDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isProjectDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#171a21] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-3 py-2 border-b border-white/6">
                    <p className="text-xs text-white/40 font-mono uppercase tracking-wider">
                      Select Project
                    </p>
                  </div>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleProjectSelect(p)}
                      className={`w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${
                        project?.id === p.id
                          ? 'bg-[#FF6A00]/10 text-white'
                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          project?.id === p.id ? 'bg-[#FF6A00]' : 'bg-white/20'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.name}</p>
                        <p className="text-xs text-white/40">{p.code}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CTA Button - Desktop */}
            <Link
              to="/dashboard"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-[#FF6A00] hover:bg-[#FF8C38] text-white text-sm font-medium rounded-xl transition-colors"
            >
              Open Dashboard
              <ArrowRight size={14} />
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/6 py-4">
            <div className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = isActiveRoute(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'text-white bg-[#FF6A00]/10 border border-[#FF6A00]/20'
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-[#FF6A00]' : ''} />
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-white/6">
              <Link
                to="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF6A00] hover:bg-[#FF8C38] text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Sparkles size={14} />
                Open Dashboard
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
