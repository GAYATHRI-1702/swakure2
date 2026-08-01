import React, { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/LanguageContext'
import { Calendar, Plus, Loader2, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

export default function Appointments() {
  const { tr } = useLanguage()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ doctor_name: '', specialty: '', appointment_date: '', appointment_time: '10:00', appointment_type: 'clinic', reason: '' })

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('appointments').select('*').order('appointment_date')
      if (error) throw error
      return data ?? []
    },
  })

  const { mutate: create, isPending } = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('appointments').insert({ ...form, user_id: user.id, status: 'pending' })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments'] }); setShowForm(false); setForm({ doctor_name: '', specialty: '', appointment_date: '', appointment_time: '10:00', appointment_type: 'clinic', reason: '' }) },
  })

  const { mutate: cancel } = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  })

  const statusColor = (s) => ({ pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-green-100 text-green-700', completed: 'bg-blue-100 text-blue-700', cancelled: 'bg-red-100 text-red-700' }[s] ?? 'bg-secondary text-secondary-foreground')

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-poppins font-bold text-2xl">{tr('appointments')}</h1>
          <p className="text-muted-foreground text-sm">Manage your doctor appointments.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
          <Plus size={16} /> Book
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Doctor name" value={form.doctor_name} onChange={e => setForm(p => ({ ...p, doctor_name: e.target.value }))} className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input placeholder="Specialty" value={form.specialty} onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))} className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.appointment_date} onChange={e => setForm(p => ({ ...p, appointment_date: e.target.value }))} className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input type="time" value={form.appointment_time} onChange={e => setForm(p => ({ ...p, appointment_time: e.target.value }))} className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <select value={form.appointment_type} onChange={e => setForm(p => ({ ...p, appointment_type: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="clinic">Clinic Visit</option>
            <option value="home_visit">Home Visit</option>
            <option value="video">Video Call</option>
          </select>
          <input placeholder="Reason (optional)" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <div className="flex gap-2">
            <button onClick={() => create()} disabled={isPending || !form.doctor_name || !form.appointment_date} className="bg-primary text-white px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-60">
              {isPending && <Loader2 size={14} className="animate-spin" />} Book
            </button>
            <button onClick={() => setShowForm(false)} className="border border-border px-5 py-2 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p>No appointments yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map(a => (
            <div key={a.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{a.doctor_name}</p>
                  <p className="text-sm text-muted-foreground">{a.specialty}</p>
                  <p className="text-sm text-muted-foreground mt-1">{format(new Date(a.appointment_date), 'dd MMM yyyy')} · {a.appointment_time} · {a.appointment_type}</p>
                  {a.reason && <p className="text-xs text-muted-foreground mt-1">{a.reason}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(a.status)}`}>{a.status}</span>
                  {a.status === 'pending' && (
                    <button onClick={() => cancel(a.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
