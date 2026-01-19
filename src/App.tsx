import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Box, Toolbar, CssBaseline } from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useEffect, useState } from 'react'

import LoginPage from './pages/login/page'
import BookingsPage from './pages/bookings/page'
import AccessPage from './pages/access/page'
import BugPage from './pages/bug/page'
import DocumentPage from './pages/document/page'
import MaintenancePage from './pages/maintenance/page'
import ReportPage from './pages/report/page'
import SettingsPage from './pages/settings/page'

import Sidebar from './components/Sidebar'
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
    // You could render a skeleton or simple loading state here
    return null
  }

  if (requiredPermission && currentUser && !currentUser[requiredPermission]) {
      return <Navigate to="/bookings" replace />
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', overflow: 'hidden', width: '100%' }}>
      <Sidebar 
        drawerWidth={drawerWidth} 
        open={open} 
        onToggle={onToggle} 
        onSignOut={handleSignOut}
        currentUser={currentUser}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          ml: open ? `${drawerWidth}px` : 0,
          width: open ? `calc(100% - ${drawerWidth}px)` : '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Toolbar />
        <Box sx={{ flex: 1, overflow: 'auto' }}>{children}</Box>
      </Box>
    </Box>
  )
}


function App() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
  const theme = createTheme({
    palette: {
      mode: prefersDarkMode ? 'dark' : 'light',
    },
  })

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LayoutProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          <Route path="/bookings" element={<Layout><BookingsPage /></Layout>} />
          <Route path="/access" element={<Layout requiredPermission="authorisation"><AccessPage /></Layout>} />
          <Route path="/bug" element={<Layout><BugPage /></Layout>} />
          <Route path="/document" element={<Layout><DocumentPage /></Layout>} />
          <Route path="/maintenance" element={<Layout><MaintenancePage /></Layout>} />
          <Route path="/report" element={<Layout requiredPermission="analytics"><ReportPage /></Layout>} />
          <Route path="/settings" element={<Layout requiredPermission="settings"><SettingsPage /></Layout>} />
        </Routes>
      </LayoutProvider>
    </ThemeProvider>
  )
}

export default App
