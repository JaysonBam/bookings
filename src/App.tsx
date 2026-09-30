/**
 * Purpose: Module logic for App.tsx.
 */
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Box, Toolbar } from '@mui/material' 
import { useEffect, useState } from 'react'
import { CustomThemeProvider } from './context/ThemeContext'

import LoginPage from './pages/login/page'
import AboutPage from './pages/about/page'
import BookingsPage from './pages/bookings/page'
import CollectionsPage from './pages/collections/page'
import AccessPage from './pages/access/page'
import BugPage from './pages/bug/page'
import DocumentPage from './pages/document/page'
import MaintenancePage from './pages/maintenance/page'
import PrivacyPolicyPage from './pages/privacy-policy/page'
import ReportPage from './pages/report/page'
import SettingsPage from './pages/settings/page'
import TermsOfServicePage from './pages/terms-of-service/page'

import Sidebar from './components/Sidebar'
import Header from './components/header'
import { LayoutProvider, useLayout } from './components/LayoutContext'
import { supabase } from './lib/supabaseClient'
import { hasProfileAccess } from './lib/accessExpiry'

type User = {
  name: string
  avatarUrl?: string
  authorisation?: boolean
  analytics?: boolean
  settings?: boolean
}

function Layout({ children, requiredPermission }: { children: React.ReactNode, requiredPermission?: keyof User }) {
  const { open, onToggle, drawerWidth } = useLayout()
  const navigate = useNavigate()
  const location = useLocation()
  const [currentUser, setCurrentUser] = useState<User | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    let checking = false
    let expiryTimer: ReturnType<typeof setTimeout> | undefined
    const getProfile = async () => {
      if (checking || cancelled) return
      checking = true
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        const { data: profile, error } = session?.user.email && !sessionError ? await supabase
          .from('profiles')
          .select('full_name, profile_url, settings, authorisation, analytics, access_expires_at')
          .eq('email', session.user.email)
          .single() : { data: null, error: null }
        if (cancelled) return
        if (!session || !profile || error || !hasProfileAccess(profile)) {
          setCurrentUser(undefined)
          setLoading(true)
          navigate('/login', { replace: true })
          if (session) await supabase.auth.signOut({ scope: 'local' })
          return
        }

        setCurrentUser({
          name: profile.full_name || session.user.user_metadata.full_name || 'User',
          avatarUrl: profile.profile_url || session.user.user_metadata.avatar_url || session.user.user_metadata.picture || undefined,
          settings: profile.settings,
          authorisation: profile.authorisation,
          analytics: profile.analytics,
        })
        setLoading(false)
        clearTimeout(expiryTimer)
        if (profile.access_expires_at) {
          expiryTimer = setTimeout(getProfile, Math.min(2_147_483_647, Math.max(0, Date.parse(profile.access_expires_at) - Date.now())))
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(undefined)
          setLoading(true)
          navigate('/login', { replace: true })
        }
      } finally {
        checking = false
      }
    }

    getProfile()
    // Backend enforcement is immediate. These checks also close an already-open
    // screen after expiry/deactivation and refresh permissions on navigation/focus.
    const interval = setInterval(getProfile, 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') getProfile() }
    window.addEventListener('focus', getProfile)
    document.addEventListener('visibilitychange', onVisible)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      // Keep Supabase calls outside its auth callback to avoid a session-lock wait.
      queueMicrotask(getProfile)
    })
    return () => {
      cancelled = true
      clearTimeout(expiryTimer)
      clearInterval(interval)
      window.removeEventListener('focus', getProfile)
      document.removeEventListener('visibilitychange', onVisible)
      subscription.unsubscribe()
    }
  }, [navigate, location.pathname])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading || !currentUser) {
    return null
  }

  if (requiredPermission && currentUser && !currentUser[requiredPermission]) {
      return <Navigate to="/bookings" replace />
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', width: '100%' }}>
      <Sidebar 
        drawerWidth={drawerWidth} 
        open={open} 
        onToggle={onToggle} 
        onSignOut={handleSignOut}
        currentUser={currentUser}
      />
      <Header />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 0,
          ml: open ? `${drawerWidth}px` : 0,
          width: open ? `calc(100% - ${drawerWidth}px)` : '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh', // Explicitly strict height
          overflow: 'hidden',
        }}
      >
        <Toolbar />
        <Box sx={{ 
          flex: 1, 
          display: location.pathname === '/bookings' ? 'flex' : 'block',
          flexDirection: 'column',
          minHeight: 0,
          overflow: location.pathname === '/bookings' ? 'hidden' : 'auto',
          bgcolor: 'background.default',
          pt: location.pathname === '/bookings' ? 0 : { xs: 2, md: 3 },
          px: location.pathname === '/bookings' ? 0 : { xs: 1, md: 3 },
          pb: location.pathname === '/bookings' ? 0 : { xs: 8, md: 10 }
        }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}


function App() {
  return (
    <CustomThemeProvider>
      <LayoutProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
          <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />

          <Route path="/bookings" element={<Layout><BookingsPage /></Layout>} />
          <Route path="/collections" element={<Layout><CollectionsPage /></Layout>} />
          <Route path="/access" element={<Layout requiredPermission="authorisation"><AccessPage /></Layout>} />
          <Route path="/bug" element={<Layout><BugPage /></Layout>} />
          <Route path="/document" element={<Layout><DocumentPage /></Layout>} />
          <Route path="/maintenance" element={<Layout><MaintenancePage /></Layout>} />
          <Route path="/report" element={<Layout requiredPermission="analytics"><ReportPage /></Layout>} />
          <Route path="/settings" element={<Layout requiredPermission="settings"><SettingsPage /></Layout>} />
        </Routes>
      </LayoutProvider>
    </CustomThemeProvider>
  )
}

export default App
