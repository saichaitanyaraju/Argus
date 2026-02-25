import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { module } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data, error } = await supabase.from('dashboard_specs').select('spec_json, meta_json, created_at').eq('module', module).order('created_at', { ascending:false }).limit(1).single()
    if (error || !data) return new Response(JSON.stringify({ spec: null }), { headers: { ...cors, 'Content-Type':'application/json' } })
    return new Response(JSON.stringify({ spec: data.spec_json }), { headers: { ...cors, 'Content-Type':'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status:400, headers: { ...cors, 'Content-Type':'application/json' } })
  }
})
