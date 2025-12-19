import { Routes, Route, Navigate } from 'react-router-dom'
import { Box, Toolbar, CssBaseline } from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useState } from 'react'

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

function Layout({ children }: { children: React.ReactNode }) {
  const { isMobile, open, mobileOpen, onToggle, drawerWidth } = useLayout()
  return (
    <Box sx={{ display: 'flex' }}>
      <Sidebar drawerWidth={drawerWidth} open={open} mobileOpen={mobileOpen} isMobile={isMobile} onToggle={onToggle} />
      <Box component="main" sx={{ flexGrow: 1, p: 3, ml: open && !isMobile ? `${drawerWidth}px` : 0 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  )
}


function App() {
  // Use system theme
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
  const theme = createTheme({
    palette: {
      mode: prefersDarkMode ? 'dark' : 'light',
    },
  })
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [open, setOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleToggle = () => {
    if (isMobile) setMobileOpen((s) => !s)
    else setOpen((s) => !s)
  }

  const ctxValue = {
    isMobile,
    open,
    mobileOpen,
    drawerWidth: 280,
    onToggle: handleToggle,
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LayoutProvider value={ctxValue}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          <Route path="/bookings" element={<Layout><BookingsPage /></Layout>} />
          <Route path="/access" element={<Layout><AccessPage /></Layout>} />
          <Route path="/bug" element={<Layout><BugPage /></Layout>} />
          <Route path="/document" element={<Layout><DocumentPage /></Layout>} />
          <Route path="/maintenance" element={<Layout><MaintenancePage /></Layout>} />
          <Route path="/report" element={<Layout><ReportPage /></Layout>} />
          <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />
        </Routes>
      </LayoutProvider>
    </ThemeProvider>
  )
}

export default App
