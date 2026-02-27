import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { module, disciplines, dateFrom, dateTo, spec } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const timestamp = new Date().toISOString().replace(/[:.]/g,'-')

    // Generate CSV report
    const csvLines = [`ARGUS REPORT — ${module?.toUpperCase()} MODULE`, `Generated: ${new Date().toISOString()}`, `Disciplines: ${disciplines?.length ? disciplines.join(', ') : 'All'}`, `Date Range: ${dateFrom ?? 'N/A'} to ${dateTo ?? 'N/A'}`, ``, `KPIs:`]
    if (spec?.kpis) for (const k of spec.kpis) csvLines.push(`${k.label},${k.value}${k.delta ? `,${k.delta}` : ''}`)
    csvLines.push(``, `Insights:`)
    if (spec?.insights) for (const ins of spec.insights) csvLines.push(ins)
    const csv = csvLines.join('\n')
    const csvPath = `reports/${module}_${timestamp}.csv`
    await supabase.storage.from('reports').upload(csvPath, new Blob([csv], { type:'text/csv' }), { upsert:true })
    const { data: { signedUrl: csvUrl } } = await supabase.storage.from('reports').createSignedUrl(csvPath, 3600)

    return new Response(JSON.stringify({ pdf_url: null, excel_url: csvUrl, csv_url: csvUrl, message: 'CSV report generated. PDF/Excel generation requires additional dependencies — use the CSV export for now.' }), { headers: { ...cors, 'Content-Type':'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status:400, headers: { ...cors, 'Content-Type':'application/json' } })
  }
})
