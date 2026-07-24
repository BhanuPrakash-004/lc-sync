import { Routes, Route, Navigate } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import { useAuth } from './lib/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Problems from './pages/Problems'
import ProblemDetail from './pages/ProblemDetail'
import Revision from './pages/Revision'
import Settings from './pages/Settings'
import SetupPage from './pages/SetupPage'
import TopicsManager from './pages/TopicsManager'
import RecentSubmissions from './pages/RecentSubmissions'
import DownloadPDF from './pages/DownloadPDF'
import LoginPage from './pages/LoginPage'


function App() {
  const { isLoggedIn, isLoading } = useAuth()

  // Show setup page if Supabase is not configured
  if (!isSupabaseConfigured()) {
    return <SetupPage />
  }

  // While Supabase is checking the existing session on page load/refresh
  // show a minimal spinner so the user doesn't see a flash of the login page
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center animate-pulse">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white stroke-current">
              <path d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-6.3 2.55" />
              <path d="M3 12a9 9 0 0 0 9 9 9 9 0 0 0 6.3-2.55" />
              <polyline points="3 3 3 7 7 7" />
              <polyline points="21 21 21 17 17 17" />
            </svg>
          </div>
          <p className="text-zinc-600 text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!isLoggedIn) {
    return <LoginPage />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/"                element={<Dashboard />} />
        <Route path="/revision"        element={<Revision />} />
        <Route path="/revision/:topic" element={<Revision />} />
        <Route path="/problems"        element={<Problems />} />
        <Route path="/problems/:id"    element={<ProblemDetail />} />
        <Route path="/settings"        element={<Settings />} />
        <Route path="/topics"          element={<TopicsManager />} />
        <Route path="/recent"          element={<RecentSubmissions />} />
        <Route path="/download-pdf"    element={<DownloadPDF />} />
        <Route path="*"                element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
