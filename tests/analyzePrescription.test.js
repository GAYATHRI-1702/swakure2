// Tests for the analyze-prescription Edge Function logic. Node 22.6+ runs the .ts files via type stripping.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkFile, checkTranscript, validateExtraction, compact, cleanText, tokens, foundInText } from '../Supabase/functions/analyze-prescription/validation.ts'
import { transcribePrescription, extractFromTranscript, toBase64, GeminiError, resolveApiBase, GOOGLE_API_BASE } from '../Supabase/functions/analyze-prescription/gemini.ts'
import { createStore, getPrescriptionById, STALE_PROCESSING_MS } from '../Supabase/functions/analyze-prescription/database.ts'
import { runPipeline } from '../Supabase/functions/analyze-prescription/pipeline.ts'

const TRANSCRIPT = `City Care Clinic
Dr. A. Rao MBBS
Dx: Type 2 diabetes
1. Tab Metformin 500 mg  1-0-1  x 30 days  after food  Qty 60
2. Tab Pantop 40mg  1-0-0 before breakfast
3. Syp Cofex
Avoid sugar. Review after 1 month.`

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])
const PDF = new TextEncoder().encode('%PDF-1.7 ...')

// ---------- validation ----------

test('file checks: type, size, empty and signature', () => {
  assert.equal(checkFile({ mimeType: 'image/jpeg', size: JPEG.length, bytes: JPEG }), null)
  assert.equal(checkFile({ mimeType: 'application/pdf', size: PDF.length, bytes: PDF }), null)
  assert.match(checkFile({ mimeType: 'image/gif', size: 10, bytes: JPEG }), /Unsupported/)
  assert.match(checkFile({ mimeType: 'image/jpeg', size: 0, bytes: new Uint8Array() }), /empty/)
  assert.match(checkFile({ mimeType: 'image/jpeg', size: 6 * 1024 * 1024, bytes: JPEG }), /5MB/)
  assert.match(checkFile({ mimeType: 'image/png', size: JPEG.length, bytes: JPEG }), /does not match/)
})

test('transcript checks reject unreadable documents', () => {
  assert.deepEqual(checkTranscript({ raw_text: TRANSCRIPT, legibility: 0.9 }), { text: TRANSCRIPT, legibility: 0.9 })
  assert.ok('error' in checkTranscript({ raw_text: '[illegible]', legibility: 0.9 }))
  assert.ok('error' in checkTranscript({ raw_text: TRANSCRIPT, legibility: 0.1 }))
  assert.ok('error' in checkTranscript({}))
})

test('helpers', () => {
  assert.equal(compact('500 mg'), compact('500mg'))
  const t = tokens(TRANSCRIPT)
  assert.ok(foundInText('500mg', t))
  assert.ok(foundInText('1 - 0 - 1', t))
  assert.ok(!foundInText('Metform', t), 'partial words must not match')
  assert.ok(!foundInText('01', t), 'digits inside other numbers must not match')
  assert.equal(cleanText('  Not specified '), null)
  assert.equal(cleanText('N/A'), null)
  assert.equal(cleanText(42), null)
})

test('keeps values written on the prescription', () => {
  const r = validateExtraction({
    doctor_name: 'Dr. A. Rao', hospital_name: 'City Care Clinic', diagnosis: 'Type 2 diabetes',
    follow_up_instructions: 'Review after 1 month.', food_instructions: 'Avoid sugar.',
    warnings: [],
    medicines: [
      { medicine_name: 'Metformin', strength: '500 mg', frequency: '1-0-1', duration: '30 days', quantity: 60, instructions: 'after food', confidence: 0.93 },
      { medicine_name: 'Pantop', strength: '40mg', frequency: '1-0-0', instructions: 'before breakfast', confidence: 1.4 },
    ],
  }, TRANSCRIPT)
  assert.equal(r.medicines.length, 2)
  assert.deepEqual(r.medicines[0], {
    medicine_name: 'Metformin', generic_name: null, strength: '500 mg', dosage: null, frequency: '1-0-1',
    duration: '30 days', route: null, quantity: 60, confidence: 0.93,
  })
  assert.equal(r.medicines[1].confidence, 1) // clamped
  assert.equal(r.doctor_name, 'Dr. A. Rao')
  assert.equal(r.food_instructions, 'Avoid sugar.\nMetformin: after food\nPantop: before breakfast')
  assert.equal(r.follow_up_instructions, 'Review after 1 month.')
  assert.deepEqual(r.warnings, [])
})

test('never stores invented dosages, schedules, generic names or medicines', () => {
  const r = validateExtraction({
    medicines: [
      // Cofex has no dosage or schedule on the paper; the model "helpfully" adds them.
      { medicine_name: 'Cofex', dosage: '10 ml', frequency: 'three times daily', duration: '5 days', generic_name: 'Dextromethorphan', quantity: 2 },
      // Pantop: model expands the abbreviation instead of copying it.
      { medicine_name: 'Pantop', strength: '40mg', frequency: 'once daily', route: 'oral' },
      // Not on the prescription at all.
      { medicine_name: 'Amoxicillin', strength: '500mg', frequency: '1-1-1' },
      { medicine_name: '  ' },
      null,
    ],
  }, TRANSCRIPT)
  assert.deepEqual(r.medicines.map(m => m.medicine_name), ['Cofex', 'Pantop'])
  const cofex = r.medicines[0]
  assert.equal(cofex.dosage, null)
  assert.equal(cofex.frequency, null)
  assert.equal(cofex.duration, null)
  assert.equal(cofex.generic_name, null)
  assert.equal(cofex.quantity, null)
  assert.equal(r.medicines[1].strength, '40mg')
  assert.equal(r.medicines[1].frequency, null)
  assert.equal(r.medicines[1].route, null)
  assert.equal(r.warnings.length, 1)
  assert.match(r.warnings[0], /Amoxicillin/)
})

test('deduplicates medicines and tolerates garbage input', () => {
  const r = validateExtraction({
    medicines: [
      { medicine_name: 'Metformin', strength: '500 mg' },
      { medicine_name: 'metformin', strength: '500mg' },
    ],
  }, TRANSCRIPT)
  assert.equal(r.medicines.length, 1)
  assert.deepEqual(validateExtraction(null, TRANSCRIPT).medicines, [])
  assert.deepEqual(validateExtraction({ medicines: 'nope' }, TRANSCRIPT).medicines, [])
})

// ---------- Gemini client (fake fetch, no network) ----------

function reply(payload, { status = 200, headers = {} } = {}) {
  return new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}
// Responds with each queued item in turn (a Response factory, or an Error to throw).
function fakeFetch(...queue) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) })
    const next = queue.length > 1 ? queue.shift() : queue[0]
    if (next instanceof Error) throw next
    return next()
  }
  fn.calls = calls
  return fn
}
const geminiReply = (obj, extra = {}) => () => reply({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: 'STOP', ...extra }] })
const noSleep = async () => {}
const cfg = (fetchFn, more = {}) => ({ apiKey: 'k', fetchFn, sleep: noSleep, ...more })

test('OCR call sends the file inline with the key in a header', async () => {
  const fetchFn = fakeFetch(geminiReply({ raw_text: TRANSCRIPT, legibility: 0.8 }))
  const out = await transcribePrescription(cfg(fetchFn, { model: 'm1' }), { mimeType: 'image/jpeg', bytes: JPEG })
  assert.equal(out.raw_text, TRANSCRIPT)
  const { url, init, body } = fetchFn.calls[0]
  assert.equal(url, `${GOOGLE_API_BASE}/m1:generateContent`)
  assert.ok(!url.includes('key='), 'API key must not be in the URL')
  assert.equal(init.headers['x-goog-api-key'], 'k')
  assert.ok(init.signal, 'request must have a timeout signal')
  assert.equal(body.contents[0].parts[0].inlineData.data, toBase64(JPEG))
  assert.equal(body.generationConfig.temperature, 0)
})

test('extraction call sends only the transcript text, unchanged', async () => {
  const fetchFn = fakeFetch(geminiReply({ medicines: [] }))
  const tricky = TRANSCRIPT + '\nPrice $& $1 $$'
  await extractFromTranscript(cfg(fetchFn), tricky)
  const parts = fetchFn.calls[0].body.contents[0].parts
  assert.equal(parts.length, 1)
  assert.ok(parts[0].text.includes(tricky), 'special $ patterns must not be rewritten')
  assert.ok(!('inlineData' in parts[0]))
})

test('retries once on 429/5xx and network errors, then succeeds', async () => {
  const f1 = fakeFetch(() => reply({}, { status: 429, headers: { 'retry-after': '1' } }), geminiReply({ medicines: [] }))
  assert.deepEqual(await extractFromTranscript(cfg(f1), 'x'), { medicines: [] })
  assert.equal(f1.calls.length, 2)

  const f2 = fakeFetch(new TypeError('connection reset'), geminiReply({ medicines: [] }))
  await extractFromTranscript(cfg(f2), 'x')
  assert.equal(f2.calls.length, 2)
})

test('gives up after the retry and reports a readable error', async () => {
  const f = fakeFetch(() => reply({}, { status: 503 }))
  await assert.rejects(extractFromTranscript(cfg(f), 'x'), /HTTP 503/)
  assert.equal(f.calls.length, 2)
  const t = fakeFetch(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))
  await assert.rejects(extractFromTranscript(cfg(t), 'x'), /timed out/)
  assert.equal(t.calls.length, 2)
})

test('does not retry permanent errors or bad responses', async () => {
  for (const [res, pattern] of [
    [() => reply({}, { status: 403 }), /HTTP 403.*GEMINI_API_KEY/],
    [() => reply({}, { status: 400 }), /HTTP 400/],
    [() => reply('<html>not json</html>'), /unreadable response/],
    [() => reply({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }), /not valid JSON/],
    [() => reply({ promptFeedback: { blockReason: 'SAFETY' } }), /declined.*SAFETY/],
    [geminiReply({ medicines: [] }, { finishReason: 'RECITATION' }), /declined.*RECITATION/],
    [() => reply({ candidates: [{ content: { parts: [{ text: '{"medicines": [' }] }, finishReason: 'MAX_TOKENS' }] }), /cut off/],
    [() => reply({ candidates: [] }), /empty response/],
  ]) {
    const f = fakeFetch(res)
    await assert.rejects(extractFromTranscript(cfg(f), 'x'), (e) => e instanceof GeminiError && pattern.test(e.message))
    assert.equal(f.calls.length, 1, `no retry expected for ${pattern}`)
  }
})

test('respects the overall deadline: no retry and no request when time is up', async () => {
  const f = fakeFetch(() => reply({}, { status: 503 }))
  await assert.rejects(extractFromTranscript(cfg(f, { deadline: Date.now() + 4000 }), 'x'), /HTTP 503/)
  assert.equal(f.calls.length, 1, 'retry would overrun the deadline')

  const g = fakeFetch(geminiReply({ medicines: [] }))
  await assert.rejects(extractFromTranscript(cfg(g, { deadline: Date.now() + 1000 }), 'x'), /took too long/)
  assert.equal(g.calls.length, 0)
})

test('API key can only be sent to Google or a local test server', () => {
  assert.equal(resolveApiBase(undefined), GOOGLE_API_BASE)
  assert.equal(resolveApiBase('http://host.docker.internal:54999/v1beta/models/'), 'http://host.docker.internal:54999/v1beta/models')
  assert.throws(() => resolveApiBase('https://evil.example.com/v1beta/models'), GeminiError)
  assert.throws(() => resolveApiBase('not a url'), GeminiError)
})

test('base64 matches Node Buffer for large input', () => {
  const big = new Uint8Array(100_000).map((_, i) => i % 256)
  assert.equal(toBase64(big), Buffer.from(big).toString('base64'))
})

// ---------- pipeline (fake store + services) ----------

function fakeStore({ claim = true, failOn = null } = {}) {
  const log = []
  const step = (name, entry) => async (...args) => {
    log.push(entry ? entry(...args) : [name])
    if (failOn === name) throw new Error(`${name} failed`)
  }
  return {
    log,
    claim: async () => { log.push(['claim']); return claim },
    clearResults: step('clear'),
    setStage: step('stage', (s) => ['stage', s]),
    saveOcr: step('ocr', (text, conf) => ['ocr', text.length > 0, conf]),
    saveAnalysis: step('analysis', (a, model) => ['analysis', a.medicines.map(m => m.medicine_name), model]),
    markCompleted: step('completed', (q) => ['completed', q]),
    markFailed: step('failed'),
  }
}

const input = { mimeType: 'image/jpeg', fileSize: JPEG.length, modelName: 'gemini-test' }
const okServices = {
  download: async () => JPEG,
  transcribe: async () => ({ raw_text: TRANSCRIPT, legibility: 0.8 }),
  extract: async () => ({ medicines: [{ medicine_name: 'Metformin', frequency: '1-0-1' }, { medicine_name: 'Ghostcillin' }] }),
}

test('pipeline: happy path claims, clears old results, runs every stage and stores validated medicines', async () => {
  const store = fakeStore()
  const res = await runPipeline(input, store, okServices)
  assert.equal(res.ok, true)
  assert.equal(res.medicineCount, 1)
  assert.match(res.warnings[0], /Ghostcillin/)
  assert.deepEqual(store.log, [
    ['claim'], ['clear'], ['stage', 'quality_check'], ['stage', 'ocr'], ['ocr', true, 0.8], ['stage', 'ai_analysis'],
    ['stage', 'medicine_extraction'], ['analysis', ['Metformin'], 'gemini-test'], ['completed', 0.8],
  ])
})

test('pipeline: a run that cannot claim the prescription does nothing', async () => {
  const store = fakeStore({ claim: false })
  let downloaded = false
  const res = await runPipeline(input, store, { ...okServices, download: async () => { downloaded = true; return JPEG } })
  assert.deepEqual(res, { ok: false, status: 409, message: 'This prescription is already being analysed.' })
  assert.deepEqual(store.log, [['claim']])
  assert.equal(downloaded, false)
})

test('pipeline: if the claim itself errors, returns 503 and only fails a still-unclaimed row', async () => {
  const store = fakeStore()
  const logs = []
  let failOpts
  store.claim = async () => { throw new Error('Could not start analysis: permission denied for table prescriptions') }
  store.markFailed = async (opts) => { failOpts = opts }
  const res = await runPipeline(input, store, { ...okServices, log: (m) => logs.push(m) })
  assert.equal(res.ok, false)
  assert.equal(res.status, 503)
  assert.deepEqual(failOpts, { onlyIfUnclaimed: true })
  assert.match(logs[0], /permission denied/)
})

test('store.markFailed(onlyIfUnclaimed) only matches rows still "uploaded"', async () => {
  const db = fakeDb()
  await createStore(db, 'p1').markFailed({ onlyIfUnclaimed: true })
  assert.deepEqual(db.ops[0].calls.slice(1), [['eq', 'id', 'p1'], ['eq', 'status', 'uploaded']])
  const db2 = fakeDb()
  await createStore(db2, 'p1').markFailed()
  assert.deepEqual(db2.ops[0].calls.slice(1), [['eq', 'id', 'p1']])
})

test('pipeline: bad file fails before calling the AI service, and leaves no results', async () => {
  const store = fakeStore()
  let called = false
  const res = await runPipeline({ ...input, mimeType: 'image/gif' }, store, { ...okServices, transcribe: async () => { called = true; return {} } })
  assert.equal(res.ok, false)
  assert.equal(res.status, 422)
  assert.equal(called, false)
  assert.deepEqual(store.log.slice(-2), [['clear'], ['failed']])
})

test('pipeline: a failure after partial writes rolls back results before marking failed', async () => {
  for (const failOn of ['analysis', 'completed']) {
    const store = fakeStore({ failOn })
    const res = await runPipeline(input, store, okServices)
    assert.equal(res.ok, false)
    assert.equal(res.status, 502)
    assert.match(res.message, new RegExp(`${failOn} failed`))
    assert.deepEqual(store.log.slice(-2), [['clear'], ['failed']], `rollback expected when ${failOn} fails`)
  }
})

test('pipeline: unreadable prescription and AI errors mark the record failed with no results', async () => {
  const s1 = fakeStore()
  const r1 = await runPipeline(input, s1, { ...okServices, transcribe: async () => ({ raw_text: '', legibility: 0 }) })
  assert.equal(r1.ok, false)
  assert.match(r1.message, /clearer/)
  assert.ok(!s1.log.some(l => l[0] === 'analysis' || l[0] === 'ocr'))

  const s2 = fakeStore()
  const r2 = await runPipeline(input, s2, { ...okServices, extract: async () => { throw new GeminiError('AI service returned HTTP 500.') } })
  assert.equal(r2.status, 502)
  assert.deepEqual(s2.log.slice(-2), [['clear'], ['failed']])
})

test('pipeline: still marks failed when cleanup itself fails, and logs no prescription content', async () => {
  const logs = []
  const store = fakeStore()
  store.clearResults = async () => { store.log.push(['clear']); if (store.log.filter(l => l[0] === 'clear').length > 1) throw new Error('db down') }
  const res = await runPipeline(input, store, { ...okServices, extract: async () => { throw new Error('boom') }, log: (m) => logs.push(m) })
  assert.equal(res.ok, false)
  assert.deepEqual(store.log.at(-1), ['failed'])
  assert.equal(logs.length, 1)
  assert.match(logs[0], /cleanup after failure did not complete: db down/)
  for (const m of logs) assert.ok(!/Metformin|Rao|diabetes/i.test(m), 'logs must not contain prescription content')
})

// ---------- database store (fake PostgREST query builder) ----------

function fakeDb(results = {}) {
  const ops = []
  const builder = (table) => {
    const op = { table, calls: [] }
    ops.push(op)
    const proxy = new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') {
          const r = results[`${table}.${op.calls[0]?.[0]}`] ?? { data: [{ id: 'row-1' }], error: null }
          return (resolve) => resolve(typeof r === 'function' ? r(op) : r)
        }
        return (...args) => { op.calls.push([prop, ...args]); return proxy }
      },
    })
    return proxy
  }
  return { ops, from: builder }
}

test('store.claim uses one conditional update that only matches claimable states', async () => {
  const db = fakeDb()
  const now = Date.UTC(2026, 9, 25, 12, 0, 0)
  const ok = await createStore(db, 'p1', () => now).claim()
  assert.equal(ok, true)
  const [op] = db.ops
  assert.equal(op.table, 'prescriptions')
  assert.equal(op.calls[0][0], 'update')
  assert.equal(op.calls[0][1].status, 'processing')
  assert.deepEqual(op.calls[1], ['eq', 'id', 'p1'])
  const stale = new Date(now - STALE_PROCESSING_MS).toISOString()
  assert.deepEqual(op.calls[2], ['or', `status.in.(uploaded,failed),and(status.eq.processing,or(processing_started_at.is.null,processing_started_at.lt.${stale}))`])

  const busy = fakeDb({ 'prescriptions.update': { data: [], error: null } })
  assert.equal(await createStore(busy, 'p1').claim(), false)
})

test('store.clearResults deletes child rows first, all scoped to the prescription', async () => {
  const db = fakeDb()
  await createStore(db, 'p1').clearResults()
  assert.deepEqual(db.ops.map(o => [o.table, o.calls[0][0], o.calls[1]]), [
    ['prescription_medicines', 'delete', ['eq', 'prescription_id', 'p1']],
    ['prescription_analysis', 'delete', ['eq', 'prescription_id', 'p1']],
    ['prescription_ocr_results', 'delete', ['eq', 'prescription_id', 'p1']],
  ])
})

test('store.saveAnalysis links medicines to the analysis in one insert and surfaces DB errors', async () => {
  const db = fakeDb({ 'prescription_analysis.insert': { data: { id: 'a1' }, error: null } })
  const analysis = validateExtraction({ medicines: [{ medicine_name: 'Metformin' }, { medicine_name: 'Pantop' }] }, TRANSCRIPT)
  await createStore(db, 'p1').saveAnalysis(analysis, 'm')
  const meds = db.ops.find(o => o.table === 'prescription_medicines')
  assert.equal(meds.calls.length, 1, 'medicines must be a single multi-row insert')
  assert.deepEqual(meds.calls[0][1].map(r => [r.medicine_name, r.prescription_id, r.analysis_id]), [['Metformin', 'p1', 'a1'], ['Pantop', 'p1', 'a1']])

  const failing = fakeDb({
    'prescription_analysis.insert': { data: { id: 'a1' }, error: null },
    'prescription_medicines.insert': { data: null, error: { message: 'violates check constraint' } },
  })
  await assert.rejects(createStore(failing, 'p1').saveAnalysis(analysis, 'm'), /Could not save the medicines/)
})

test('ownership lookup filters by user and treats missing or malformed ids as not found', async () => {
  const db = fakeDb({ 'prescriptions.select': { data: null, error: null } })
  assert.equal(await getPrescriptionById(db, 'p1', 'u1'), null)
  assert.deepEqual(db.ops[0].calls.slice(1, 3), [['eq', 'id', 'p1'], ['eq', 'user_id', 'u1']])
  const bad = fakeDb({ 'prescriptions.select': { data: null, error: { code: '22P02', message: 'invalid uuid' } } })
  assert.equal(await getPrescriptionById(bad, 'nope', 'u1'), null)
  const down = fakeDb({ 'prescriptions.select': { data: null, error: { code: '08006', message: 'connection failure' } } })
  await assert.rejects(getPrescriptionById(down, 'p1', 'u1'))
})
