import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { module, file_path, original_filename } = await req.json()
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from('uploads').download(file_path)
    if (dlErr || !fileData) throw new Error(`File download failed: ${dlErr?.message}`)
    const rows = await parseRows(fileData, original_filename)
    if (!rows.length) throw new Error('File is empty or could not be parsed.')
    await supabaseAdmin.from('uploads').insert({ module, storage_path: file_path, original_name: original_filename })
    const now = new Date().toISOString()
    let spec
    if (module === 'manpower') {
      const norm = rows.map(r => normalizeRow(r, ['date','discipline','planned_headcount','actual_headcount']))
      await supabaseAdmin.from('manpower_records').insert(norm.map(r => ({ date:r.date, discipline:r.discipline, planned_headcount:Number(r.planned_headcount), actual_headcount:Number(r.actual_headcount) })))
      spec = computeManpowerSpec(norm, now)
    } else if (module === 'equipment') {
      const norm = rows.map(r => normalizeRow(r, ['timestamp','discipline','equipment_id','status','hours_idle']))
      await supabaseAdmin.from('equipment_records').insert(norm.map(r => ({ timestamp:r.timestamp, discipline:r.discipline, equipment_id:r.equipment_id, status:r.status, hours_idle:r.hours_idle?Number(r.hours_idle):null })))
      spec = computeEquipmentSpec(norm, now)
    } else if (module === 'progress') {
      const norm = rows.map(r => normalizeRow(r, ['date','discipline','planned_progress_pct','actual_progress_pct']))
      await supabaseAdmin.from('progress_records').insert(norm.map(r => ({ date:r.date, discipline:r.discipline, planned_progress_pct:Number(r.planned_progress_pct), actual_progress_pct:Number(r.actual_progress_pct) })))
      spec = computeProgressSpec(norm, now)
    } else if (module === 'cost') {
      const norm = rows.map(r => normalizeRow(r, ['date','discipline','budget_amount','actual_spend','cost_code']))
      await supabaseAdmin.from('cost_records').insert(norm.map(r => ({
        date: r.date,
        discipline: r.discipline,
        budget_amount: Number(r.budget_amount),
        actual_spend: Number(r.actual_spend),
        cost_code: r.cost_code || null,
      })))
      spec = computeCostSpec(norm, now)
    } else throw new Error(`Unknown module: ${module}`)
    await supabaseAdmin.from('dashboard_specs').upsert({ module, spec_json:spec, meta_json:spec.meta }, { onConflict:'module' })
    return new Response(JSON.stringify({ spec }), { headers: { ...corsHeaders, 'Content-Type':'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status:400, headers: { ...corsHeaders, 'Content-Type':'application/json' } })
  }
})

async function parseRows(fileData: Blob, originalFilename: string): Promise<Record<string,string>[]> {
  const lower = (originalFilename || '').toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const ab = await fileData.arrayBuffer()
    const wb = XLSX.read(ab, { type: 'array' })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return []
    const ws = wb.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
    return json.map((row) => {
      const out: Record<string,string> = {}
      for (const [k, v] of Object.entries(row)) out[String(k)] = String(v ?? '')
      return out
    })
  }
  const text = await fileData.text()
  return parseCSV(text)
}

function parseCSV(text: string) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^["']|["']$/g,''))
  return lines
    .slice(1)
    .filter(l => l.trim())
    .map((line) => {
      const vals = parseCSVLine(line).map(v => v.trim().replace(/^["']|["']$/g,''))
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
    })
}

function parseCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      const next = line[i + 1]
      if (inQuotes && next === '"') { cur += '"'; i++; continue }
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

function normalizeKey(h: string) { return h.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') }

function normalizeRow(row: Record<string,string>, keys: string[]): Record<string,string> {
  const rowNorm: Record<string,string> = {}
  for (const [k,v] of Object.entries(row)) rowNorm[normalizeKey(k)] = v
  const result: Record<string,string> = {}
  for (const key of keys) {
    const match = Object.keys(rowNorm).find(k => k === key || k.replace(/_/g,'').includes(key.replace(/_/g,'').substring(0,6)))
    result[key] = match ? rowNorm[match] : ''
  }
  return result
}

type Spec = { kpis: unknown[]; visuals: unknown[]; insights: string[]; meta: { disciplines: string[]; dateMin: string; dateMax: string }; lastUpdated: string }

function computeManpowerSpec(rows: Record<string,string>[], now: string): Spec {
  const planned = rows.reduce((s,r) => s+Number(r.planned_headcount||0),0)
  const actual = rows.reduce((s,r) => s+Number(r.actual_headcount||0),0)
  const variance = actual - planned
  const variancePct = planned>0 ? ((variance/planned)*100).toFixed(1) : '0.0'
  const disciplines = [...new Set(rows.map(r=>r.discipline).filter(Boolean))]
  const dates = [...new Set(rows.map(r=>r.date).filter(Boolean))].sort()
  const avgP = Math.round(planned/Math.max(dates.length,1))
  const avgA = Math.round(actual/Math.max(dates.length,1))
  const status = Number(variancePct)>=-5?'good':Number(variancePct)>=-15?'warning':'danger'
  const discBreak = disciplines.map(d => {
    const dr = rows.filter(r=>r.discipline===d)
    const p = dr.reduce((s,r)=>s+Number(r.planned_headcount||0),0)/Math.max(dates.length,1)
    const a = dr.reduce((s,r)=>s+Number(r.actual_headcount||0),0)/Math.max(dates.length,1)
    return { discipline:d, planned_headcount:Math.round(p), actual_headcount:Math.round(a), variance:Math.round(a-p), variance_pct:`${p>0?(((a-p)/p)*100).toFixed(1):0}%` }
  })
  const timeline = dates.map(date => { const dr=rows.filter(r=>r.date===date); return { date, planned_headcount:dr.reduce((s,r)=>s+Number(r.planned_headcount||0),0), actual_headcount:dr.reduce((s,r)=>s+Number(r.actual_headcount||0),0) } })
  const worst = [...discBreak].sort((a,b)=>parseFloat(a.variance_pct)-parseFloat(b.variance_pct))[0]
  return {
    kpis: [
      { id:'total_planned', label:'Avg Daily Planned', value:avgP, status:'neutral', subLabel:'Planned headcount/day' },
      { id:'total_actual', label:'Avg Daily Actual', value:avgA, delta:`${variancePct}%`, status, subLabel:'Actual headcount/day' },
      { id:'variance_pct', label:'Overall Variance', value:`${variancePct}%`, delta:`${Math.abs(variance)} workers`, status, subLabel:'Planned vs actual' },
      { id:'discipline_count', label:'Disciplines', value:disciplines.length, status:'neutral', subLabel:'Reporting data' },
    ],
    visuals: [
      { id:'timeline', type:'line', title:'Planned vs Actual Over Time', xKey:'date', series:[{key:'planned_headcount',name:'Planned',color:'#4B9EFF'},{key:'actual_headcount',name:'Actual',color:'#FF6A00'}], data:timeline },
      { id:'discipline_bar', type:'bar', title:'Headcount by Discipline', xKey:'discipline', series:[{key:'planned_headcount',name:'Planned',color:'#4B9EFF'},{key:'actual_headcount',name:'Actual',color:'#FF6A00'}], data:discBreak },
      { id:'detail_table', type:'table', title:'Discipline Detail', columns:[{key:'discipline',label:'Discipline'},{key:'planned_headcount',label:'Planned'},{key:'actual_headcount',label:'Actual'},{key:'variance',label:'Variance'},{key:'variance_pct',label:'Variance %'}], data:discBreak },
    ],
    insights: [
      `Overall workforce is ${variancePct}% ${Number(variancePct)<0?'below':'above'} plan across ${disciplines.length} disciplines.`,
      worst?`${worst.discipline} is most understaffed at ${worst.variance_pct} vs planned.`:'',
      `Data spans ${dates.length} day(s) from ${dates[0]??'N/A'} to ${dates[dates.length-1]??'N/A'}.`,
    ].filter(Boolean) as string[],
    meta: { disciplines, dateMin:dates[0]??'', dateMax:dates[dates.length-1]??'' },
    lastUpdated: now,
  }
}

function computeEquipmentSpec(rows: Record<string,string>[], now: string): Spec {
  const active = rows.filter(r=>r.status?.toLowerCase()==='active').length
  const idle = rows.filter(r=>r.status?.toLowerCase()==='idle').length
  const breakdown = rows.filter(r=>r.status?.toLowerCase()==='breakdown').length
  const total = rows.length
  const utilPct = total>0?((active/total)*100).toFixed(1):'0.0'
  const disciplines = [...new Set(rows.map(r=>r.discipline).filter(Boolean))]
  const timestamps = [...new Set(rows.map(r=>r.timestamp).filter(Boolean))].sort()
  const discBreak = disciplines.map(d => { const dr=rows.filter(r=>r.discipline===d); return { discipline:d, Active:dr.filter(r=>r.status?.toLowerCase()==='active').length, Idle:dr.filter(r=>r.status?.toLowerCase()==='idle').length, Breakdown:dr.filter(r=>r.status?.toLowerCase()==='breakdown').length } })
  const tableData = rows.slice(0,50).map(r => ({ equipment_id:r.equipment_id, discipline:r.discipline, status:r.status?r.status.charAt(0).toUpperCase()+r.status.slice(1).toLowerCase():'', hours_idle:r.hours_idle||'0' }))
  const status = Number(utilPct)>=70?'good':Number(utilPct)>=55?'warning':'danger'
  const worst = [...discBreak].sort((a,b)=>b.Breakdown-a.Breakdown)[0]
  return {
    kpis: [
      { id:'active_count', label:'Active Equipment', value:active, status:'good', subLabel:'Currently operating' },
      { id:'idle_count', label:'Idle Equipment', value:idle, status:idle>total*0.3?'warning':'neutral', subLabel:'Standing by' },
      { id:'breakdown_count', label:'Breakdown', value:breakdown, status:breakdown>0?'danger':'good', subLabel:'Out of service' },
      { id:'utilization_pct', label:'Utilization Rate', value:`${utilPct}%`, status, subLabel:'Of total fleet' },
    ],
    visuals: [
      { id:'status_bar', type:'stackedBar', title:'Equipment Status by Discipline', xKey:'discipline', series:[{key:'Active',name:'Active',color:'#22c55e'},{key:'Idle',name:'Idle',color:'#eab308'},{key:'Breakdown',name:'Breakdown',color:'#ef4444'}], data:discBreak },
      { id:'eq_table', type:'table', title:'Equipment Detail', columns:[{key:'equipment_id',label:'Equipment ID'},{key:'discipline',label:'Discipline'},{key:'status',label:'Status'},{key:'hours_idle',label:'Idle Hours'}], data:tableData },
    ],
    insights: [
      `Fleet utilization is ${utilPct}% (${active} active, ${idle} idle, ${breakdown} breakdown).`,
      breakdown>0?`${breakdown} unit(s) in breakdown status require immediate attention.`:'No breakdown equipment — fleet health is good.',
      worst?`${worst.discipline} has the most breakdown units (${worst.Breakdown}).`:'',
    ].filter(Boolean) as string[],
    meta: { disciplines, dateMin:timestamps[0]??'', dateMax:timestamps[timestamps.length-1]??'' },
    lastUpdated: now,
  }
}

function computeProgressSpec(rows: Record<string,string>[], now: string): Spec {
  const totalPlanned = rows.reduce((s,r)=>s+Number(r.planned_progress_pct||0),0)/Math.max(rows.length,1)
  const totalActual = rows.reduce((s,r)=>s+Number(r.actual_progress_pct||0),0)/Math.max(rows.length,1)
  const slippage = totalActual - totalPlanned
  const disciplines = [...new Set(rows.map(r=>r.discipline).filter(Boolean))]
  const dates = [...new Set(rows.map(r=>r.date).filter(Boolean))].sort()
  const discBreak = disciplines.map(d => {
    const dr=rows.filter(r=>r.discipline===d)
    const p=dr.reduce((s,r)=>s+Number(r.planned_progress_pct||0),0)/Math.max(dr.length,1)
    const a=dr.reduce((s,r)=>s+Number(r.actual_progress_pct||0),0)/Math.max(dr.length,1)
    const slip=a-p
    return { discipline:d, planned_progress_pct:`${p.toFixed(1)}%`, actual_progress_pct:`${a.toFixed(1)}%`, slippage:`${slip>=0?'+':''}${slip.toFixed(1)}%`, status:slip>=0?(slip>2?'Ahead':'On Track'):(slip>-5?'Minor Delay':'Behind') }
  })
  const chartDisc = disciplines.map(d => { const dr=rows.filter(r=>r.discipline===d); return { discipline:d, planned_progress_pct:dr.reduce((s,r)=>s+Number(r.planned_progress_pct||0),0)/Math.max(dr.length,1), actual_progress_pct:dr.reduce((s,r)=>s+Number(r.actual_progress_pct||0),0)/Math.max(dr.length,1) } })
  const timeline = dates.map(date => { const dr=rows.filter(r=>r.date===date); return { date, planned_progress_pct:dr.reduce((s,r)=>s+Number(r.planned_progress_pct||0),0)/Math.max(dr.length,1), actual_progress_pct:dr.reduce((s,r)=>s+Number(r.actual_progress_pct||0),0)/Math.max(dr.length,1) } })
  const onTrack=discBreak.filter(d=>d.status==='On Track'||d.status==='Ahead').length
  const slipStatus=slippage>=0?'good':slippage>=-5?'warning':'danger'
  const worst=[...discBreak].sort((a,b)=>parseFloat(a.slippage)-parseFloat(b.slippage))[0]
  const best=[...discBreak].sort((a,b)=>parseFloat(b.slippage)-parseFloat(a.slippage))[0]
  return {
    kpis: [
      { id:'planned_avg', label:'Planned Progress', value:`${totalPlanned.toFixed(1)}%`, status:'neutral', subLabel:'Schedule target' },
      { id:'actual_avg', label:'Actual Progress', value:`${totalActual.toFixed(1)}%`, delta:`${slippage>=0?'+':''}${slippage.toFixed(1)}% vs plan`, status:slipStatus, subLabel:'Current completion' },
      { id:'slippage_pct', label:'Schedule Slippage', value:`${slippage>=0?'+':''}${slippage.toFixed(1)}%`, status:slipStatus, subLabel:'vs planned schedule' },
      { id:'on_track', label:'On Track', value:`${onTrack}/${disciplines.length}`, status:onTrack===disciplines.length?'good':onTrack>=disciplines.length/2?'warning':'danger', subLabel:'Disciplines meeting schedule' },
    ],
    visuals: [
      { id:'timeline', type:'line', title:'Planned vs Actual Progress Over Time', xKey:'date', series:[{key:'planned_progress_pct',name:'Planned %',color:'#4B9EFF'},{key:'actual_progress_pct',name:'Actual %',color:'#FF6A00'}], data:timeline },
      { id:'disc_progress', type:'bar', title:'Progress by Discipline', xKey:'discipline', series:[{key:'planned_progress_pct',name:'Planned %',color:'#4B9EFF'},{key:'actual_progress_pct',name:'Actual %',color:'#FF6A00'}], data:chartDisc },
      { id:'progress_table', type:'table', title:'Progress Detail by Discipline', columns:[{key:'discipline',label:'Discipline'},{key:'planned_progress_pct',label:'Planned %'},{key:'actual_progress_pct',label:'Actual %'},{key:'slippage',label:'Slippage'},{key:'status',label:'Status'}], data:discBreak },
    ],
    insights: [
      `Overall progress is ${Math.abs(slippage).toFixed(1)}% ${slippage<0?'behind':'ahead of'} schedule.`,
      worst?`${worst.discipline} has the worst slippage at ${worst.slippage} — prioritize resources.`:'',
      best?`${best.discipline} is performing best at ${best.slippage} vs plan.`:'',
      `${onTrack} of ${disciplines.length} disciplines are meeting schedule targets.`,
    ].filter(Boolean) as string[],
    meta: { disciplines, dateMin:dates[0]??'', dateMax:dates[dates.length-1]??'' },
    lastUpdated: now,
  }
}

function computeCostSpec(rows: Record<string,string>[], now: string): Spec {
  const totalBudget = rows.reduce((s,r)=>s+Number(r.budget_amount||0),0)
  const totalSpent = rows.reduce((s,r)=>s+Number(r.actual_spend||0),0)
  const variance = totalBudget - totalSpent
  const variancePct = totalBudget>0 ? ((variance/totalBudget)*100).toFixed(1) : '0.0'
  const disciplines = [...new Set(rows.map(r=>r.discipline).filter(Boolean))]
  const dates = [...new Set(rows.map(r=>r.date).filter(Boolean))].sort()

  const status = variance >= 0 ? 'good' : Number(variancePct) >= -5 ? 'warning' : 'danger'

  const byDiscipline = disciplines.map(d => {
    const dr = rows.filter(r=>r.discipline===d)
    const b = dr.reduce((s,r)=>s+Number(r.budget_amount||0),0)
    const a = dr.reduce((s,r)=>s+Number(r.actual_spend||0),0)
    const v = b - a
    const vp = b>0 ? ((v/b)*100).toFixed(1) : '0.0'
    return { discipline:d, budget_amount:b, actual_spend:a, variance:v, variance_pct:`${vp}%` }
  })

  const timeline = dates.map(date => {
    const dr = rows.filter(r=>r.date===date)
    const b = dr.reduce((s,r)=>s+Number(r.budget_amount||0),0)
    const a = dr.reduce((s,r)=>s+Number(r.actual_spend||0),0)
    return { date, budget_amount:b, actual_spend:a, variance:b-a }
  })

  const worst = [...byDiscipline].sort((a,b)=>a.variance-b.variance)[0]

  return {
    kpis: [
      { id:'total_budget', label:'Total Budget', value: totalBudget.toFixed(0), status:'neutral', subLabel:'Sum of uploaded budget' },
      { id:'total_spent', label:'Total Spent', value: totalSpent.toFixed(0), status: totalSpent>totalBudget?'warning':'neutral', subLabel:'Actual spend to date' },
      { id:'cost_variance', label:'Cost Variance', value: variance.toFixed(0), delta: `${variancePct}%`, status, subLabel:'Budget minus spend' },
      { id:'discipline_count', label:'Disciplines', value: disciplines.length, status:'neutral', subLabel:'Reporting data' },
    ],
    visuals: [
      { id:'timeline', type:'line', title:'Budget vs Spend Over Time', xKey:'date', series:[{key:'budget_amount',name:'Budget',color:'#4B9EFF'},{key:'actual_spend',name:'Spend',color:'#FF6A00'}], data:timeline },
      { id:'discipline_bar', type:'bar', title:'Budget vs Spend by Discipline', xKey:'discipline', series:[{key:'budget_amount',name:'Budget',color:'#4B9EFF'},{key:'actual_spend',name:'Spend',color:'#FF6A00'}], data:byDiscipline },
      { id:'cost_table', type:'table', title:'Cost Detail by Discipline', columns:[{key:'discipline',label:'Discipline'},{key:'budget_amount',label:'Budget'},{key:'actual_spend',label:'Spend'},{key:'variance',label:'Variance'},{key:'variance_pct',label:'Variance %'}], data:byDiscipline },
    ],
    insights: [
      `Total spend is ${variance >= 0 ? 'within' : 'over'} budget by ${Math.abs(variance).toFixed(0)} (${Math.abs(Number(variancePct)).toFixed(1)}%).`,
      worst ? `${worst.discipline} shows the worst variance at ${worst.variance_pct}.` : '',
      `Data spans ${dates.length} day(s) from ${dates[0]??'N/A'} to ${dates[dates.length-1]??'N/A'}.`,
    ].filter(Boolean) as string[],
    meta: { disciplines, dateMin: dates[0]??'', dateMax: dates[dates.length-1]??'' },
    lastUpdated: now,
  }
}
