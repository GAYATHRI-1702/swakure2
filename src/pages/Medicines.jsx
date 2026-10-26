import React, { useState, useRef } from 'react'
import { Pill, Search } from 'lucide-react'
import { matchMedicines, resolveMedicineName } from '@/lib/medicineSearch'

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

const MEDICINE_NAMES = Object.keys(INFO)

export default function Medicines() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const inputRef = useRef(null)

  const suggestions = matchMedicines(MEDICINE_NAMES, search)
  const showList = open && search.trim().length > 0

  const handleSearch = (typed) => {
    // Match the dataset case-insensitively so "metformin" opens the Metformin entry.
    const name = resolveMedicineName(MEDICINE_NAMES, typed) ?? typed.trim()
    setSelected(INFO[name] ? { name, ...INFO[name] } : { name, uses: 'Information not available in offline mode.', dosage: '-', sideEffects: '-', warnings: 'Consult your doctor or pharmacist.' })
    setOpen(false)
    setActive(-1)
  }

  const choose = (name) => {
    setSearch(name)
    handleSearch(name)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      if (suggestions.length) setActive(i => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (suggestions.length) setActive(i => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (showList && active >= 0 && suggestions[active]) choose(suggestions[active])
      else if (search.trim()) handleSearch(search)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="font-poppins font-bold text-2xl">Medicines</h1>
        <p className="text-muted-foreground text-sm">Search for medicine information.</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={showList}
            aria-controls="medicine-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `medicine-option-${active}` : undefined}
            placeholder="Search medicine name..."
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); setActive(-1) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {showList && (
            <ul id="medicine-suggestions" role="listbox" className="absolute z-20 left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
              {suggestions.length === 0 ? (
                <li className="px-4 py-2.5 text-sm text-muted-foreground">No matching medicines. Press Enter to search anyway.</li>
              ) : suggestions.map((name, i) => (
                <li
                  key={name}
                  id={`medicine-option-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown (not click) so the choice registers before the input blurs
                  onMouseDown={e => { e.preventDefault(); choose(name) }}
                  onMouseEnter={() => setActive(i)}
                  className={`px-4 py-2.5 text-sm cursor-pointer flex items-center gap-2 ${i === active ? 'bg-muted' : ''}`}
                >
                  <Pill size={14} className="text-primary shrink-0" />
                  <span>{name}</span>
                  <span className="text-xs text-muted-foreground truncate">· {INFO[name].uses}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button onClick={() => search.trim() && handleSearch(search)} aria-label="Search" className="bg-primary text-white px-4 py-2.5 rounded-xl">
          <Search size={18} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {COMMON.map(m => (
          <button key={m} onClick={() => choose(m)} className="text-xs border border-border rounded-full px-3 py-1.5 hover:bg-muted transition-colors">
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
