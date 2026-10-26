import React from 'react'
import { Link } from 'react-router-dom'
import { Stethoscope, Phone, MapPin, Calendar } from 'lucide-react'
import { DOCTORS } from '@/lib/doctors'

export default function Doctors() {
  const [search, setSearch] = React.useState('')
  const filtered = DOCTORS.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.specialty.toLowerCase().includes(search.toLowerCase()) ||
    d.city.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="font-poppins font-bold text-2xl">Doctors</h1>
        <p className="text-muted-foreground text-sm">Find and contact doctors near you.</p>
      </div>
      <input
        placeholder="Search by name, specialty or city..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map(d => (
          <div key={d.name} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Stethoscope size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{d.name}</p>
                <p className="text-sm text-primary">{d.specialty}</p>
                <div className="flex items-center gap-1 mt-1">
                  <MapPin size={12} className="text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{d.hospital}, {d.city}</p>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <a href={`tel:${d.phone}`} className="flex items-center gap-1 text-xs text-primary">
                    <Phone size={12} /> {d.phone}
                  </a>
                  <Link to={`/appointments?doctor=${encodeURIComponent(d.name)}`} className="flex items-center gap-1 text-xs text-primary font-medium">
                    <Calendar size={12} /> Book appointment
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
