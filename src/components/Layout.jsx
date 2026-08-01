import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useLanguage } from '../lib/LanguageContext'
import {
  LayoutDashboard, Activity, Pill, Stethoscope, Calendar,
  FileText, Bell, Heart, Bot, Settings, LogOut, Menu, X, ChevronDown
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/health-monitor', icon: Activity, key: 'healthMonitor' },
  { to: '/medicines', icon: Pill, key: 'medicines' },
  { to: '/doctors', icon: Stethoscope, key: 'doctors' },
  { to: '/appointments', icon: Calendar, key: 'appointments' },
  { to: '/prescriptions', icon: FileText, key: 'prescriptions' },
  { to: '/reminders', icon: Bell, key: 'reminders' },
  { to: '/first-aid', icon: Heart, key: 'firstAid' },
  { to: '/ai-assistant', icon: Bot, key: 'aiAssistant' },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const { tr, lang, setLanguage, LANGUAGES } = useLanguage()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const currentLang = LANGUAGES.find(l => l.code === lang)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Heart size={18} className="text-white" />
          </div>
          <div>
            <p className="font-poppins font-bold text-foreground">Swakure</p>
            <p className="text-xs text-muted-foreground">Your AI Health Companion</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            <Icon size={18} />
            {tr(key)}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border space-y-1">
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <span className="text-base">🌐</span>
            <span className="flex-1 text-left">{currentLang?.name}</span>
            <ChevronDown size={14} />
          </button>
          {langOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => { setLanguage(l.code); setLangOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${lang === l.code ? 'text-primary font-medium' : 'text-foreground'}`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <NavLink
          to="/settings"
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`
          }
        >
          <Settings size={18} />
          {tr('settings')}
        </NavLink>

        <div className="px-3 py-2">
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut size={18} />
          {tr('logout')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-muted">
            <Menu size={20} />
          </button>
          <span className="font-poppins font-bold text-foreground">Swakure</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
