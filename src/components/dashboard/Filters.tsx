import { useEffect, useState } from 'react';
import { Filter, ChevronDown, X } from 'lucide-react';
import { toIsoDate } from '../../utils/dateParser';

interface Props {
  disciplines: string[];
  selectedDisciplines: string[];
  dateFrom: string;
  dateTo: string;
  onChange: (filters: { disciplines: string[]; dateFrom: string; dateTo: string }) => void;
  readOnly?: boolean;
}

export default function Filters({
  disciplines,
  selectedDisciplines,
  dateFrom,
  dateTo,
  onChange,
  readOnly = false,
}: Props) {
  const [disciplineOpen, setDisciplineOpen] = useState(false);
  const [localDateFrom, setLocalDateFrom] = useState(dateFrom);
  const [localDateTo, setLocalDateTo] = useState(dateTo);
  const wideMin = '2020-01-01';
  const wideMax = new Date().toISOString().split('T')[0];

  useEffect(() => {
    setLocalDateFrom(dateFrom);
  }, [dateFrom]);

  useEffect(() => {
    setLocalDateTo(dateTo);
  }, [dateTo]);

  const toggleDiscipline = (discipline: string) => {
    if (readOnly) return;

    const next = selectedDisciplines.includes(discipline)
      ? selectedDisciplines.filter((item) => item !== discipline)
      : [...selectedDisciplines, discipline];

    onChange({ disciplines: next, dateFrom: localDateFrom, dateTo: localDateTo });
  };

  const clearDisciplines = () => {
    if (readOnly) return;
    onChange({ disciplines: [], dateFrom: localDateFrom, dateTo: localDateTo });
  };

  const handleDateFromChange = (value: string) => {
    const normalized = toIsoDate(value);
    setLocalDateFrom(normalized);
    onChange({ disciplines: selectedDisciplines, dateFrom: normalized, dateTo: localDateTo });
  };

  const handleDateToChange = (value: string) => {
    const normalized = toIsoDate(value);
    setLocalDateTo(normalized);
    onChange({ disciplines: selectedDisciplines, dateFrom: localDateFrom, dateTo: normalized });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-1">
      <div className="flex items-center gap-1.5 text-xs text-white/30 font-mono">
        <Filter size={12} />
        <span>FILTERS</span>
      </div>

      <div className="relative">
        <button
          disabled={readOnly}
          onClick={() => setDisciplineOpen((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-card2 border border-white/10 rounded-xl text-xs text-white/60 hover:border-accent/30 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>
            {selectedDisciplines.length === 0 ? 'All Disciplines' : `${selectedDisciplines.length} selected`}
          </span>
          {selectedDisciplines.length > 0 && (
            <X
              size={11}
              className="text-white/40 hover:text-white"
              onClick={(event) => {
                event.stopPropagation();
                clearDisciplines();
              }}
            />
          )}
          <ChevronDown size={12} className={`transition-transform ${disciplineOpen ? 'rotate-180' : ''}`} />
        </button>

        {disciplineOpen && !readOnly && (
          <div className="absolute top-full mt-1.5 left-0 bg-card2 border border-white/10 rounded-xl overflow-hidden shadow-xl z-20 min-w-[160px]">
            {disciplines.map((discipline) => (
              <button
                key={discipline}
                onClick={() => toggleDiscipline(discipline)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white transition-colors"
              >
                <span
                  className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedDisciplines.includes(discipline) ? 'bg-accent border-accent' : 'border-white/20'
                  }`}
                >
                  {selectedDisciplines.includes(discipline) && (
                    <span className="text-white text-[8px] leading-none">v</span>
                  )}
                </span>
                {discipline}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={localDateFrom}
          min={wideMin}
          max={wideMax}
          readOnly={readOnly}
          onChange={(event) => handleDateFromChange(event.target.value)}
          className="px-2.5 py-1.5 bg-card2 border border-white/10 rounded-xl text-xs text-white/60 outline-none focus:border-accent/30 hover:border-white/20 transition-colors"
        />
        <span className="text-white/20 text-xs">-&gt;</span>
        <input
          type="date"
          value={localDateTo}
          min={wideMin}
          max={wideMax}
          readOnly={readOnly}
          onChange={(event) => handleDateToChange(event.target.value)}
          className="px-2.5 py-1.5 bg-card2 border border-white/10 rounded-xl text-xs text-white/60 outline-none focus:border-accent/30 hover:border-white/20 transition-colors"
        />
      </div>
    </div>
  );
}
