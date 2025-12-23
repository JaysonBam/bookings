import { Routes, Route, Navigate } from 'react-router-dom'
import { Box, Toolbar, CssBaseline } from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

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
  const { open, onToggle, drawerWidth } = useLayout()
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', overflow: 'hidden', width: '100%' }}>
      <Sidebar drawerWidth={drawerWidth} open={open} onToggle={onToggle} />
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
