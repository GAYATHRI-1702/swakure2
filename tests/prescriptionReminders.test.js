import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMedicine, draftFromMedicine, validateDraft, buildReminderRows, normalizeTime } from '../src/lib/prescriptionReminders.js'

const dbRow = { id: 'm1', medicine_name: 'Metformin ', strength: '500mg', dosage: '1 tablet', frequency: '1-0-1', duration: '30 days' }

test('normalizes prescription_medicines rows and legacy JSON', () => {
  const m = normalizeMedicine(dbRow)
  assert.equal(m.key, 'm1')
  assert.equal(m.name, 'Metformin')
  assert.equal(m.strength, '500mg')
  const legacy = normalizeMedicine({ name: 'Cetirizine', timing: 'night' }, 2)
  assert.equal(legacy.key, 'legacy-2')
  assert.equal(legacy.timing, 'night')
  assert.equal(legacy.dosage, '')
})

test('draft never invents times, repeat or dosage', () => {
  const d = draftFromMedicine(normalizeMedicine({ id: 'x', medicine_name: 'Cetirizine' }))
  assert.deepEqual(d.times, [''])
  assert.equal(d.repeat, '')
  assert.equal(d.dosage, '')
  assert.ok(validateDraft(d).length >= 2) // needs a time and a repeat before it can be saved
})

test('validation', () => {
  const d = { ...draftFromMedicine(normalizeMedicine(dbRow)), repeat: 'daily', times: ['08:00', '20:00'] }
  assert.deepEqual(validateDraft(d), [])
  assert.deepEqual(validateDraft({ ...d, include: false, name: '' }), [])
  assert.ok(validateDraft({ ...d, name: ' ' }).some(e => /name/.test(e)))
  assert.ok(validateDraft({ ...d, repeat: 'hourly' }).some(e => /repeat/.test(e)))
})

test('builds rows per time, keeps missing dosage out of the description', () => {
  const d = { ...draftFromMedicine(normalizeMedicine({ id: 'c', medicine_name: 'Cetirizine' })), repeat: 'daily', times: ['21:00'] }
  const { rows } = buildReminderRows([d], { userId: 'u', sourceLabel: 'rx.jpg' })
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0], { user_id: 'u', title: 'Cetirizine', description: 'From prescription: rx.jpg', reminder_type: 'medication', time: '21:00', frequency: 'daily', is_active: true })

  const m = { ...draftFromMedicine(normalizeMedicine(dbRow)), repeat: 'daily', times: ['08:00', '20:00'] }
  const r2 = buildReminderRows([m], { userId: 'u' }).rows
  assert.equal(r2.length, 2)
  assert.match(r2[0].description, /Dosage: 1 tablet · Strength: 500mg · As prescribed: 1-0-1 · Duration: 30 days/)
})

test('skips duplicates of existing reminders and within the batch', () => {
  const m = { ...draftFromMedicine(normalizeMedicine(dbRow)), repeat: 'daily', times: ['08:00', '8:00', '20:00'] }
  const copy = { ...m, key: 'dup' }
  const existing = [{ title: 'metformin', time: '08:00:00', frequency: 'daily' }]
  const { rows, skipped } = buildReminderRows([m, copy], { userId: 'u', existing })
  assert.deepEqual(rows.map(r => r.time), ['20:00'])
  assert.equal(skipped.length, 3) // 08:00 (existing) for both drafts + 20:00 repeated in copy
})

test('excluded drafts create nothing', () => {
  const m = { ...draftFromMedicine(normalizeMedicine(dbRow)), include: false, repeat: 'daily', times: ['08:00'] }
  assert.equal(buildReminderRows([m], { userId: 'u' }).rows.length, 0)
})

test('normalizeTime', () => {
  assert.equal(normalizeTime('8:05'), '08:05')
  assert.equal(normalizeTime('20:00:00'), '20:00')
  assert.equal(normalizeTime('25:00'), '')
  assert.equal(normalizeTime(''), '')
})
