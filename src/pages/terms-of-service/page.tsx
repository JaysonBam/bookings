import { Container, Typography, Box, Link, Divider, Paper } from '@mui/material';

const TermsOfServicePage = () => {
    return (
        <Container maxWidth="md" sx={{ py: 8 }}>
            <Paper elevation={3} sx={{ p: { xs: 3, md: 5 } }}>
                <Typography variant="h3" component="h1" gutterBottom>
                    Terms of Service
                </Typography>
                <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                    Last Updated: January 28, 2026
                </Typography>

                <Box sx={{ my: 4 }}>
                    <Typography variant="body1" paragraph>
                        By accessing or using the University of Pretoria Booking System, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
                    </Typography>
                </Box>

                <Divider sx={{ my: 4 }} />

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Intellectual Property
                    </Typography>
                    <Typography variant="body1" paragraph>
                        The Booking System application is owned by the University of Pretoria. All content, features, and functionality are the exclusive property of the University of Pretoria and its licensors.
                    </Typography>
                    <Typography variant="body1" paragraph>
                        <strong>User Content:</strong> You retain ownership of any data or content you submit to the system. However, by using the service, you grant us the right to use, store, and modify that content as necessary to provide the service.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Branding and Restrictions
                    </Typography>
                    <Typography variant="body1" paragraph>
                        Using our service does not grant you ownership of any intellectual property rights in our services or the content you access.
                    </Typography>
                    <Typography variant="body1" paragraph>
                        <strong>Google Branding:</strong> You may not use Google's branding, logos, or legal notices without prior written permission. You must not remove, obscure, or alter any legal notices displayed in or along with Google services. Please refer to <Link href="https://www.google.com/permissions/" target="_blank" rel="noopener">Google Brand Permissions</Link> for guidance.
                    </Typography>
                    <Typography variant="body1" paragraph>
                        University of Pretoria logos are included for branding purposes only and do not convey any specific additional rights or licenses to the user.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Compliance with Laws
                    </Typography>
                    <Typography variant="body1" paragraph>
                        You agree to comply with all applicable local, national, and international laws and regulations while using our service. You must also adhere to our internal policies and any applicable service-specific terms from Google.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Disclaimers and Limitation of Liability
                    </Typography>
                    <Typography variant="body1" paragraph>
                        The service is provided on an "AS IS" and "AS AVAILABLE" basis. We make no warranties, expressed or implied, regarding the reliability, accuracy, or availability of the service.
                    </Typography>
                    <Typography variant="body1" paragraph>
                        To the fullest extent permitted by law, the University of Pretoria shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Governing Law
                    </Typography>
                    <Typography variant="body1" paragraph>
                        These Terms shall be governed and construed in accordance with the laws of South Africa, without regard to its conflict of law provisions.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Google Terms of Service
                    </Typography>
                    <Typography variant="body1" paragraph>
                        Our application integrates with Google services. Your use of those services is also governed by the <Link href="https://policies.google.com/terms" target="_blank" rel="noopener">Google Terms of Service</Link>.
                    </Typography>
                </Box>
            </Paper>
        </Container>
    );
};

export default TermsOfServicePage;
