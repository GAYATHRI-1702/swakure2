import React, { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/LanguageContext'
import { Bell, Plus, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'

const TYPES = ['medication', 'checkup', 'exercise', 'diet', 'appointment', 'custom']
const FREQS = ['daily', 'weekly', 'monthly', 'once']

export default function Reminders() {
  const { tr } = useLanguage()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', reminder_type: 'medication', time: '08:00', frequency: 'daily' })

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('reminders').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { mutate: create, isPending } = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('reminders').insert({ ...form, user_id: user.id, is_active: true })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); setShowForm(false); setForm({ title: '', description: '', reminder_type: 'medication', time: '08:00', frequency: 'daily' }) },
  })

  const { mutate: toggle } = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('reminders').update({ is_active: !is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  })

  const { mutate: remove } = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('reminders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  })

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-poppins font-bold text-2xl">{tr('reminders')}</h1>
          <p className="text-muted-foreground text-sm">Manage your health reminders.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
          <Plus size={16} /> Add
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <input placeholder="Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <input placeholder="Description (optional)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.reminder_type} onChange={e => setForm(p => ({ ...p, reminder_type: e.target.value }))} className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))} className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              {FREQS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <div className="flex gap-2">
            <button onClick={() => create()} disabled={isPending || !form.title} className="bg-primary text-white px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-60">
              {isPending && <Loader2 size={14} className="animate-spin" />} Save
            </button>
            <button onClick={() => setShowForm(false)} className="border border-border px-5 py-2 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          <p>No reminders yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map(r => (
            <div key={r.id} className={`bg-card border rounded-2xl p-4 flex items-center gap-3 ${r.is_active ? 'border-border' : 'border-border opacity-60'}`}>
              <Bell size={18} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.time} · {r.frequency} · {r.reminder_type}</p>
                {r.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words" title={r.description}>{r.description}</p>}
              </div>
              <button onClick={() => toggle({ id: r.id, is_active: r.is_active })} className="text-primary">
                {r.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} className="text-muted-foreground" />}
              </button>
              <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
