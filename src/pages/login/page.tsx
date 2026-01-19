import { Box, Button, Container, Paper, Typography, Stack } from '@mui/material';
import GoogleColorIcon from './components/GoogleIcon'
import { useTheme } from '@mui/material/styles'
import { styles as makeStyles } from './styles'
import logo from '../../assets/logo.svg'
import { supabase } from '../../lib/supabaseClient'
import { useState } from 'react'

export default function LoginPage() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [loading, setLoading] = useState(false)

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

            <Button
              fullWidth
              variant="outlined"
              size="large"
              sx={styles.googleBtn}
              onClick={async () => {
                try {
                  setLoading(true)
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `${window.location.origin}/bookings`,
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