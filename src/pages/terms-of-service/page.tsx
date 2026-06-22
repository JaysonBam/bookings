import { Container, Typography, Box, Link, Divider, Paper, Stack } from '@mui/material';

const TermsOfServicePage = () => {
    return (
        <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
            <Paper elevation={0} variant="outlined" sx={{ p: { xs: 3, md: 5 } }}>
                <Typography variant="h3" component="h1" gutterBottom>
                    Terms of Service
                </Typography>
                <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                    Last Updated: June 22, 2026
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                    <Link href="/about">App Overview</Link>
                    <Link href="/privacy">Privacy Policy</Link>
                    <Link href="/login">Staff Sign In</Link>
                </Stack>

                <Box sx={{ my: 4 }}>
                    <Typography variant="body1" paragraph>
                        These Terms of Service apply to MISC Bookings, an internal University of Pretoria departmental application for managing Mining Industry Study Centre room bookings. By using the app, you confirm that you are an authorized departmental staff user and agree to use it only for approved internal purposes.
                    </Typography>
                </Box>

                <Divider sx={{ my: 4 }} />

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Authorized Internal Use
                    </Typography>
                    <Typography variant="body1" paragraph>
                        This app is provided for authorized staff who manage study room bookings, room settings, access permissions, internal reports, and related operational records. Students do not log into this app. You must not access or use the app unless you have been approved by the department.
                    </Typography>
                    <Typography variant="body1" paragraph>
                        You may use information in the app only for legitimate university or departmental administration, support, reporting, and room management purposes.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        User Responsibilities
                    </Typography>
                    <Typography variant="body1" paragraph>
                        You are responsible for keeping your Google account secure, signing out on shared devices, entering accurate booking information, and handling staff and student-related booking data appropriately. Do not enter unnecessary sensitive information into booking notes, bug reports, room labels, or other free-text fields.
                    </Typography>
                    <Typography variant="body1" paragraph>
                        You must not share access, attempt to bypass authorization controls, export information for unauthorized purposes, or use the app in a way that conflicts with university policies or applicable law.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Google Sign-In
                    </Typography>
                    <Typography variant="body1" paragraph>
                        The app uses Google only for staff sign-in and identity verification. It requests basic identity scopes only: <code>openid</code>, <code>email</code>, and <code>profile</code>. The app does not access Gmail, Google Drive, Google Calendar, Google Contacts, or other Google API content.
                    </Typography>
                    <Typography variant="body1" paragraph>
                        Your use of Google sign-in is also subject to the <Link href="https://policies.google.com/terms" target="_blank" rel="noopener">Google Terms of Service</Link>.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Data and Records
                    </Typography>
                    <Typography variant="body1" paragraph>
                        Booking, profile, access-control, reporting, bug report, and operational records may be stored and used for internal administration, support, audit, and reporting. See the <Link href="/privacy">Privacy Policy</Link> for more detail.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Availability and Support
                    </Typography>
                    <Typography variant="body1" paragraph>
                        The app is provided for internal operational use and may be changed, suspended, or restricted as needed by the department or university. For access, support, privacy, or deletion requests, contact the departmental app administrator or the support contact configured on the Google OAuth consent screen.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Compliance
                    </Typography>
                    <Typography variant="body1" paragraph>
                        You must comply with applicable university policies, departmental instructions, and applicable South African law when using the app.
                    </Typography>
                </Box>
            </Paper>
        </Container>
    );
};

export default TermsOfServicePage;
