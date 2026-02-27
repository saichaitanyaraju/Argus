import { useState } from 'react'
import { Filter, ChevronDown, X } from 'lucide-react'

interface Props {
  disciplines: string[]
  dateMin: string
  dateMax: string
  selectedDisciplines: string[]
  dateFrom: string
  dateTo: string
  onChange: (filters: { disciplines: string[]; dateFrom: string; dateTo: string }) => void
}

export default function Filters({ disciplines, dateMin, dateMax, selectedDisciplines, dateFrom, dateTo, onChange }: Props) {
  const [disciplineOpen, setDisciplineOpen] = useState(false)

  const toggleDiscipline = (d: string) => {
    const next = selectedDisciplines.includes(d)
      ? selectedDisciplines.filter(x => x !== d)
      : [...selectedDisciplines, d]
    onChange({ disciplines: next, dateFrom, dateTo })
  }

  const clearDisciplines = () => onChange({ disciplines: [], dateFrom, dateTo })

  return (
    <div className="flex flex-wrap items-center gap-3 px-1">
      <div className="flex items-center gap-1.5 text-xs text-white/30 font-mono">
        <Filter size={12} />
        <span>FILTERS</span>
      </div>

      {/* Discipline picker */}
      <div className="relative">
        <button
          onClick={() => setDisciplineOpen(prev => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-card2 border border-white/10 rounded-xl text-xs text-white/60 hover:border-accent/30 hover:text-white transition-all"
        >
          <span>
            {selectedDisciplines.length === 0 ? 'All Disciplines' : `${selectedDisciplines.length} selected`}
          </span>
          {selectedDisciplines.length > 0 && (
            <X size={11} className="text-white/40 hover:text-white" onClick={(e) => { e.stopPropagation(); clearDisciplines() }} />
          )}
          <ChevronDown size={12} className={`transition-transform ${disciplineOpen ? 'rotate-180' : ''}`} />
        </button>

        {disciplineOpen && (
          <div className="absolute top-full mt-1.5 left-0 bg-card2 border border-white/10 rounded-xl overflow-hidden shadow-xl z-20 min-w-[160px]">
            {disciplines.map(d => (
              <button
                key={d}
                onClick={() => toggleDiscipline(d)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white transition-colors"
              >
                <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selectedDisciplines.includes(d) ? 'bg-accent border-accent' : 'border-white/20'}`}>
                  {selectedDisciplines.includes(d) && <span className="text-white text-[8px] leading-none">✓</span>}
                </span>
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date range */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={dateFrom}
          min={dateMin}
          max={dateMax}
          onChange={e => onChange({ disciplines: selectedDisciplines, dateFrom: e.target.value, dateTo })}
          className="px-2.5 py-1.5 bg-card2 border border-white/10 rounded-xl text-xs text-white/60 outline-none focus:border-accent/30 hover:border-white/20 transition-colors"
        />
        <span className="text-white/20 text-xs">→</span>
        <input
          type="date"
          value={dateTo}
          min={dateMin}
          max={dateMax}
          onChange={e => onChange({ disciplines: selectedDisciplines, dateFrom, dateTo: e.target.value })}
          className="px-2.5 py-1.5 bg-card2 border border-white/10 rounded-xl text-xs text-white/60 outline-none focus:border-accent/30 hover:border-white/20 transition-colors"
        />
      </div>
    </div>
  )
}
