import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Bot, Send, Loader2, User } from 'lucide-react'

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your AI health assistant. I can help answer general health questions. Please note I\'m not a substitute for professional medical advice. How can I help you today?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    setMessages(p => [...p, userMsg])
    setInput('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: [...messages, userMsg] },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (error) throw error
      setMessages(p => [...p, { role: 'assistant', content: data?.reply ?? 'Sorry, I could not process that.' }])
    } catch {
      setMessages(p => [...p, { role: 'assistant', content: 'Sorry, I\'m having trouble connecting right now. Please try again later.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen max-w-3xl mx-auto">
      <div className="p-4 md:p-6 border-b border-border">
        <h1 className="font-poppins font-bold text-2xl">AI Assistant</h1>
        <p className="text-muted-foreground text-sm">Ask health questions — not a substitute for medical advice.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-primary' : 'bg-muted'}`}>
              {m.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-muted-foreground" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.role === 'user' ? 'bg-primary text-white rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Bot size={16} className="text-muted-foreground" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask a health question..."
            className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button onClick={send} disabled={!input.trim() || loading} className="bg-primary text-white px-4 py-2.5 rounded-xl disabled:opacity-60">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
