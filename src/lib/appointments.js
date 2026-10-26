// Pure helpers for the appointment booking flow (kept free of React/Supabase so they can be unit tested).

export const APPOINTMENT_TYPES = ['clinic', 'home_visit', 'video']

const pad = (n) => String(n).padStart(2, '0')

// Today's date as YYYY-MM-DD in the user's local timezone.
export function todayLocal(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Parse a YYYY-MM-DD string as a local date (new Date('YYYY-MM-DD') is UTC and can show the previous day).
export function parseLocalDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

// Returns an error message, or null if the form is valid.
export function validateAppointment(form, now = new Date()) {
  if (!form.doctor_name?.trim()) return 'Please choose or enter a doctor.'
  if (!form.appointment_date) return 'Please pick an appointment date.'
  if (!parseLocalDate(form.appointment_date)) return 'The appointment date is not valid.'
  if (form.appointment_date < todayLocal(now)) return 'The appointment date cannot be in the past.'
  if (!/^\d{2}:\d{2}/.test(form.appointment_time ?? '')) return 'Please pick an appointment time.'
  if (!APPOINTMENT_TYPES.includes(form.appointment_type)) return 'Please choose a visit type.'
  return null
}

// Build the row sent to Supabase. Only columns that exist in public.appointments are included.
export function buildAppointmentRow(form, userId) {
  return {
    user_id: userId,
    doctor_name: form.doctor_name.trim(),
    specialty: form.specialty?.trim() || null,
    appointment_date: form.appointment_date,
    appointment_time: form.appointment_time,
    appointment_type: form.appointment_type,
    reason: form.reason?.trim() || null,
    status: 'pending',
  }
}

// Turn a Supabase/PostgREST error into a message a patient can act on.
export function describeSupabaseError(error, action = 'complete this action') {
  if (!error) return `Could not ${action}.`
  const code = error.code ?? ''
  const msg = error.message ?? String(error)
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return `Could not ${action}: the database refused permission. Please sign out and sign in again; if it keeps happening, the Supabase access policies need to be checked.`
  }
  if (code === 'PGRST301' || /jwt|not authenticated|auth session missing/i.test(msg)) {
    return `Could not ${action}: your session has expired. Please sign in again.`
  }
  if (code === '23514') return `Could not ${action}: one of the values was rejected by the database (${msg}).`
  if (code === '23502') return `Could not ${action}: a required field is missing (${msg}).`
  if (code === 'PGRST204' || code === '42703') return `Could not ${action}: the database schema does not match the app (${msg}).`
  if (/failed to fetch|network/i.test(msg)) return `Could not ${action}: network error. Check your connection and try again.`
  return `Could not ${action}: ${msg}`
}
