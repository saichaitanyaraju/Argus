import { Lightbulb } from 'lucide-react'

interface Props {
  insights: string[]
}

export default function InsightsPanel({ insights }: Props) {
  if (!insights.length) return null

  return (
    <div className="bg-card border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb size={16} className="text-accent" />
        <h3 className="text-sm font-display font-semibold text-white/80 uppercase tracking-wide">Key Insights</h3>
      </div>
      <div className="space-y-2.5">
        {insights.map((insight, i) => (
          <div key={i} className="flex gap-3 items-start animate-slide-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both', opacity: 0 }}>
            <span className="w-5 h-5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-mono">
              {i + 1}
            </span>
            <p className="text-sm text-white/60 leading-relaxed">{insight}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
