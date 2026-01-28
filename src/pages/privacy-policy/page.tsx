import { Container, Typography, Box, Link, Divider, Paper } from '@mui/material';

const PrivacyPolicyPage = () => {
    return (
        <Container maxWidth="md" sx={{ py: 8 }}>
            <Paper elevation={3} sx={{ p: { xs: 3, md: 5 } }}>
                <Typography variant="h3" component="h1" gutterBottom>
                    Privacy Policy
                </Typography>
                <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                    Last Updated: January 28, 2026
                </Typography>
                
                <Box sx={{ my: 4 }}>
                    <Typography variant="body1" paragraph>
                        This Privacy Policy describes how the University of Pretoria Booking System ("we", "us", or "our") collects, uses, and discloses your information when you use our booking services.
                    </Typography>
                </Box>

                <Divider sx={{ my: 4 }} />

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Data Collection
                    </Typography>
                    <Typography variant="body1" paragraph>
                        We collect the following types of information:
                    </Typography>
                    <ul>
                        <li>
                            <Typography variant="body1">
                                <strong>Information you provide:</strong> We collect information you enter into the system, including booking details, settings, student numbers, and modifications to rooms and courses.
                            </Typography>
                        </li>
                        <li>
                            <Typography variant="body1">
                                <strong>Automated Information:</strong> We may collect standard server logs and usage data to ensure system stability.
                            </Typography>
                        </li>
                    </ul>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Purpose of Use
                    </Typography>
                    <Typography variant="body1" paragraph>
                        The data collected is used primarily to facilitate the logic and functionality of the booking system. This includes managing schedules, preventing double bookings, and maintaining user preferences. We do not use your data for personalized advertising.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Third-Party Sharing
                    </Typography>
                    <Typography variant="body1" paragraph>
                        We do not share personal information such as names, surnames, email addresses, or profile pictures with third parties.
                    </Typography>
                    <Typography variant="body1" paragraph>
                        <strong>Internal Usage:</strong> Booking information may be extrapolated for University of Pretoria administration control and analysis. This data is aggregated and does not contain personal user details.
                    </Typography>
                    <Typography variant="body1" paragraph>
                        <strong>Service Providers:</strong> We use third-party services (like Google) to authenticate users. When you log in with Google, we access basic profile information as permitted by your settings, but this is only used for identification within the app and not shared externally.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Use of Technologies
                    </Typography>
                    <Typography variant="body1" paragraph>
                        We use local storage and cookies to save your user preferences, specifically your preferred theme (light or dark mode). We do not use cookies for tracking or advertising purposes.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        User Controls and Opt-out
                    </Typography>
                    <Typography variant="body1" paragraph>
                        The information stored is not linked to your specific Google user profile for advertising or external tracking. You can control the data you provide by limiting the information you interact with in the system.
                    </Typography>
                    <Typography variant="body1" paragraph>
                        To manage your Google privacy settings, please visit the <Link href="https://myaccount.google.com/privacy-checkup" target="_blank" rel="noopener">Google Privacy Checkup</Link>.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Google Privacy Policy
                    </Typography>
                    <Typography variant="body1" paragraph>
                        Our application integrates with Google services. For more information on how Google handles your data, please review the <Link href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Privacy Policy</Link>.
                    </Typography>
                </Box>
            </Paper>
        </Container>
    );
};

export default PrivacyPolicyPage;
