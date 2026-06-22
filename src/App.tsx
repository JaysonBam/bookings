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
    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login')
        return
      }

      if (session.user.email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, profile_url, settings, authorisation, analytics')
          .eq('email', session.user.email)
          .single()

        if (profile) {
          setCurrentUser({
            name: profile.full_name || session.user.user_metadata.full_name || 'User',
            avatarUrl: profile.profile_url || session.user.user_metadata.avatar_url || session.user.user_metadata.picture || undefined,
            settings: profile.settings,
            authorisation: profile.authorisation,
            analytics: profile.analytics,
          })
        }
      } else {
         setCurrentUser({
             name: session.user.user_metadata.full_name || 'User',
             avatarUrl: session.user.user_metadata.avatar_url || session.user.user_metadata.picture || undefined,
         })
      }
      setLoading(false)
    }

    getProfile()
  }, [navigate])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
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
