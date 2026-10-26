import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateAppointment, buildAppointmentRow, describeSupabaseError, parseLocalDate, todayLocal } from '../src/lib/appointments.js'

const NOW = new Date(2026, 9, 25, 12, 0) // 25 Oct 2026, local time
const base = { doctor_name: 'Dr. Priya Sharma', specialty: 'Cardiologist', appointment_date: '2026-10-30', appointment_time: '10:00', appointment_type: 'clinic', reason: '' }

test('valid form passes', () => {
  assert.equal(validateAppointment(base, NOW), null)
  assert.equal(validateAppointment({ ...base, appointment_date: '2026-10-25' }, NOW), null) // today is allowed
})

test('validation errors', () => {
  assert.match(validateAppointment({ ...base, doctor_name: '  ' }, NOW), /doctor/)
  assert.match(validateAppointment({ ...base, appointment_date: '' }, NOW), /date/)
  assert.match(validateAppointment({ ...base, appointment_date: '2026-10-24' }, NOW), /past/)
  assert.match(validateAppointment({ ...base, appointment_time: '' }, NOW), /time/)
  assert.match(validateAppointment({ ...base, appointment_type: 'teleport' }, NOW), /visit type/)
})

test('row matches appointments columns and trims/blanks optional fields', () => {
  const row = buildAppointmentRow({ ...base, doctor_name: ' Dr. X ', specialty: '', reason: '  ' }, 'user-1')
  assert.deepEqual(row, {
    user_id: 'user-1', doctor_name: 'Dr. X', specialty: null, appointment_date: '2026-10-30',
    appointment_time: '10:00', appointment_type: 'clinic', reason: null, status: 'pending',
  })
})

test('dates are parsed in local time', () => {
  const d = parseLocalDate('2026-10-30')
  assert.equal(d.getDate(), 30)
  assert.equal(d.getMonth(), 9)
  assert.equal(parseLocalDate('garbage'), null)
  assert.equal(todayLocal(NOW), '2026-10-25')
})

test('error messages are useful', () => {
  assert.match(describeSupabaseError({ code: '42501', message: 'new row violates row-level security policy' }, 'book the appointment'), /permission/)
  assert.match(describeSupabaseError({ message: 'JWT expired' }, 'x'), /session has expired/)
  assert.match(describeSupabaseError({ message: 'TypeError: Failed to fetch' }, 'x'), /network/)
  assert.match(describeSupabaseError({ code: '23514', message: 'violates check constraint "appointments_status_check"' }, 'x'), /appointments_status_check/)
})
