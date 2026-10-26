import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/LanguageContext'
import { useAuth } from '@/lib/AuthContext'
import { DOCTORS, findDoctor } from '@/lib/doctors'
import { validateAppointment, buildAppointmentRow, describeSupabaseError, parseLocalDate, todayLocal } from '@/lib/appointments'
import { Calendar, Plus, Loader2, Trash2, AlertCircle, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'

const EMPTY_FORM = { doctor_name: '', specialty: '', appointment_date: '', appointment_time: '10:00', appointment_type: 'clinic', reason: '' }

const formatDate = (value) => {
  const d = parseLocalDate(value)
  return d ? format(d, 'dd MMM yyyy') : (value ?? '')
}

export default function Appointments() {
  const { tr } = useLanguage()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [notice, setNotice] = useState(null) // { type: 'error' | 'success', text }
  const [cancellingId, setCancellingId] = useState(null)

  // Pre-fill the form when arriving from the Doctors page (/appointments?doctor=...)
  useEffect(() => {
    const doctor = findDoctor(searchParams.get('doctor'))
    if (doctor) {
      setForm(p => ({ ...p, doctor_name: doctor.name, specialty: doctor.specialty }))
      setShowForm(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const { data: appointments = [], isLoading, error: loadError } = useQuery({
    queryKey: ['appointments', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', user.id)
        .order('appointment_date')
        .order('appointment_time')
      if (error) throw error
      return data ?? []
    },
  })

  const refreshLists = () => {
    qc.invalidateQueries({ queryKey: ['appointments'] })
    qc.invalidateQueries({ queryKey: ['upcoming-appointments'] })
  }

  const { mutate: create, isPending } = useMutation({
    mutationFn: async () => {
      const problem = validateAppointment(form)
      if (problem) throw new Error(problem)
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) throw new Error('Your session has expired. Please sign in again.')
      const { data, error } = await supabase
        .from('appointments')
        .insert(buildAppointmentRow(form, authUser.id))
        .select()
        .single()
      if (error) throw new Error(describeSupabaseError(error, 'book the appointment'))
      return data
    },
    onSuccess: (created) => {
      // Show the new booking immediately, then re-sync with the database.
      qc.setQueryData(['appointments', user?.id], (old = []) => [...old, created])
      refreshLists()
      setShowForm(false)
      setForm(EMPTY_FORM)
      setNotice({ type: 'success', text: `Appointment with ${created.doctor_name} booked for ${formatDate(created.appointment_date)} at ${created.appointment_time}.` })
    },
    onError: (e) => setNotice({ type: 'error', text: e.message }),
  })

  const { mutate: cancel } = useMutation({
    mutationFn: async (id) => {
      setCancellingId(id)
      const { data, error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id, status')
      if (error) throw new Error(describeSupabaseError(error, 'cancel the appointment'))
      // With row-level security, an update that matches no permitted row returns no error, just no rows.
      if (!data || data.length === 0) throw new Error('Could not cancel the appointment: it was not found or you do not have permission to change it.')
      return data[0]
    },
    onSuccess: () => {
      refreshLists()
      setNotice({ type: 'success', text: 'Appointment cancelled.' })
    },
    onError: (e) => setNotice({ type: 'error', text: e.message }),
    onSettled: () => setCancellingId(null),
  })

  const selectDoctor = (name) => {
    const doctor = findDoctor(name)
    setForm(p => ({ ...p, doctor_name: doctor?.name ?? '', specialty: doctor?.specialty ?? p.specialty }))
  }

  const submit = () => {
    setNotice(null)
    const problem = validateAppointment(form)
    if (problem) { setNotice({ type: 'error', text: problem }); return }
    create()
  }

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

      {notice && (
        <div role={notice.type === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl p-3 text-sm ${notice.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {notice.type === 'error' ? <AlertCircle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle size={16} className="shrink-0 mt-0.5" />}
          <p className="flex-1">{notice.text}</p>
          <button onClick={() => setNotice(null)} className="text-xs opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <select aria-label="Choose a doctor" value={findDoctor(form.doctor_name) ? form.doctor_name : ''} onChange={e => selectDoctor(e.target.value)} className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Choose a doctor (or type a name below)</option>
            {DOCTORS.map(d => <option key={d.name} value={d.name}>{d.name} · {d.specialty} · {d.hospital}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Doctor name" value={form.doctor_name} onChange={e => setForm(p => ({ ...p, doctor_name: e.target.value }))} className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input placeholder="Specialty" value={form.specialty} onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))} className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" min={todayLocal()} value={form.appointment_date} onChange={e => setForm(p => ({ ...p, appointment_date: e.target.value }))} className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input type="time" value={form.appointment_time} onChange={e => setForm(p => ({ ...p, appointment_time: e.target.value }))} className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <select value={form.appointment_type} onChange={e => setForm(p => ({ ...p, appointment_type: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="clinic">Clinic Visit</option>
            <option value="home_visit">Home Visit</option>
            <option value="video">Video Call</option>
          </select>
          <input placeholder="Reason (optional)" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <div className="flex gap-2">
            <button onClick={submit} disabled={isPending || !form.doctor_name || !form.appointment_date} className="bg-primary text-white px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-60">
              {isPending && <Loader2 size={14} className="animate-spin" />} Book
            </button>
            <button onClick={() => setShowForm(false)} className="border border-border px-5 py-2 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : loadError ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl p-4 text-sm bg-red-50 text-red-700 border border-red-200">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>{describeSupabaseError(loadError, 'load your appointments')}</p>
        </div>
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
                  <p className="text-sm text-muted-foreground mt-1">{formatDate(a.appointment_date)} · {a.appointment_time} · {a.appointment_type}</p>
                  {a.reason && <p className="text-xs text-muted-foreground mt-1">{a.reason}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(a.status)}`}>{a.status}</span>
                  {a.status === 'pending' && (
                    <button onClick={() => cancel(a.id)} disabled={cancellingId === a.id} aria-label={`Cancel appointment with ${a.doctor_name}`} title="Cancel appointment" className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50">
                      {cancellingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
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
