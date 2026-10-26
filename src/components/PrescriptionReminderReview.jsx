import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { describeSupabaseError } from '@/lib/appointments'
import {
  REMINDER_FREQUENCIES, draftFromMedicine, validateDraft, buildReminderRows,
} from '@/lib/prescriptionReminders'
import { Bell, Loader2, Plus, X, AlertCircle, CheckCircle } from 'lucide-react'

const inputCls = 'w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

// Lets the user review medicines extracted from a prescription and turn them into reminders.
// Dosage, times and repeat are never guessed: empty values stay empty until the user fills them in.
export default function PrescriptionReminderReview({ medicines, sourceLabel }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [drafts, setDrafts] = useState(() => medicines.map(draftFromMedicine))
  const [showErrors, setShowErrors] = useState(false)
  const [result, setResult] = useState(null) // { type, text }

  const medicineKeys = medicines.map(m => m.key).join('|')
  useEffect(() => {
    setDrafts(medicines.map(draftFromMedicine))
    setResult(null)
    setShowErrors(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicineKeys])

  const update = (key, patch) => setDrafts(ds => ds.map(d => (d.key === key ? { ...d, ...patch } : d)))
  const setTime = (key, idx, value) => setDrafts(ds => ds.map(d => (d.key === key ? { ...d, times: d.times.map((t, i) => (i === idx ? value : t)) } : d)))

  const errorsByKey = Object.fromEntries(drafts.map(d => [d.key, validateDraft(d)]))
  const included = drafts.filter(d => d.include)
  const hasErrors = included.some(d => errorsByKey[d.key].length > 0)

  const { mutate: createReminders, isPending } = useMutation({
    mutationFn: async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Your session has expired. Please sign in again.')

      // Load existing medication reminders so the same medicine/time/repeat is not created twice.
      const { data: existing, error: loadError } = await supabase
        .from('reminders')
        .select('title, time, frequency')
        .eq('user_id', user.id)
        .eq('reminder_type', 'medication')
      if (loadError) throw new Error(describeSupabaseError(loadError, 'check your existing reminders'))

      const { rows, skipped } = buildReminderRows(drafts, { userId: user.id, existing: existing ?? [], sourceLabel })
      if (rows.length > 0) {
        const { error } = await supabase.from('reminders').insert(rows)
        if (error) throw new Error(describeSupabaseError(error, 'create the reminders'))
      }
      return { created: rows.length, skipped: skipped.length }
    },
    onSuccess: ({ created, skipped }) => {
      qc.invalidateQueries({ queryKey: ['reminders'] })
      qc.invalidateQueries({ queryKey: ['active-reminders'] })
      const parts = []
      if (created) parts.push(`Created ${created} reminder${created === 1 ? '' : 's'}.`)
      if (skipped) parts.push(`Skipped ${skipped} that already exist${skipped === 1 ? 's' : ''}.`)
      setResult({ type: 'success', text: parts.join(' ') || 'Nothing to create.' })
      if (created) setOpen(false)
    },
    onError: (e) => setResult({ type: 'error', text: e.message }),
  })

  const confirm = () => {
    setResult(null)
    setShowErrors(true)
    if (included.length === 0) { setResult({ type: 'error', text: 'Select at least one medicine.' }); return }
    if (hasErrors) { setResult({ type: 'error', text: 'Please fix the highlighted fields before creating reminders.' }); return }
    createReminders()
  }

  return (
    <div className="space-y-3">
      {result && (
        <div role={result.type === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl p-3 text-xs ${result.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {result.type === 'error' ? <AlertCircle size={14} className="shrink-0 mt-0.5" /> : <CheckCircle size={14} className="shrink-0 mt-0.5" />}
          <p>{result.text}</p>
        </div>
      )}

      {!open ? (
        <button onClick={() => { setOpen(true); setResult(null) }} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
          <Bell size={16} /> Review &amp; create reminders
        </button>
      ) : (
        <div className="border border-border rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Confirm reminder details</p>
            <button onClick={() => setOpen(false)} aria-label="Close review" className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>
          <p className="text-xs text-muted-foreground">Check each medicine against your prescription. Set the times yourself — nothing is filled in that wasn't on the prescription.</p>

          {drafts.map(d => {
            const errs = showErrors ? errorsByKey[d.key] : []
            return (
              <div key={d.key} className={`rounded-xl p-3 space-y-2 ${d.include ? 'bg-muted/50' : 'bg-muted/20 opacity-70'} ${errs.length ? 'ring-1 ring-red-300' : ''}`}>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={d.include} onChange={e => update(d.key, { include: e.target.checked })} />
                  Create reminder for this medicine
                </label>
                {d.include && (
                  <>
                    <input aria-label="Medicine name" placeholder="Medicine name" value={d.name} onChange={e => update(d.key, { name: e.target.value })} className={inputCls} />
                    <input aria-label="Dosage" placeholder="Dosage (not found on prescription — optional)" value={d.dosage} onChange={e => update(d.key, { dosage: e.target.value })} className={inputCls} />
                    {(d.strength || d.prescribedFrequency || d.duration || d.timing) && (
                      <p className="text-xs text-muted-foreground">
                        On prescription: {[d.strength && `strength ${d.strength}`, d.prescribedFrequency && `frequency "${d.prescribedFrequency}"`, d.timing && `timing "${d.timing}"`, d.duration && `duration ${d.duration}`].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {!d.prescribedFrequency && <p className="text-xs text-amber-700">Frequency was not found on the prescription — check with your doctor before choosing times.</p>}
                    <select aria-label="Repeat" value={d.repeat} onChange={e => update(d.key, { repeat: e.target.value })} className={inputCls}>
                      <option value="">Repeat…</option>
                      {REMINDER_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <div className="space-y-2">
                      {d.times.map((t, i) => (
                        <div key={i} className="flex gap-2">
                          <input type="time" aria-label={`Reminder time ${i + 1}`} value={t} onChange={e => setTime(d.key, i, e.target.value)} className={inputCls} />
                          {d.times.length > 1 && (
                            <button onClick={() => update(d.key, { times: d.times.filter((_, j) => j !== i) })} aria-label="Remove time" className="text-muted-foreground hover:text-destructive"><X size={16} /></button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => update(d.key, { times: [...d.times, ''] })} className="text-xs text-primary flex items-center gap-1"><Plus size={12} /> Add another time</button>
                    </div>
                    {errs.length > 0 && <ul className="text-xs text-red-600 space-y-0.5">{errs.map(er => <li key={er}>• {er}</li>)}</ul>}
                  </>
                )}
              </div>
            )
          })}

          <button onClick={confirm} disabled={isPending} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-60">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Create reminders
          </button>
        </div>
      )}
    </div>
  )
}
