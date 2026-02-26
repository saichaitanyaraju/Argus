import { useState, useRef, useEffect } from 'react'
import { Send, Mic, MicOff, Bot, User, X, MessageSquare, Loader2 } from 'lucide-react'
import { ChatMessage, Module, DashboardSpec, AgentOutput } from '../../types'
import { supabase } from '../../lib/supabase'

interface Props {
  module?: Module
  spec?: DashboardSpec
  onHighlightKpi?: (id: string) => void
  isOpen: boolean
  onClose: () => void
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hi! I\'m the Argus intelligence agent. Ask me about manpower, equipment, progress, or cost — or request a summary.',
  timestamp: new Date(),
}

function deterministic_agent(question: string, spec?: DashboardSpec, module?: Module): AgentOutput {
  if (!spec) return { message: 'No data loaded yet. Please upload a file or load demo data first.' }
  const q = question.toLowerCase()

  if (q.includes('summary') || q.includes('summarize') || q.includes('overview')) {
    const kpiSummary = spec.kpis.map(k => `${k.label}: ${k.value}${k.delta ? ` (${k.delta})` : ''}`).join('\n')
    return { message: `**Current Status Summary:**\n\n${kpiSummary}\n\n**Key Insights:**\n${spec.insights.slice(0, 2).join('\n')}` }
  }
  if (q.includes('cost') || q.includes('budget') || q.includes('spend') || q.includes('financial') || q.includes('forecast') || q.includes('over budget')) {
    if (module === 'cost') {
      const budget = spec.kpis.find(k => k.id.includes('budget'))
      const spent = spec.kpis.find(k => k.id.includes('spent'))
      const variance = spec.kpis.find(k => k.id.includes('variance'))
      return { message: `Budget: **${budget?.value}** · Spent to date: **${spent?.value}**\nCost variance: **${variance?.value}**\n\n${spec.insights[0]}` }
    }
    return { message: 'Switch to the **Cost** tab for budget and spend analysis.' }
  }
  if (q.includes('manpower') || q.includes('headcount') || q.includes('worker') || q.includes('crew')) {
    const kpi = spec.kpis.find(k => k.id.includes('actual') || k.id.includes('headcount'))
    if (kpi) return { message: `**${kpi.label}** is currently **${kpi.value}**${kpi.delta ? ` (${kpi.delta})` : ''}.`, render_instructions: { highlightKpiId: kpi.id } }
  }
  if (q.includes('equipment') || q.includes('idle') || q.includes('breakdown') || q.includes('fleet')) {
    const idleKpi = spec.kpis.find(k => k.id.includes('idle'))
    const breakdownKpi = spec.kpis.find(k => k.id.includes('breakdown'))
    if (idleKpi || breakdownKpi) {
      const parts = [idleKpi && `Idle: **${idleKpi.value}** units`, breakdownKpi && `Breakdown: **${breakdownKpi.value}** units`].filter(Boolean)
      return { message: `Equipment status — ${parts.join(', ')}.\n\n${spec.insights[0] || ''}` }
    }
  }
  if (q.includes('progress') || q.includes('behind') || q.includes('ahead') || q.includes('schedule') || q.includes('slippage')) {
    const slippage = spec.kpis.find(k => k.id.includes('slippage'))
    const actual = spec.kpis.find(k => k.id.includes('actual'))
    const msg = [actual && `Actual progress: **${actual.value}**`, slippage && `Schedule slippage: **${slippage.value}**`, spec.insights[0]].filter(Boolean).join('\n')
    return { message: msg }
  }
  if (q.includes('discipline')) {
    return { message: `Active disciplines: **${spec.meta.disciplines.join(', ')}**.\nDate range: ${spec.meta.dateMin} → ${spec.meta.dateMax}.` }
  }
  if (q.includes('insight') || q.includes('problem') || q.includes('issue')) {
    return { message: `**Current Issues:**\n\n${spec.insights.map((s, i) => `${i + 1}. ${s}`).join('\n')}` }
  }
  if (q.includes('export') || q.includes('report') || q.includes('download')) {
    return { message: 'Use the **Export Report** button in the top-right of the dashboard to download a PDF or CSV report.' }
  }
  const k = spec.kpis[0]
  return { message: k ? `**${k.label}**: ${k.value}${k.delta ? ` (${k.delta})` : ''}.\n\nTry: "summarize", "what\'s the cost variance?", "show discipline breakdown".` : 'No data available.' }
}

export default function ChatPanel({ module, spec, onHighlightKpi, isOpen, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    try {
      let response: AgentOutput
      try {
        const { data, error } = await supabase.functions.invoke('agent-brain', { body: { module, question: text, dashboardSpec: spec } })
        if (error || !data?.message) throw new Error('fallback')
        response = data
      } catch {
        response = deterministic_agent(text, spec, module)
      }
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(), role: 'assistant', content: response.message, timestamp: new Date(),
        renderInstructions: response.render_instructions,
      }
      setMessages(prev => [...prev, assistantMsg])
      if (response.render_instructions?.highlightKpiId) onHighlightKpi?.(response.render_instructions.highlightKpiId)
    } finally { setIsLoading(false) }
  }

<<<<<<< HEAD
  const renderContent = (content: string) =>
    content.split('\n').map((line, i) => {
      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
      return <p key={i} className="text-sm leading-relaxed text-white/70" dangerouslySetInnerHTML={{ __html: bold }} />
    })
=======
  const renderBoldLine = (line: string) => {
    // Simple, safe **bold** rendering without injecting HTML.
    const parts = line.split('**')
    return parts.map((part, idx) => {
      const isBold = idx % 2 === 1
      return isBold ? (
        <strong key={idx} className="text-white">{part}</strong>
      ) : (
        <span key={idx}>{part}</span>
      )
    })
  }

  const renderContent = (content: string) =>
    content.split('\n').map((line, i) => (
      <p key={i} className="text-sm leading-relaxed text-white/70">
        {renderBoldLine(line)}
      </p>
    ))
>>>>>>> 89c15af (Fix: cost module, xlsx upload, security + deploy fixes)

  if (!isOpen) return null

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[560px] bg-card border border-white/10 rounded-3xl shadow-2xl flex flex-col z-50 animate-slide-up overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-card2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Bot size={14} className="text-accent" />
          </div>
          <div>
            <p className="text-sm font-display font-semibold text-white">Argus Agent</p>
            <p className="text-xs text-white/30 font-mono">deterministic mode</p>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-white/8 flex items-center justify-center text-white/40 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${msg.role === 'assistant' ? 'bg-accent/10 border border-accent/20' : 'bg-white/8'}`}>
              {msg.role === 'assistant' ? <Bot size={12} className="text-accent" /> : <User size={12} className="text-white/50" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 space-y-1 ${msg.role === 'user' ? 'bg-accent/15 border border-accent/20' : 'bg-card2 border border-white/6'}`}>
              {renderContent(msg.content)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2.5 items-center">
            <div className="w-6 h-6 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Bot size={12} className="text-accent" />
            </div>
            <div className="bg-card2 border border-white/6 rounded-2xl px-3.5 py-2.5">
              <Loader2 size={14} className="text-accent animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {['Give me a summary', 'What\'s behind schedule?', 'Show cost variance', 'Equipment status'].map(p => (
            <button key={p} onClick={() => sendMessage(p)}
              className="px-2.5 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/8 text-white/50 hover:text-white border border-white/8 transition-colors">
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-white/8 bg-card2">
        <div className="flex items-center gap-2 bg-bg border border-white/10 rounded-2xl px-3.5 py-2">
          <input
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
            placeholder="Ask about the site data…"
            className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/20 outline-none"
          />
          <button onClick={() => setIsVoiceActive(p => !p)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isVoiceActive ? 'bg-accent text-white' : 'text-white/30 hover:text-white hover:bg-white/8'}`}>
            {isVoiceActive ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
            className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white disabled:opacity-30 hover:bg-accent-light transition-colors">
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function ChatButton({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  return (
    <button onClick={onClick}
      className={`fixed bottom-6 right-6 w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center transition-all duration-200 z-40 ${isOpen ? 'bg-white/10 border border-white/20' : 'bg-accent hover:bg-accent-light accent-glow'}`}>
      {isOpen ? <X size={20} className="text-white/60" /> : <MessageSquare size={20} className="text-white" />}
    </button>
  )
}
