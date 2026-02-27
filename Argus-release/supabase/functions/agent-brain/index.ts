const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { module, question, dashboardSpec } = await req.json()
    if (!dashboardSpec) return new Response(JSON.stringify({ message: 'No data loaded. Please upload a file to activate the agent.' }), { headers: { ...cors, 'Content-Type':'application/json' } })
    const spec = dashboardSpec
    const q = question.toLowerCase()
    let message = ''
    let render_instructions: Record<string,unknown> | undefined

    if (q.includes('summary') || q.includes('summarize') || q.includes('overview')) {
      const kpiSummary = spec.kpis.map((k: {label:string;value:string;delta?:string}) => `• ${k.label}: ${k.value}${k.delta ? ` (${k.delta})` : ''}`).join('\n')
      const insightSummary = spec.insights.slice(0,2).map((s: string,i: number) => `${i+1}. ${s}`).join('\n')
      message = `**${module?.toUpperCase() ?? 'SITE'} STATUS SUMMARY**\n\n${kpiSummary}\n\n**Key Findings:**\n${insightSummary}`
    } else if (q.includes('manpower') || q.includes('headcount') || q.includes('worker')) {
      const k = spec.kpis.find((k: {id:string}) => k.id.includes('actual') || k.id.includes('headcount'))
      if (k) { message = `**${k.label}** is currently **${k.value}**${k.delta ? ` (${k.delta})` : ''}.`; render_instructions = { highlightKpiId: k.id } }
      else message = spec.insights[0] || 'No manpower data found.'
    } else if (q.includes('equipment') || q.includes('idle') || q.includes('breakdown') || q.includes('fleet')) {
      const idle = spec.kpis.find((k: {id:string}) => k.id.includes('idle'))
      const brk = spec.kpis.find((k: {id:string}) => k.id.includes('breakdown'))
      const util = spec.kpis.find((k: {id:string}) => k.id.includes('util'))
      const parts = [idle && `Idle: **${idle.value}** units`, brk && `Breakdown: **${brk.value}** units`, util && `Utilization: **${util.value}**`].filter(Boolean)
      message = `Equipment fleet — ${parts.join(', ')}.\n\n${spec.insights[0]||''}`
    } else if (q.includes('progress') || q.includes('behind') || q.includes('ahead') || q.includes('schedule') || q.includes('slippage')) {
      const slip = spec.kpis.find((k: {id:string}) => k.id.includes('slippage'))
      const actual = spec.kpis.find((k: {id:string}) => k.id.includes('actual'))
      message = [actual && `Actual progress: **${actual.value}**`, slip && `Schedule slippage: **${slip.value}**`, spec.insights[0]].filter(Boolean).join('\n')
    } else if (q.includes('discipline')) {
      message = `Active disciplines: **${spec.meta.disciplines.join(', ')}**.\nDate range: ${spec.meta.dateMin} → ${spec.meta.dateMax}.`
    } else if (q.includes('insight') || q.includes('problem') || q.includes('issue')) {
      message = `**Current issues:**\n\n${spec.insights.map((s: string,i: number) => `${i+1}. ${s}`).join('\n')}`
    } else if (q.includes('export') || q.includes('report') || q.includes('download')) {
      message = 'Use the **Export Report** button in the top-right of the dashboard to download a PDF or Excel report.'
    } else {
      const k = spec.kpis[0]
      message = k ? `**${k.label}**: ${k.value}${k.delta ? ` (${k.delta})` : ''}.\n\nTry asking: "summarize", "what\'s behind schedule?", "show discipline breakdown", or "what equipment is idle?".` : 'No data available for this query.'
    }

    return new Response(JSON.stringify({ message, render_instructions }), { headers: { ...cors, 'Content-Type':'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status:400, headers: { ...cors, 'Content-Type':'application/json' } })
  }
})
