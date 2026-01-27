import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Box, Toolbar, CssBaseline } from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useEffect, useState, useMemo } from 'react'

import LoginPage from './pages/login/page'
import BookingsPage from './pages/bookings/page'
import AccessPage from './pages/access/page'
import BugPage from './pages/bug/page'
import DocumentPage from './pages/document/page'
import MaintenancePage from './pages/maintenance/page'
import ReportPage from './pages/report/page'
import SettingsPage from './pages/settings/page'

import Sidebar from './components/Sidebar'
import Header from './components/header'
import { LayoutProvider, useLayout } from './components/LayoutContext'
import { ThemeContext } from './components/ThemeContext'
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
         // Fallback if no db profile found yet but session has info? (Should rarely happen due to login logic)
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
    // You could render a skeleton or simple loading state here
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
          p: location.pathname === '/bookings' ? 0 : 3,
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
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0, // CRITICAL: allows flex child to shrink below content size
          overflow: location.pathname === '/bookings' ? 'hidden' : 'auto' 
        }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}


function App() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
  
  const [mode, setMode] = useState<'light' | 'dark' | null>(() => {
    const savedMode = localStorage.getItem('themeMode')
    return (savedMode === 'light' || savedMode === 'dark') ? savedMode : null
  })

  const effectiveMode = mode ?? (prefersDarkMode ? 'dark' : 'light')

  const theme = useMemo(() => createTheme({
    palette: {
      mode: effectiveMode,
      primary: effectiveMode === 'light' 
        ? { main: '#1e293b', light: '#334155', dark: '#0f172a', contrastText: '#ffffff' } // Slate 800
        : { main: '#e2e8f0', light: '#f1f5f9', dark: '#cbd5e1', contrastText: '#0f172a' }, // Slate 200
      secondary: {
        main: effectiveMode === 'light' ? '#64748b' : '#94a3b8', // Slate 500 / 400
      },
      background: effectiveMode === 'light'
        ? { default: '#f8fafc', paper: '#ffffff' } // Slate 50
        : { default: '#0f172a', paper: '#1e293b' }, // Slate 900 / 800
      text: effectiveMode === 'light'
        ? { primary: '#0f172a', secondary: '#475569' } // Slate 900 / 600
        : { primary: '#f8fafc', secondary: '#94a3b8' }, // Slate 50 / 400
    },
    shape: {
      borderRadius: 8, // reduced from 12 to prevent text cutoff in narrow containers
    },
    typography: {
      fontFamily: '"Inter", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
      h6: {
        fontWeight: 700,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: effectiveMode === 'dark' ? '#334155 #0f172a' : '#cbd5e1 #f1f5f9',
            "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
              backgroundColor: "transparent",
              width: "8px",
              height: "8px",
            },
            "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
              borderRadius: "8px",
              backgroundColor: effectiveMode === 'dark' ? "#334155" : "#cbd5e1", 
              minHeight: 24,
            },
            "&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus": {
              backgroundColor: effectiveMode === 'dark' ? "#475569" : "#94a3b8",
            },
          }
        }
      },
      MuiAppBar: {
        defaultProps: {
          elevation: 0,
          color: 'inherit',
        },
        styleOverrides: {
          root: {
            backgroundColor: effectiveMode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(30, 41, 59, 0.9)', // Slight transparency
            backdropFilter: 'blur(8px)',
            borderBottom: `1px solid ${effectiveMode === 'light' ? '#e2e8f0' : '#334155'}`,
            color: effectiveMode === 'light' ? '#0f172a' : '#f8fafc',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: effectiveMode === 'light' ? '#ffffff' : '#1e293b',
            borderRight: `1px solid ${effectiveMode === 'light' ? '#e2e8f0' : '#334155'}`,
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8, // consistent with shape.borderRadius
            padding: '8px 16px',
          },
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            border: `1px solid ${effectiveMode === 'light' ? '#e2e8f0' : '#334155'}`,
            borderRadius: 12, // Keep cards slightly more rounded if desired, or sync with globally 8
          },
        },
      },
      MuiDialog: {
         styleOverrides: {
            paper: {
                borderRadius: 16,
                border: `1px solid ${effectiveMode === 'light' ? '#e2e8f0' : '#334155'}`,
            }
         }
      },
      MuiPaper: {
        defaultProps: {
             elevation: 0,
        },
        styleOverrides: {
            root: {
                backgroundImage: 'none', // Remove MUI default gradient overlay in dark mode
            }
        }
      }
    },
  }), [effectiveMode])

  const colorMode = useMemo(() => ({
    mode: effectiveMode,
    toggleColorMode: () => {
      setMode((prevMode) => {
        const currentMode = prevMode ?? (prefersDarkMode ? 'dark' : 'light')
        const nextMode = currentMode === 'light' ? 'dark' : 'light'
        localStorage.setItem('themeMode', nextMode)
        return nextMode
      })
    },
  }), [effectiveMode, prefersDarkMode])

  return (
    <ThemeContext.Provider value={colorMode}>
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
    </ThemeContext.Provider>
  )
}

export default App
