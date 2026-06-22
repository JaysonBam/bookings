import { Box, Container, Divider, Link, Paper, Stack, Typography } from '@mui/material'

export default function AboutPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: { xs: 4, md: 8 } }}>
      <Container maxWidth="md">
        <Paper elevation={0} variant="outlined" sx={{ p: { xs: 3, md: 5 } }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h3" component="h1" gutterBottom>
                MISC Bookings
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Internal study room booking management for authorized departmental staff.
              </Typography>
            </Box>

            <Divider />

            <Typography variant="body1" paragraph>
              MISC Bookings is an internal University of Pretoria departmental application used by authorized staff to manage Mining Industry Study Centre room bookings. Staff use the app to create, update, search, and report on study room bookings, room availability, course allocations, borrowed room items, and operational settings.
            </Typography>

            <Typography variant="body1" paragraph>
              Students do not log into this application. Booking information may include student numbers or student counts entered by staff so that rooms can be managed and utilization reports can be produced for internal administration.
            </Typography>

            <Typography variant="body1" paragraph>
              Google is used only for staff sign-in and identity verification. The app requests basic identity information only and does not access Gmail, Google Drive, Google Calendar, Google Contacts, or other Google API content.
            </Typography>

            <Box>
              <Typography variant="h5" component="h2" gutterBottom>
                Public Information
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Link href="/privacy">Privacy Policy</Link>
                <Link href="/terms">Terms of Service</Link>
                <Link href="/login">Staff Sign In</Link>
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
