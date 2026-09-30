import { Box, Button, Container, Paper, Typography, Stack, Alert, Link } from '@mui/material';
import GoogleColorIcon from './components/GoogleIcon'
import { useTheme } from '@mui/material/styles'
import { styles as makeStyles } from './styles'
import logo from '../../assets/logo.svg'
import { signInWithGoogle, signOut } from '../../api/supabase/auth'
import { updateProfile } from '../../api/supabase/profiles'
import { useSession } from '../../context/SessionContext'
import { useState, useEffect, useRef } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showBackground, setShowBackground] = useState(false)
  const navigate = useNavigate()
  const { session, profile, loading: sessionLoading, refresh } = useSession()
  const handledUserId = useRef<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowBackground(true), 100)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (sessionLoading) return
    if (!session) {
      handledUserId.current = null
      setLoading(false)
      return
    }
    if (handledUserId.current === session.user.id) return
    handledUserId.current = session.user.id

    const checkUser = async () => {
      try {
        setLoading(true)
        const user = session.user
        const email = user.email

        if (!email) throw new Error('No email found')

        if (!profile) {
          await signOut()
          setErrorMsg('Access denied, contact admin for access')
          setLoading(false)
          return
        }

        const updates = {
            full_name: user.user_metadata.full_name || user.user_metadata.name,
            profile_url: user.user_metadata.avatar_url || user.user_metadata.picture,
        }

        const bookingPagePromise = import('../bookings/page')
        if (profile.status === 'pending') {
            await updateProfile(email, {
                ...updates,
                id: user.id,
                status: 'active'
            })
        } else {
            await updateProfile(email, updates)
        }

        await Promise.all([refresh(), bookingPagePromise])
        navigate('/bookings')
      } catch (err) {
        console.error('Auth error:', err)
        setErrorMsg('Authentication error occurred.')
        await signOut()
        setLoading(false)
      }
    }

    void checkUser()
  }, [navigate, profile, refresh, session, sessionLoading])

  return (
    <Box sx={styles.root}>
      <Box aria-hidden sx={{ ...styles.background, opacity: showBackground ? 1 : 0, transition: 'opacity 240ms ease-out' }} />
      <Box aria-hidden sx={styles.bgOverlay} />
      <Container maxWidth="sm" disableGutters sx={styles.container}>
        <Paper elevation={0} sx={styles.paper}>
          <Stack alignItems="center" sx={styles.stack}>
            <Box
              component="img"
              src={logo}
              alt="MISC Logo"
              sx={{
                ...styles.logo,
                filter: theme.palette.mode === 'dark' ? 'invert(1) brightness(1)' : 'none',
              }}
            />
            <Box sx={styles.titleBox}>
              <Typography component="h1" variant="h5" sx={styles.title}>
                MISC Bookings
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={styles.subtitle}>
                Mining Industry Study Centre bookings system
              </Typography>
            </Box>

            {errorMsg && (
                <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                    {errorMsg}
                </Alert>
            )}

            <Button
              fullWidth
              variant="outlined"
              size="large"
              sx={styles.googleBtn}
              onClick={async () => {
                try {
                  setLoading(true)
                  setErrorMsg(null)
                  await signInWithGoogle(`${window.location.origin}/login`)
                } catch (err) {
                  console.error('Google sign-in error', err)
                  setErrorMsg('Failed to initiate Google sign-in')
                  setLoading(false)
                }
              }}
              startIcon={<GoogleColorIcon />}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in with Google'}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={styles.legalLinks}>
              For authorized departmental staff only. By signing in, you confirm you are authorized to use this internal departmental app. Review the{' '}
              <Link component={RouterLink} to="/about">app overview</Link>,{' '}
              <Link component={RouterLink} to="/privacy">privacy policy</Link>, and{' '}
              <Link component={RouterLink} to="/terms">terms</Link>.
            </Typography>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
