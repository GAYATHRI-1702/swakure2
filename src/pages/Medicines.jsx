import React, { useState } from 'react'
import { Pill, Search, Loader2 } from 'lucide-react'

const COMMON = ['Paracetamol', 'Ibuprofen', 'Metformin', 'Amlodipine', 'Atorvastatin', 'Omeprazole', 'Cetirizine', 'Azithromycin']

const INFO = {
  Paracetamol: { uses: 'Pain relief and fever reduction', dosage: '500mg-1g every 4-6 hours', sideEffects: 'Rare at normal doses; liver damage in overdose', warnings: 'Do not exceed 4g/day' },
  Ibuprofen: { uses: 'Pain, fever, inflammation', dosage: '200-400mg every 4-6 hours', sideEffects: 'Stomach upset, nausea', warnings: 'Avoid on empty stomach; not for kidney disease' },
  Metformin: { uses: 'Type 2 diabetes management', dosage: '500-2000mg daily with meals', sideEffects: 'Nausea, diarrhea (usually temporary)', warnings: 'Monitor kidney function' },
  Amlodipine: { uses: 'High blood pressure, chest pain', dosage: '5-10mg once daily', sideEffects: 'Ankle swelling, flushing', warnings: 'Do not stop suddenly' },
  Atorvastatin: { uses: 'High cholesterol', dosage: '10-80mg once daily', sideEffects: 'Muscle pain, liver enzyme changes', warnings: 'Avoid grapefruit juice' },
  Omeprazole: { uses: 'Acid reflux, stomach ulcers', dosage: '20-40mg once daily before meals', sideEffects: 'Headache, nausea', warnings: 'Long-term use may affect magnesium levels' },
  Cetirizine: { uses: 'Allergies, hay fever', dosage: '10mg once daily', sideEffects: 'Drowsiness, dry mouth', warnings: 'Avoid alcohol' },
  Azithromycin: { uses: 'Bacterial infections', dosage: '500mg day 1, then 250mg days 2-5', sideEffects: 'Nausea, diarrhea', warnings: 'Complete full course' },
}

export default function Medicines() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const handleSearch = (name) => {
    setSelected(INFO[name] ? { name, ...INFO[name] } : { name, uses: 'Information not available in offline mode.', dosage: '-', sideEffects: '-', warnings: 'Consult your doctor or pharmacist.' })
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="font-poppins font-bold text-2xl">Medicines</h1>
        <p className="text-muted-foreground text-sm">Search for medicine information.</p>
      </div>

      <div className="flex gap-2">
        <input
          placeholder="Search medicine name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search && handleSearch(search)}
          className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button onClick={() => search && handleSearch(search)} className="bg-primary text-white px-4 py-2.5 rounded-xl">
          <Search size={18} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {COMMON.map(m => (
          <button key={m} onClick={() => { setSearch(m); handleSearch(m) }} className="text-xs border border-border rounded-full px-3 py-1.5 hover:bg-muted transition-colors">
            {m}
          </button>
        ))}
      </div>

      {selected && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Pill size={18} className="text-primary" />
            </div>
            <h2 className="font-semibold text-lg">{selected.name}</h2>
          </div>
          {[
            { label: 'Uses', value: selected.uses },
            { label: 'Dosage', value: selected.dosage },
            { label: 'Side Effects', value: selected.sideEffects },
            { label: 'Warnings', value: selected.warnings },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm">{value}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground border-t border-border pt-3">⚠️ This is general information only. Always consult your doctor before taking any medication.</p>
        </div>
      )}
    </div>
  )
}
