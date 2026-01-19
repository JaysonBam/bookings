import { Box, Button, Container, Paper, Typography, Stack, Alert } from '@mui/material';
import GoogleColorIcon from './components/GoogleIcon'
import { useTheme } from '@mui/material/styles'
import { styles as makeStyles } from './styles'
import logo from '../../assets/logo.svg'
import { supabase } from '../../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [loading, setLoading] = useState(() => {
    const hash = window.location.hash
    const search = window.location.search
    return hash.includes('access_token') || hash.includes('refresh_token') || search.includes('code')
  })
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const user = session.user
        const email = user.email

        if (!email) throw new Error('No email found')

        // Check if user exists in profiles
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .single()

        if (profileError || !profile) {
            await supabase.auth.signOut()
            setErrorMsg('Access denied, contact admin for access')
            setLoading(false)
            return
        }

        // Handle profile updates based on status
        console.log('User metadata:', user.user_metadata)
        const updates = {
            full_name: user.user_metadata.full_name || user.user_metadata.name,
            profile_url: user.user_metadata.avatar_url || user.user_metadata.picture,
        }

        if (profile.status === 'pending') {
            await supabase.from('profiles').update({
                ...updates,
                id: user.id,
                status: 'active'
            }).eq('email', email)
        } else {
            // Check if updates are needed to avoid unnecessary writes? 
            // The prompt says "just update it to make sure that we are using the newest name"
            await supabase.from('profiles').update(updates).eq('email', email)
        }

        navigate('/bookings')
      } catch (err) {
        console.error('Auth error:', err)
        setErrorMsg('Authentication error occurred.')
        await supabase.auth.signOut()
        setLoading(false)
      }
    }

    checkUser()
  }, [navigate])

  return (
    <Box sx={styles.root}>
      <Box aria-hidden sx={styles.background} />
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
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `${window.location.origin}/login`,
                    },
                  })
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error('Google sign-in error', err)
                  setLoading(false)
                }
              }}
              startIcon={<GoogleColorIcon />}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in with Google'}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}