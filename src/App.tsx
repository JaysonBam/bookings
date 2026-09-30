/**
 * Purpose: Module logic for App.tsx.
 */
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Box, Button, CircularProgress, Skeleton, Toolbar, Typography } from '@mui/material'
import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { CustomThemeProvider } from './context/ThemeContext'
import { SessionProvider, useSession } from './context/SessionContext'

import LoginPage from './pages/login/page'
const AboutPage = lazy(() => import('./pages/about/page'))
const BookingsPage = lazy(() => import('./pages/bookings/page'))
const CollectionsPage = lazy(() => import('./pages/collections/page'))
const AccessPage = lazy(() => import('./pages/access/page'))
const BugPage = lazy(() => import('./pages/bug/page'))
const DocumentPage = lazy(() => import('./pages/document/page'))
const MaintenancePage = lazy(() => import('./pages/maintenance/page'))
const PrivacyPolicyPage = lazy(() => import('./pages/privacy-policy/page'))
const ReportPage = lazy(() => import('./pages/report/page'))
const SettingsPage = lazy(() => import('./pages/settings/page'))
const TermsOfServicePage = lazy(() => import('./pages/terms-of-service/page'))

import Sidebar from './components/Sidebar'
import Header from './components/header'
import { LayoutProvider, useLayout } from './components/LayoutContext'
import { signOut } from './api/supabase/auth'
import { canUseCollections, hasAppAccess, isTemporaryProfile } from './lib/accountAccess'

type User = {
  name: string
  avatarUrl?: string
  authorisation?: boolean
  analytics?: boolean
  settings?: boolean
  isTemporary?: boolean
}

function Layout({ children, requiredPermission, regularOnly = false }: {
  children: React.ReactNode, requiredPermission?: keyof User, regularOnly?: boolean
}) {
  const { open, onToggle, drawerWidth } = useLayout()
  const navigate = useNavigate()
  const location = useLocation()
  const { session, profile, loading } = useSession()
  const currentUser: User | undefined = session ? {
    name: profile?.full_name || session.user.user_metadata.full_name || 'User',
    avatarUrl: profile?.profile_url || session.user.user_metadata.avatar_url || session.user.user_metadata.picture || undefined,
    settings: profile?.settings,
    authorisation: profile?.authorisation,
    analytics: profile?.analytics,
    isTemporary: isTemporaryProfile(profile),
  } : undefined

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  if (loading) {
    return <AppShellLoading />
  }

  if (!session || !hasAppAccess(profile)) return <Navigate to="/login" replace />
  if (regularOnly && !canUseCollections(profile)) return <Navigate to="/bookings" replace />

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
          <Suspense fallback={<RouteLoading />}>
            {children}
          </Suspense>
        </Box>
      </Box>
    </Box>
  )
}

function AppShellLoading() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ display: { xs: 'none', md: 'block' }, width: 280, p: 2, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 1, mb: 3 }} />
        {[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} height={44} sx={{ mb: 1 }} />)}
      </Box>
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={32} aria-label="Loading application" />
      </Box>
    </Box>
  )
}

const RouteLoading = () => (
  <Box sx={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
    <CircularProgress size={30} aria-label="Loading page" />
  </Box>
)

class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unable to load application route', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, bgcolor: 'background.default' }}>
        <Box sx={{ textAlign: 'center', maxWidth: 420 }}>
          <Typography variant="h6" gutterBottom>Unable to load this page</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            The application may have been updated while it was open.
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>Reload application</Button>
        </Box>
      </Box>
    )
  }
}


function App() {
  return (
    <CustomThemeProvider>
      <SessionProvider>
        <LayoutProvider>
          <RouteErrorBoundary>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
          <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />

          <Route path="/bookings" element={<Layout><BookingsPage /></Layout>} />
          <Route path="/collections" element={<Layout regularOnly><CollectionsPage /></Layout>} />
          <Route path="/access" element={<Layout requiredPermission="authorisation"><AccessPage /></Layout>} />
          <Route path="/bug" element={<Layout><BugPage /></Layout>} />
          <Route path="/document" element={<Layout><DocumentPage /></Layout>} />
          <Route path="/maintenance" element={<Layout><MaintenancePage /></Layout>} />
          <Route path="/report" element={<Layout requiredPermission="analytics"><ReportPage /></Layout>} />
          <Route path="/settings" element={<Layout requiredPermission="settings"><SettingsPage /></Layout>} />
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </LayoutProvider>
      </SessionProvider>
    </CustomThemeProvider>
  )
}

export default App
