import { Visual } from '../../types'

interface Props {
  visual: Visual
}

const statusColors: Record<string, string> = {
  'Active': 'text-green-400',
  'Idle': 'text-yellow-400',
  'Breakdown': 'text-red-400',
  'On Track': 'text-green-400',
  'Ahead': 'text-blue-400',
  'Behind': 'text-red-400',
  'Minor Delay': 'text-yellow-400',
}

export default function DataTable({ visual }: Props) {
  const { data, columns } = visual

  if (!data || !columns || data.length === 0) {
    return <div className="text-white/20 text-sm font-mono py-4 text-center">No data</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/6">
            {columns.map(col => (
              <th key={col.key} className="text-left py-2.5 px-3 text-xs font-mono text-white/35 uppercase tracking-wider">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-white/4 hover:bg-white/3 transition-colors">
              {columns.map(col => {
                const val = row[col.key] as string
                const isStatus = statusColors[val]
                const isNegative = typeof val === 'string' && val.startsWith('-')
                const isPositive = typeof val === 'string' && val.startsWith('+')
                return (
                  <td key={col.key} className={`py-2.5 px-3 ${isStatus ? statusColors[val] : isNegative ? 'text-red-400' : isPositive ? 'text-green-400' : 'text-white/70'}`}>
                    {col.key === 'status' ? (
                      <span className={`inline-flex items-center gap-1.5 text-xs`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isStatus ? (val === 'Active' || val === 'On Track' || val === 'Ahead' ? 'bg-green-400' : val === 'Idle' || val === 'Minor Delay' ? 'bg-yellow-400' : 'bg-red-400') : 'bg-white/20'}`} />
                        {val}
                      </span>
                    ) : (
                      String(val)
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
