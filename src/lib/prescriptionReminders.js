// Pure helpers that turn extracted prescription medicines into medication reminders.
// Nothing here guesses dosage, times or frequency: missing values stay empty until the user fills them in.

export const REMINDER_FREQUENCIES = ['daily', 'weekly', 'monthly', 'once']

const clean = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())

// Accepts rows from public.prescription_medicines ({ medicine_name, dosage, strength, frequency, duration, ... })
// or the older JSON shape ({ name, dosage, frequency, duration, timing }).
export function normalizeMedicine(m, index = 0) {
  return {
    key: m.id ?? `legacy-${index}`,
    name: clean(m.medicine_name ?? m.name),
    genericName: clean(m.generic_name),
    dosage: clean(m.dosage),
    strength: clean(m.strength),
    frequency: clean(m.frequency),
    duration: clean(m.duration),
    timing: clean(m.timing),
    route: clean(m.route),
  }
}

// Initial editable draft for the review form. Times and repeat start empty on purpose.
export function draftFromMedicine(med) {
  return {
    key: med.key,
    include: Boolean(med.name),
    name: med.name,
    dosage: med.dosage,
    strength: med.strength,
    prescribedFrequency: med.frequency,
    duration: med.duration,
    timing: med.timing,
    repeat: '',
    times: [''],
  }
}

export function normalizeTime(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(clean(t))
  if (!m) return ''
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return ''
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

// Returns a list of problems for one draft (empty list = OK). Excluded drafts are always OK.
export function validateDraft(d) {
  if (!d.include) return []
  const errors = []
  if (!clean(d.name)) errors.push('Medicine name is required.')
  const times = d.times.map(normalizeTime).filter(Boolean)
  if (times.length === 0) errors.push('Add at least one reminder time.')
  if (d.times.some(t => clean(t) && !normalizeTime(t))) errors.push('One of the times is not valid.')
  if (!REMINDER_FREQUENCIES.includes(d.repeat)) errors.push('Choose how often the reminder repeats.')
  return errors
}

export function describeDraft(d, sourceLabel) {
  const parts = []
  if (clean(d.dosage)) parts.push(`Dosage: ${clean(d.dosage)}`)
  if (clean(d.strength)) parts.push(`Strength: ${clean(d.strength)}`)
  if (clean(d.prescribedFrequency)) parts.push(`As prescribed: ${clean(d.prescribedFrequency)}`)
  if (clean(d.timing)) parts.push(`Timing: ${clean(d.timing)}`)
  if (clean(d.duration)) parts.push(`Duration: ${clean(d.duration)}`)
  if (sourceLabel) parts.push(`From prescription: ${sourceLabel}`)
  return parts.join(' · ')
}

export const reminderKey = (r) =>
  `${clean(r.title).toLowerCase()}|${normalizeTime(r.time)}|${clean(r.frequency).toLowerCase()}`

// Build reminder rows for all included drafts, skipping duplicates of existing reminders
// and duplicates inside the same batch. Assumes drafts have already passed validateDraft.
export function buildReminderRows(drafts, { userId, existing = [], sourceLabel = '' }) {
  const seen = new Set(existing.map(reminderKey))
  const rows = []
  const skipped = []
  for (const d of drafts) {
    if (!d.include) continue
    const times = [...new Set(d.times.map(normalizeTime).filter(Boolean))]
    for (const time of times) {
      const row = {
        user_id: userId,
        title: clean(d.name),
        description: describeDraft(d, sourceLabel),
        reminder_type: 'medication',
        time,
        frequency: d.repeat,
        is_active: true,
      }
      const key = reminderKey(row)
      if (seen.has(key)) {
        skipped.push(row)
        continue
      }
      seen.add(key)
      rows.push(row)
    }
  }
  return { rows, skipped }
}
