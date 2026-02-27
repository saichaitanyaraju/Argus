import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell
} from 'recharts'
import { Visual } from '../../types'

interface Props {
  visual: Visual
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{name: string; value: number; color: string}>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card2 border border-white/10 rounded-xl p-3 shadow-xl">
        <p className="text-xs text-white/50 font-mono mb-2">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-white/60">{p.name}:</span>
            <span className="text-white font-medium">{p.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function ChartRenderer({ visual }: Props) {
  const { type, data, series, xKey } = visual

  if (!data || data.length === 0) return (
    <div className="h-48 flex items-center justify-center text-white/20 text-sm font-mono">
      No data available
    </div>
  )

  const commonProps = {
    data,
    margin: { top: 8, right: 8, left: -16, bottom: 0 },
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#666', fontFamily: 'DM Sans' }} />
          <YAxis tick={{ fontSize: 11, fill: '#666', fontFamily: 'DM Sans' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'DM Sans', color: '#aaa' }} />
          {series?.map(s => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ fill: s.color, r: 3 }}
              activeDot={{ r: 5, stroke: s.color, strokeWidth: 2, fill: '#1c202a' }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#666', fontFamily: 'DM Sans' }} />
          <YAxis tick={{ fontSize: 11, fill: '#666', fontFamily: 'DM Sans' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'DM Sans', color: '#aaa' }} />
          {series?.map(s => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={32} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'stackedBar') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#666', fontFamily: 'DM Sans' }} />
          <YAxis tick={{ fontSize: 11, fill: '#666', fontFamily: 'DM Sans' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'DM Sans', color: '#aaa' }} />
          {series?.map(s => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId="a" maxBarSize={40} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return null
}
