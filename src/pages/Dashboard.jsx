import React from 'react'
import { useAuth } from '../lib/AuthContext'
import { useLanguage } from '../lib/LanguageContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { Link } from 'react-router-dom'
import { Activity, Pill, Calendar, FileText, Bell, Heart, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'

export default function Dashboard() {
  const { user } = useAuth()
  const { tr } = useLanguage()

  const { data: latestRecord } = useQuery({
    queryKey: ['latest-health-record'],
    queryFn: async () => {
      const { data } = await supabase.from('health_records').select('*').order('recorded_at', { ascending: false }).limit(1).single()
      return data
    },
  })

  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ['upcoming-appointments'],
    queryFn: async () => {
      const { data } = await supabase.from('appointments').select('*').eq('status', 'pending').order('appointment_date').limit(3)
      return data ?? []
    },
  })

  const { data: activeReminders = [] } = useQuery({
    queryKey: ['active-reminders'],
    queryFn: async () => {
      const { data } = await supabase.from('reminders').select('*').eq('is_active', true).limit(3)
      return data ?? []
    },
  })

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const vitals = [
    { label: 'Blood Pressure', value: latestRecord ? `${latestRecord.blood_pressure_systolic}/${latestRecord.blood_pressure_diastolic}` : '--', unit: 'mmHg', icon: Activity, color: 'text-blue-500' },
    { label: 'Blood Sugar', value: latestRecord?.blood_sugar ?? '--', unit: 'mg/dL', icon: Heart, color: 'text-red-500' },
    { label: 'Heart Rate', value: latestRecord?.heart_rate ?? '--', unit: 'bpm', icon: Activity, color: 'text-pink-500' },
    { label: 'SpO2', value: latestRecord?.oxygen_saturation ?? '--', unit: '%', icon: Activity, color: 'text-cyan-500' },
  ]

  const quickActions = [
    { to: '/health-monitor', icon: Activity, label: 'Log Vitals', color: 'bg-blue-50 text-blue-600' },
    { to: '/medicines', icon: Pill, label: 'Medicines', color: 'bg-green-50 text-green-600' },
    { to: '/appointments', icon: Calendar, label: 'Book Appointment', color: 'bg-purple-50 text-purple-600' },
    { to: '/prescriptions', icon: FileText, label: 'Prescriptions', color: 'bg-orange-50 text-orange-600' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="font-poppins font-bold text-2xl text-foreground">
          {greeting()}, {user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Here's your health summary for today</p>
      </div>

      {latestRecord?.risk_level === 'critical' && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle size={20} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">Your latest vitals show critical values. Please consult a doctor immediately.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {vitals.map(({ label, value, unit, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4">
            <Icon size={18} className={`${color} mb-2`} />
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{unit}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map(({ to, icon: Icon, label, color }) => (
            <Link key={to} to={to} className={`${color} rounded-2xl p-4 flex flex-col items-center gap-2 hover:opacity-80 transition-opacity`}>
              <Icon size={24} />
              <span className="text-sm font-medium text-center">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Upcoming Appointments</h2>
            <Link to="/appointments" className="text-xs text-primary">View all</Link>
          </div>
          {upcomingAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No upcoming appointments</p>
          ) : (
            <div className="space-y-2">
              {upcomingAppointments.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/50">
                  <Calendar size={16} className="text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{a.doctor_name}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(a.appointment_date), 'dd MMM yyyy')} · {a.appointment_time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Active Reminders</h2>
            <Link to="/reminders" className="text-xs text-primary">View all</Link>
          </div>
          {activeReminders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No active reminders</p>
          ) : (
            <div className="space-y-2">
              {activeReminders.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/50">
                  <Bell size={16} className="text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.time} · {r.frequency}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
