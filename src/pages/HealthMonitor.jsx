import React, { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/LanguageContext'
import { Activity, Loader2, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

const FIELDS = [
  { key: 'blood_pressure_systolic', label: 'Systolic BP', unit: 'mmHg', placeholder: '120' },
  { key: 'blood_pressure_diastolic', label: 'Diastolic BP', unit: 'mmHg', placeholder: '80' },
  { key: 'blood_sugar', label: 'Blood Sugar', unit: 'mg/dL', placeholder: '100' },
  { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm', placeholder: '72' },
  { key: 'oxygen_saturation', label: 'SpO2', unit: '%', placeholder: '98' },
  { key: 'temperature', label: 'Temperature', unit: '°F', placeholder: '98.6' },
  { key: 'weight', label: 'Weight', unit: 'kg', placeholder: '70' },
]

export default function HealthMonitor() {
  const { tr } = useLanguage()
  const qc = useQueryClient()
  const [form, setForm] = useState({})
  const [notes, setNotes] = useState('')
  const [toast, setToast] = useState(null)

  const showToast = (msg, err) => {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3000)
  }

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['health-records'],
    queryFn: async () => {
      const { data, error } = await supabase.from('health_records').select('*').order('recorded_at', { ascending: false }).limit(20)
      if (error) throw error
      return data ?? []
    },
  })

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = { user_id: user.id, notes, recorded_at: new Date().toISOString() }
      FIELDS.forEach(f => { if (form[f.key]) payload[f.key] = parseFloat(form[f.key]) })
      const { error } = await supabase.from('health_records').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      setForm({})
      setNotes('')
      qc.invalidateQueries({ queryKey: ['health-records'] })
      showToast('Vitals saved successfully!')
    },
    onError: (e) => showToast(e.message, true),
  })

  const { mutate: remove } = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('health_records').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-records'] }),
  })

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl p-4 shadow-lg ${toast.err ? 'bg-red-50 border border-red-200' : 'bg-white border border-border'}`}>
          <p className="text-sm">{toast.msg}</p>
        </div>
      )}

      <div>
        <h1 className="font-poppins font-bold text-2xl">{tr('healthMonitor')}</h1>
        <p className="text-muted-foreground text-sm">Log your vitals to track your health over time.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-semibold mb-4">Log Vitals</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs text-muted-foreground mb-1 block">{f.label} ({f.unit})</label>
              <input
                type="number"
                placeholder={f.placeholder}
                value={form[f.key] ?? ''}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ))}
        </div>
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-3 resize-none"
        />
        <button
          onClick={() => save()}
          disabled={isPending}
          className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-60"
        >
          {isPending && <Loader2 size={16} className="animate-spin" />}
          Save Vitals
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-semibold mb-4">History</h2>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
        ) : records.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">No records yet.</p>
        ) : (
          <div className="space-y-3">
            {records.map(r => (
              <div key={r.id} className="border border-border rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-xs text-muted-foreground">{format(new Date(r.recorded_at), 'dd MMM yyyy HH:mm')}</p>
                  <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.blood_pressure_systolic && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">BP: {r.blood_pressure_systolic}/{r.blood_pressure_diastolic}</span>}
                  {r.blood_sugar && <span className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-lg">Sugar: {r.blood_sugar}</span>}
                  {r.heart_rate && <span className="text-xs bg-pink-50 text-pink-700 px-2 py-1 rounded-lg">HR: {r.heart_rate}</span>}
                  {r.oxygen_saturation && <span className="text-xs bg-cyan-50 text-cyan-700 px-2 py-1 rounded-lg">SpO2: {r.oxygen_saturation}%</span>}
                  {r.temperature && <span className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-lg">Temp: {r.temperature}°F</span>}
                  {r.weight && <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">Weight: {r.weight}kg</span>}
                </div>
                {r.notes && <p className="text-xs text-muted-foreground mt-2">{r.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
