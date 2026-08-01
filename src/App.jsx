import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { LanguageProvider } from './lib/LanguageContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import HealthMonitor from './pages/HealthMonitor'
import Medicines from './pages/Medicines'
import Doctors from './pages/Doctors'
import Appointments from './pages/Appointments'
import Prescriptions from './pages/Prescriptions'
import Reminders from './pages/Reminders'
import FirstAid from './pages/FirstAid'
import AIAssistant from './pages/AIAssistant'
import Settings from './pages/Settings'

const queryClient = new QueryClient()

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="health-monitor" element={<HealthMonitor />} />
                <Route path="medicines" element={<Medicines />} />
                <Route path="doctors" element={<Doctors />} />
                <Route path="appointments" element={<Appointments />} />
                <Route path="prescriptions" element={<Prescriptions />} />
                <Route path="reminders" element={<Reminders />} />
                <Route path="first-aid" element={<FirstAid />} />
                <Route path="ai-assistant" element={<AIAssistant />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
