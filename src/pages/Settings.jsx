import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useLanguage } from '@/lib/LanguageContext'
import { useAuth } from '@/lib/AuthContext'
import { Loader2, Save } from 'lucide-react'

export default function Settings() {
  const { tr, lang, setLanguage, LANGUAGES } = useLanguage()
  const { user } = useAuth()
  const [form, setForm] = useState({ full_name: '', age: '', blood_group: '', emergency_contact: '', medical_conditions: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setForm({ full_name: data.full_name ?? '', age: data.age ?? '', blood_group: data.blood_group ?? '', emergency_contact: data.emergency_contact ?? '', medical_conditions: data.medical_conditions ?? '' })
    })
  }, [user])

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({ user_id: user.id, ...form, preferred_language: lang })
    setSaving(false)
    setToast(error ? { msg: error.message, err: true } : { msg: 'Settings saved!' })
    setTimeout(() => setToast(null), 3000)
  }

  const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl p-4 shadow-lg ${toast.err ? 'bg-red-50 border border-red-200' : 'bg-white border border-border'}`}>
          <p className="text-sm">{toast.msg}</p>
        </div>
      )}

      <div>
        <h1 className="font-poppins font-bold text-2xl">{tr('settings')}</h1>
        <p className="text-muted-foreground text-sm">Manage your profile and preferences.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
            <input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Age</label>
              <input type="number" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Blood Group</label>
              <select value={form.blood_group} onChange={e => setForm(p => ({ ...p, blood_group: e.target.value }))} className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select</option>
                {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Emergency Contact</label>
            <input value={form.emergency_contact} onChange={e => setForm(p => ({ ...p, emergency_contact: e.target.value }))} placeholder="Phone number" className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Medical Conditions</label>
            <textarea value={form.medical_conditions} onChange={e => setForm(p => ({ ...p, medical_conditions: e.target.value }))} placeholder="e.g. Diabetes, Hypertension" rows={3} className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-semibold mb-3">Language</h2>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLanguage(l.code)} className={`py-2 px-3 rounded-xl text-sm border transition-colors ${lang === l.code ? 'bg-primary text-white border-primary' : 'border-border hover:bg-muted'}`}>
              {l.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-semibold mb-1">Account</h2>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <button onClick={save} disabled={saving} className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-60">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {tr('save')}
      </button>
    </div>
  )
}
