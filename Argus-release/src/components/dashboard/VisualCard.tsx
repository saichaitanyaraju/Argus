import { Visual } from '../../types'
import ChartRenderer from './ChartRenderer'
import DataTable from './DataTable'

interface Props {
  visual: Visual
  index?: number
}

export default function VisualCard({ visual, index = 0 }: Props) {
  return (
    <div
      className="bg-card border border-white/8 rounded-2xl p-5 animate-slide-up"
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both', opacity: 0 }}
    >
      <h3 className="text-sm font-display font-semibold text-white/70 mb-4">{visual.title}</h3>
      {visual.type === 'table' ? (
        <DataTable visual={visual} />
      ) : (
        <ChartRenderer visual={visual} />
      )}
    </div>
  )
}
