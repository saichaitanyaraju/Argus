import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { KPI } from '../../types'

interface Props {
  kpi: KPI
  highlighted?: boolean
  index?: number
}

const statusColors = {
  good: 'border-green-500/20 bg-green-500/5',
  warning: 'border-yellow-500/20 bg-yellow-500/5',
  danger: 'border-red-500/20 bg-red-500/5',
  neutral: 'border-white/8',
}

const statusValueColors = {
  good: 'text-green-400',
  warning: 'text-yellow-400',
  danger: 'text-red-400',
  neutral: 'text-white',
}

export default function KPICard({ kpi, highlighted, index = 0 }: Props) {
  const borderColor = statusColors[kpi.status || 'neutral']
  const valueColor = statusValueColors[kpi.status || 'neutral']

  const isPositive = kpi.delta?.startsWith('+')
  const isNegative = kpi.delta?.startsWith('-')

  return (
    <div
      className={`relative p-5 rounded-2xl border ${borderColor} bg-card transition-all duration-300 hover:border-accent/20 hover:bg-card2 animate-slide-up`}
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both', opacity: 0 }}
    >
      {highlighted && (
        <div className="absolute inset-0 rounded-2xl border border-accent/40 pointer-events-none" />
      )}

      <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-2">{kpi.label}</p>
      <div className="flex items-end justify-between gap-2">
        <span className={`text-3xl font-display font-bold ${valueColor}`}>
          {kpi.value}
          {kpi.unit && <span className="text-base ml-1 opacity-60">{kpi.unit}</span>}
        </span>
        {kpi.delta && (
          <div className={`flex items-center gap-1 text-sm font-medium mb-0.5 ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-white/50'}`}>
            {isPositive ? <TrendingUp size={14} /> : isNegative ? <TrendingDown size={14} /> : <Minus size={14} />}
            <span>{kpi.delta}</span>
          </div>
        )}
      </div>
      {kpi.subLabel && (
        <p className="text-xs text-white/30 mt-1.5">{kpi.subLabel}</p>
      )}
    </div>
  )
}
