import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchMedicines, resolveMedicineName } from '../src/lib/medicineSearch.js'

const NAMES = ['Paracetamol', 'Ibuprofen', 'Metformin', 'Amlodipine', 'Atorvastatin', 'Omeprazole', 'Cetirizine', 'Azithromycin']

test('case-insensitive prefix match', () => {
  assert.deepEqual(matchMedicines(NAMES, 'para'), ['Paracetamol'])
  assert.deepEqual(matchMedicines(NAMES, 'PARA'), ['Paracetamol'])
})

test('partial match inside the name, prefix matches first', () => {
  // "a" starts Amlodipine/Atorvastatin/Azithromycin and appears inside others
  const r = matchMedicines(NAMES, 'a')
  assert.deepEqual(r.slice(0, 3), ['Amlodipine', 'Atorvastatin', 'Azithromycin'])
  assert.ok(r.includes('Paracetamol'))
  assert.deepEqual(matchMedicines(NAMES, 'statin'), ['Atorvastatin'])
})

test('no results and empty query', () => {
  assert.deepEqual(matchMedicines(NAMES, 'xyz'), [])
  assert.deepEqual(matchMedicines(NAMES, '   '), [])
  assert.deepEqual(matchMedicines(NAMES, undefined), [])
})

test('limit is respected', () => {
  assert.equal(matchMedicines(NAMES, 'i', 3).length, 3)
})

test('resolve typed name to dataset key', () => {
  assert.equal(resolveMedicineName(NAMES, '  metformin '), 'Metformin')
  assert.equal(resolveMedicineName(NAMES, 'metfor'), null)
})
