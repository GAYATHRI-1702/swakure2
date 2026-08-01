import React, { useState } from 'react'
import { Heart, ChevronDown, ChevronUp, Phone } from 'lucide-react'

const GUIDES = [
  { title: 'Heart Attack', steps: ['Call 112 immediately', 'Have the person sit or lie down comfortably', 'Loosen tight clothing', 'If conscious and not allergic, give aspirin 325mg', 'Begin CPR if person becomes unconscious and stops breathing', 'Use AED if available', 'Stay with the person until help arrives'] },
  { title: 'Choking', steps: ['Ask "Are you choking?"', 'If they cannot speak, cough or breathe — act immediately', 'Give 5 firm back blows between shoulder blades', 'Give 5 abdominal thrusts (Heimlich maneuver)', 'Alternate back blows and abdominal thrusts', 'If unconscious, call 112 and begin CPR'] },
  { title: 'Severe Bleeding', steps: ['Call 112 for severe bleeding', 'Apply firm pressure with clean cloth or bandage', 'Do not remove the cloth — add more on top if soaked', 'Elevate the injured area above heart level if possible', 'Apply tourniquet only if bleeding is life-threatening and won\'t stop', 'Keep the person warm and calm'] },
  { title: 'Burns', steps: ['Remove from heat source safely', 'Cool burn under cool (not cold) running water for 20 minutes', 'Do not use ice, butter or toothpaste', 'Cover loosely with clean non-fluffy material', 'Do not pop blisters', 'Seek medical help for burns larger than palm size or on face/hands/genitals'] },
  { title: 'Stroke (FAST)', steps: ['F - Face drooping? Ask to smile', 'A - Arm weakness? Ask to raise both arms', 'S - Speech difficulty? Ask to repeat a phrase', 'T - Time to call 112 immediately', 'Note the time symptoms started', 'Do not give food or water', 'Keep person calm and still until help arrives'] },
  { title: 'Diabetic Emergency', steps: ['If conscious and can swallow — give sugar (juice, glucose tablets, candy)', 'Wait 15 minutes and recheck', 'If no improvement, give more sugar', 'If unconscious — do not give anything by mouth', 'Call 112 immediately', 'Place in recovery position if unconscious'] },
]

const EMERGENCY = [
  { label: 'Emergency', number: '112' },
  { label: 'Ambulance', number: '102' },
  { label: 'Police', number: '100' },
  { label: 'Fire', number: '101' },
]

export default function FirstAid() {
  const [open, setOpen] = useState(null)

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="font-poppins font-bold text-2xl">First Aid</h1>
        <p className="text-muted-foreground text-sm">Emergency guides and quick-dial contacts.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {EMERGENCY.map(e => (
          <a key={e.number} href={`tel:${e.number}`} className="bg-red-50 border border-red-100 rounded-2xl p-4 flex flex-col items-center gap-2 hover:bg-red-100 transition-colors">
            <Phone size={20} className="text-red-600" />
            <p className="font-bold text-red-600 text-lg">{e.number}</p>
            <p className="text-xs text-red-600">{e.label}</p>
          </a>
        ))}
      </div>

      <div className="space-y-3">
        {GUIDES.map(g => (
          <div key={g.title} className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpen(open === g.title ? null : g.title)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <Heart size={18} className="text-red-500 shrink-0" />
                <span className="font-medium">{g.title}</span>
              </div>
              {open === g.title ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
            </button>
            {open === g.title && (
              <div className="px-4 pb-4">
                <ol className="space-y-2">
                  {g.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
