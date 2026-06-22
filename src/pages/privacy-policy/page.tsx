import { Container, Typography, Box, Link, Divider, Paper, Stack } from '@mui/material';

const PrivacyPolicyPage = () => {
    return (
        <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
            <Paper elevation={0} variant="outlined" sx={{ p: { xs: 3, md: 5 } }}>
                <Typography variant="h3" component="h1" gutterBottom>
                    Privacy Policy
                </Typography>
                <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                    Last Updated: June 22, 2026
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                    <Link href="/about">App Overview</Link>
                    <Link href="/terms">Terms of Service</Link>
                    <Link href="/login">Staff Sign In</Link>
                </Stack>
                
                <Box sx={{ my: 4 }}>
                    <Typography variant="body1" paragraph>
                        This Privacy Policy describes how MISC Bookings, an internal University of Pretoria departmental study room booking application, collects and uses information. The app is for authorized departmental staff only. Students do not log into this app.
                    </Typography>
                </Box>

                <Divider sx={{ my: 4 }} />

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Information We Collect
                    </Typography>
                    <Typography variant="body1" paragraph>
                        We collect only the information needed to authenticate staff users, authorize access, manage room bookings, and support internal administration:
                    </Typography>
                    <ul>
                        <li>
                            <Typography variant="body1">
                                <strong>Google sign-in data:</strong> email address, Google account user ID, display name, and profile image URL supplied through Google sign-in and Supabase Auth.
                            </Typography>
                        </li>
                        <li>
                            <Typography variant="body1">
                                <strong>Staff profile and access data:</strong> staff email, name, profile image URL, profile status, and access-control flags for settings, analytics, and user authorization.
                            </Typography>
                        </li>
                        <li>
                            <Typography variant="body1">
                                <strong>Booking data:</strong> room, course, booking date, start and end times, booking state, staff name entered on the booking, borrowed items, bulk booking identifiers, student numbers or student counts, and related room/course configuration.
                            </Typography>
                        </li>
                        <li>
                            <Typography variant="body1">
                                <strong>Operational data:</strong> room names, capacity limits, availability labels, borrowable items, courses, application settings, optional bug reports, reporter names, and limited audit/usage logs for booking creation and state changes.
                            </Typography>
                        </li>
                    </ul>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        How We Use Information
                    </Typography>
                    <Typography variant="body1" paragraph>
                        We use this information to confirm that a staff user is authorized, manage room schedules, prevent double bookings, track room availability, produce internal booking reports, maintain user permissions, troubleshoot issues, and operate the booking system. We do not use this information for advertising, profiling, or external tracking.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Google Sign-In
                    </Typography>
                    <Typography variant="body1" paragraph>
                        Google is used only for sign-in and identity verification. The app requests basic identity scopes only: <code>openid</code>, <code>email</code>, and <code>profile</code>.
                    </Typography>
                    <Typography variant="body1" paragraph>
                        The app does not access, read, store, or process Gmail, Google Drive, Google Calendar, Google Contacts, or other Google API content.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Storage and Access
                    </Typography>
                    <Typography variant="body1" paragraph>
                        Application data is stored in Supabase and protected by authentication and row-level security rules. Authorized staff can access booking information needed to operate the study room booking service. Staff with additional authorization roles may manage users, settings, and reports.
                    </Typography>
                    <Typography variant="body1" paragraph>
                        The app stores a local browser preference for light or dark mode. Supabase Auth may use browser storage and cookies as needed to maintain the staff sign-in session. These technologies are not used for advertising.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Retention and Deletion
                    </Typography>
                    <Typography variant="body1" paragraph>
                        Staff profile records are retained while the staff member is authorized to use the app and may be removed by an authorized administrator when access is no longer required. Booking, reporting, and audit records are retained for internal operational and administrative needs according to university or departmental retention requirements.
                    </Typography>
                    <Typography variant="body1" paragraph>
                        To request correction or deletion of personal information, contact the departmental app administrator or the support contact listed on the Google OAuth consent screen. Requests may be subject to university records, audit, and operational retention requirements.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Sharing
                    </Typography>
                    <Typography variant="body1" paragraph>
                        Information is used for internal University of Pretoria departmental administration and support. We do not sell personal information. We use service providers such as Supabase for authentication/session management and database hosting, and Google for sign-in. Google user data from sign-in is used only for identity and access control within this app.
                    </Typography>
                </Box>

                <Box>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Contact and Google Policies
                    </Typography>
                    <Typography variant="body1" paragraph>
                        For privacy questions, access requests, or deletion requests, contact the departmental app administrator or the university privacy/data-protection office through the support email configured for this app. For more information about how Google handles information, review the <Link href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Privacy Policy</Link>.
                    </Typography>
                </Box>
            </Paper>
        </Container>
    );
};

export default PrivacyPolicyPage;
