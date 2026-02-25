import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react'
import { Module, UploadState, DashboardSpec } from '../../types'
import { supabase, STORAGE_BUCKET } from '../../lib/supabase'

interface Props {
  module: Module
  onSpecLoaded: (spec: DashboardSpec) => void
}

const moduleLabels: Record<Module, string> = {
  manpower: 'Manpower',
  equipment: 'Equipment',
  progress: 'Work Progress',
  cost: 'Cost',
}

const requiredColumns: Record<Module, string[]> = {
  manpower: ['date', 'discipline', 'planned_headcount', 'actual_headcount'],
  equipment: ['timestamp', 'discipline', 'equipment_id', 'status'],
  progress: ['date', 'discipline', 'planned_progress_pct', 'actual_progress_pct'],
  cost: ['date', 'discipline', 'budget_amount', 'actual_spend'],
}

export default function UploadZone({ module, onSpecLoaded }: Props) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setState({ status: 'error', error: 'File exceeds 5MB limit.' })
      return
    }
    setState({ status: 'uploading', fileName: file.name })
    try {
      const timestamp = Date.now()
      const filePath = `${module}/${timestamp}_${file.name}`
      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file, { upsert: false })
      if (uploadError) throw new Error(uploadError.message)
      setState({ status: 'processing', fileName: file.name })
      const { data, error: fnError } = await supabase.functions.invoke('process-upload', {
        body: { module, file_path: filePath, original_filename: file.name },
      })
      if (fnError) throw new Error(fnError.message)
      if (!data?.spec) throw new Error('No spec returned from server.')
      setState({ status: 'done', fileName: file.name })
      onSpecLoaded(data.spec)
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : 'Upload failed. Please try again.' })
    }
  }, [module, onSpecLoaded])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]; if (file) processFile(file)
  }, [processFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) processFile(file)
  }

  const reset = () => setState({ status: 'idle' })

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 mb-4">
          <FileText size={24} className="text-accent" />
        </div>
        <h2 className="text-xl font-display font-semibold text-white mb-2">No {moduleLabels[module]} Data</h2>
        <p className="text-sm text-white/40 max-w-sm mx-auto">Upload a CSV or XLSX file to generate your dashboard. Required columns:</p>
        <div className="flex flex-wrap gap-1.5 justify-center mt-3">
          {requiredColumns[module].map(col => (
            <span key={col} className="px-2 py-0.5 rounded-md bg-white/5 text-white/40 text-xs font-mono border border-white/8">{col}</span>
          ))}
        </div>
      </div>
      {state.status === 'idle' || state.status === 'error' ? (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
            isDragging ? 'border-accent bg-accent/8' : 'border-white/12 hover:border-accent/40 hover:bg-white/2'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
          <Upload size={28} className={`mx-auto mb-3 ${isDragging ? 'text-accent' : 'text-white/30'}`} />
          <p className="text-sm font-medium text-white/60 mb-1">Drop your file here or <span className="text-accent">browse</span></p>
          <p className="text-xs text-white/25">CSV or XLSX · Max 5MB</p>
          {state.status === 'error' && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-red-400 text-xs w-max max-w-xs">
              <AlertCircle size={14} /><span>{state.error}</span>
              <button onClick={(e) => { e.stopPropagation(); reset() }}><X size={12} /></button>
            </div>
          )}
        </div>
      ) : state.status === 'uploading' || state.status === 'processing' ? (
        <div className="border border-white/8 rounded-2xl p-8 text-center bg-card">
          <Loader2 size={48} className="text-accent animate-spin mx-auto mb-4" strokeWidth={1} />
          <p className="text-sm font-medium text-white/70 mb-1">{state.status === 'uploading' ? 'Uploading file…' : 'Processing data…'}</p>
          <p className="text-xs text-white/30 font-mono truncate max-w-xs mx-auto">{state.fileName}</p>
        </div>
      ) : (
        <div className="border border-green-500/20 rounded-2xl p-8 text-center bg-green-500/5">
          <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-green-400 mb-1">Dashboard ready</p>
          <p className="text-xs text-white/30 font-mono">{state.fileName}</p>
        </div>
      )}
    </div>
  )
}
