import { useEffect, ReactNode, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Stack,
  Avatar,
  Divider,
  Button,
  Collapse,
  useTheme
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DateRangeIcon from '@mui/icons-material/DateRange';
import BuildIcon from '@mui/icons-material/Build';
import SettingsIcon from '@mui/icons-material/Settings';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import GppGoodIcon from '@mui/icons-material/GppGood';
import BarChartIcon from '@mui/icons-material/BarChart';
import CircleIcon from '@mui/icons-material/Circle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SearchIcon from '@mui/icons-material/Search';

import { useLayout } from '../../components/LayoutContext';

export default function DocumentPage() {
    const { setHeaderContent } = useLayout();
    const [showSmartSelectDetails, setShowSmartSelectDetails] = useState(false);
    const theme = useTheme();

    useEffect(() => {
        setHeaderContent(
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
                Help & Documentation
            </Typography>
        );
        return () => setHeaderContent(null);
    }, [setHeaderContent]);

    const AccordionTrigger = ({ title, icon, color }: { title: string, icon: ReactNode, color: string }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: `${color}.main`, color: `${color}.contrastText`, width: 34, height: 34 }}>
                {icon}
            </Avatar>
            <Typography variant="h6" fontWeight="medium">{title}</Typography>
        </Box>
    );

    const StatusDot = ({ color, label }: { color: string, label: string }) => (
        <Box display="flex" alignItems="center" gap={1}>
            <CircleIcon sx={{ color: color, fontSize: 14 }} />
            <Typography variant="body2">{label}</Typography>
        </Box>
    );

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100%', pb: 12 }}>
            <Container maxWidth="xl" sx={{ px: { xs: 1, md: 4 } }}>
                <Box sx={{ mb: { xs: 2, md: 4 }, pt: { xs: 2, md: 4 } }}>
                    <Typography variant="h4" fontWeight="bold" gutterBottom color="text.primary" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
                        Comprehensive guide to managing the Study Centre space.
                    </Typography>
                </Box>

                <Stack spacing={{ xs: 2, md: 3 }}>
                    {/* BOOKINGS SECTION */}
                    <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                        <Box sx={{ p: { xs: 2, md: 3 }, borderBottom: 1, borderColor: 'divider', bgcolor: theme.palette.mode === 'dark' ? 'action.hover' : 'grey.50' }}>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                                    <DateRangeIcon />
                                </Avatar>
                                <Box>
                                    <Typography variant="h5" fontWeight="bold" color="text.primary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>Bookings & Dashboard</Typography>
                                    <Typography variant="body2" color="text.secondary">Everything you need to know about managing room bookings.</Typography>
                                </Box>
                            </Box>
                        </Box>
                        
                        <CardContent sx={{ p: { xs: 2, md: 4 } }}>
                            <Stack spacing={{ xs: 4, md: 6 }}>
                                
                                {/* 1. Understanding Bookings */}
                                <Box>
                                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                                        1. Understanding Bookings
                                    </Typography>
                                    <Typography color="text.secondary" paragraph>
                                        A booking represents a student or group using a room. It is crucial to manage the <strong>State</strong> of a booking correctly so the system (and other staff) knows what is happening.
                                    </Typography>

                                    <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                        Booking States & Status Dots:
                                    </Typography>
                                    <Stack direction="row" flexWrap="wrap" gap={3} sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                                        <StatusDot color="#FFEB3B" label="Reserved (Yellow)" />
                                        <StatusDot color="#FF9800" label="Late (Orange)" />
                                        <StatusDot color="#4CAF50" label="Active (Green)" />
                                        <StatusDot color="#F44336" label="Overdue (Red)" />
                                        <StatusDot color="#9E9E9E" label="Ended (Grey)" />
                                    </Stack>
                                    
                                    <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr 1fr' }} gap={{ xs: 2, md: 2 }}>
                                        {/* RESERVED */}
                                        <Paper variant="outlined" sx={{ p: 2, borderColor: 'warning.light', bgcolor: theme.palette.mode === 'dark' ? 'transparent' : 'warning.lighter' }}>
                                            <Stack spacing={1}>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <PendingActionsIcon color="warning" />
                                                    <Typography variant="subtitle1" fontWeight="bold" color="warning.main">Reserved</Typography>
                                                </Box>
                                                <Typography variant="body2">
                                                    <strong>When:</strong> A student wants to book for later.
                                                </Typography>
                                                <Typography variant="body2">
                                                    <strong>How:</strong> Type in a slot or click "Reserve".
                                                </Typography>
                                                <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1, color: 'warning.main' }}>
                                                    <WarningAmberIcon fontSize="small" />
                                                    <Typography variant="caption" fontWeight="bold">
                                                        Must be Activated when they arrive!
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </Paper>

                                        {/* ACTIVE */}
                                        <Paper variant="outlined" sx={{ p: 2, borderColor: 'success.light', bgcolor: theme.palette.mode === 'dark' ? 'transparent' : 'success.lighter' }}>
                                            <Stack spacing={1}>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <BookmarkAddedIcon color="success" />
                                                    <Typography variant="subtitle1" fontWeight="bold" color="success.main">Active</Typography>
                                                </Box>
                                                <Typography variant="body2">
                                                    <strong>When:</strong> The student is <strong>currently</strong> in the room and has the Room Card.
                                                </Typography>
                                                <Typography variant="body2">
                                                    <strong>To Activate:</strong> The main method is to hover over a reserved booking and click the <strong>Activate</strong> button. You can also click "Book-in" for immediate entry.
                                                </Typography>
                                            </Stack>
                                        </Paper>

                                        {/* FINISHED */}
                                        <Paper variant="outlined" sx={{ p: 2, borderColor: 'info.light', bgcolor: theme.palette.mode === 'dark' ? 'transparent' : 'info.lighter' }}>
                                            <Stack spacing={1}>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <CheckCircleIcon color="info" />
                                                    <Typography variant="subtitle1" fontWeight="bold" color="info.main">Finished</Typography>
                                                </Box>
                                                <Typography variant="body2">
                                                    <strong>When:</strong> The student returns the Room Card.
                                                </Typography>
                                                <Typography variant="body2">
                                                    <strong>To End:</strong> Hover over the booking and click the <strong>End</strong> button. 
                                                </Typography>
                                                <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1, color: 'info.main' }}>
                                                    <WarningAmberIcon fontSize="small" />
                                                    <Typography variant="caption" fontWeight="bold">
                                                        Always end bookings promptly!
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </Paper>
                                    </Box>
                                    
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>Note:</strong> A "Late" booking is a reservation that is more than 10 minutes past start time. An "Overdue" booking is an active booking that has passed its end time.
                                        </Typography>
                                    </Box>
                                </Box>

                                <Divider />

                                {/* 2. Essential Details */}
                                <Box>
                                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                                        2. Essential Details
                                    </Typography>
                                    <Stack spacing={2}>
                                        <Box>
                                            <Typography variant="subtitle2" gutterBottom>Staff Name (Header)</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                You can optionally type your name in the top header. This is a speed-up tool that auto-fills the "Staff" field for you. 
                                                <em> This setting resets when the browser refreshes.</em> The staff name on the booking itself is mandatory.
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2" gutterBottom>Room Selection</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                The dropdown only shows currently <strong>available</strong> rooms.
                                                Helpful notes appear next to rooms (e.g., "Overdue", "Next booking in 15m") to help you choose.
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2" gutterBottom>Courses & Borrowed Items</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Select a course code or choose <strong>"Other"</strong> to type a custom one.
                                                <br />
                                                Check off any items (HDMI, remote ect) the student borrows. The system will remind you to ask for them back when ending the booking.
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Box>

                                <Divider />

                                {/* 3. Smart Select */}
                                <Box>
                                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                                        <AutoModeIcon color="primary" />
                                        <Typography variant="h6" fontWeight="bold">3. Smart Select</Typography>
                                    </Box>
                                    <Typography variant="body1" paragraph>
                                        The <strong>Smart Select</strong> button automatically chooses the most optimal room based on availability and constraints. It is the fastest way to create a booking.
                                    </Typography>
                                    
                                    <Button 
                                        onClick={() => setShowSmartSelectDetails(!showSmartSelectDetails)}
                                        endIcon={showSmartSelectDetails ? <ExpandMoreIcon sx={{ transform: 'rotate(180deg)' }}/> : <ExpandMoreIcon />}
                                        size="small"
                                        variant="outlined"
                                        sx={{ borderRadius: 4 }}
                                    >
                                        Curious how it works?
                                    </Button>

                                    <Collapse in={showSmartSelectDetails}>
                                        <Paper variant="outlined" sx={{ p: 3, mt: 2, bgcolor: 'background.paper' }}>
                                            <Typography variant="subtitle2" gutterBottom>Smart Select Logic Flow (in order):</Typography>
                                            <Box component="ol" sx={{ pl: 2, m: 0, '& li': { mb: 1, fontSize: '0.875rem' } }}>
                                                <li><strong>Filter Availability:</strong> Removes any rooms that are currently occupied.</li>
                                                <li><strong>Maximize Time:</strong> Prioritizes rooms that are free for the longest time (allows for extensions).</li>
                                                <li><strong>Overdue Status:</strong> Can prioritize swapping into rooms that need checking.</li>
                                                <li><strong>Best Fit:</strong> Selects rooms that best match the group size (avoids putting 1 person in a 10-person room).</li>
                                                <li><strong>Maintenance Check:</strong> Avoids rooms with reported issues (lights, plugs etc).</li>
                                                <li><strong>Alphabetical:</strong> Final tie-breaker.</li>
                                            </Box>
                                        </Paper>
                                    </Collapse>
                                </Box>

                                <Divider />

                                {/* 4. Visual Aids & Tools */}
                                <Box>
                                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                                        4. Visual Aids & Tools
                                    </Typography>
                                    <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={{ xs: 3, md: 4 }}>
                                        <Box>
                                            <Typography variant="subtitle2" gutterBottom>Issue Icons</Typography>
                                            <Typography variant="body2" color="text.secondary" paragraph>
                                                Emojis appear on rooms to warn you of problems:
                                            </Typography>
                                            <Stack spacing={1} sx={{ pl: 1 }}>
                                                <Box display="flex" alignItems="center" gap={2}>
                                                    <Typography fontSize="1.5rem">💡</Typography>
                                                    <Typography variant="body2">Lights not working</Typography>
                                                </Box>
                                                <Box display="flex" alignItems="center" gap={2}>
                                                    <Typography fontSize="1.5rem">🔌</Typography>
                                                    <Typography variant="body2">Power plug issues</Typography>
                                                </Box>
                                                <Box display="flex" alignItems="center" gap={2}>
                                                    <Typography fontSize="1.5rem">🖥️</Typography>
                                                    <Typography variant="body2">Screen/TV broken</Typography>
                                                </Box>
                                            </Stack>
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <SearchIcon fontSize="small" /> Search & Navigate
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" paragraph>
                                                <strong>Search:</strong> Click the Search Booking button and enter a student number. The system will highlight their booking on the current screen.
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                <strong>Navigate:</strong> Use <CalendarTodayIcon fontSize="inherit" /> to jump to dates, or click <strong>Today</strong> to snap back to now.
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>

                                <Divider />

                                {/* 5. Advanced Features */}
                                <Box>
                                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                                        5. Advanced Features
                                    </Typography>
                                    <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
                                        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <ContentCopyIcon fontSize="small" /> Bulk Bookings
                                            </Typography>
                                            <Typography variant="body2">
                                                Use the Bulk Booking tab to reserve multiple slots across different days or times in one go. Great for mass bookings.
                                            </Typography>
                                        </Paper>
                                    </Stack>
                                </Box>

                            </Stack>
                        </CardContent>
                    </Paper>

                    {/* OTHER SECTIONS (Maintenance, Admin) */}
                    <Accordion disableGutters variant="outlined" sx={{ borderRadius: 2, '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <AccordionTrigger 
                                title="Room Maintenance" 
                                icon={<BuildIcon fontSize="small" />} 
                                color="warning" 
                            />
                        </AccordionSummary>
                        <AccordionDetails>
                             <Typography paragraph>
                                The Room Maintenance page allows staff to flag specific issues with rooms. These flags appear as visual indicators on the main booking grid.
                            </Typography>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Reporting Issues</Typography>
                                    <Typography variant="body2" paragraph>On the Maintenance page, click the icons on a room card to toggle them:</Typography>
                                    <Stack spacing={1}>
                                        <Box display="flex" alignItems="center" gap={1}><Typography fontSize="1.25rem">💡</Typography> <Typography variant="body2"><strong>Lights:</strong> Lighting issue.</Typography></Box>
                                        <Box display="flex" alignItems="center" gap={1}><Typography fontSize="1.25rem">🔌</Typography> <Typography variant="body2"><strong>Plugs:</strong> Power outlet issue.</Typography></Box>
                                        <Box display="flex" alignItems="center" gap={1}><Typography fontSize="1.25rem">🖥️</Typography> <Typography variant="body2"><strong>Screen:</strong> Projector/Screen issue.</Typography></Box>
                                    </Stack>
                                </Paper>
                                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Visibility on Grid</Typography>
                                    <Typography variant="body2">
                                        When an issue is flagged, the corresponding emoji (e.g., 💡) appears next to the Room Name in the main booking grid header. This alerts staff to potential problems before they book the room.
                                    </Typography>
                                </Paper>
                            </Stack>
                        </AccordionDetails>
                    </Accordion>

                     <Accordion disableGutters variant="outlined" sx={{ borderRadius: 2, '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                           <AccordionTrigger 
                                title="Admin Features" 
                                icon={<SettingsIcon fontSize="small" />} 
                                color="secondary" 
                            />
                        </AccordionSummary>
                        <AccordionDetails>
                            <Paper sx={{ p: 1.5, mb: 2, bgcolor: theme.palette.mode === 'dark' ? 'transparent' : 'warning.lighter', border: 1, borderColor: 'warning.light' }}>
                                <Typography variant="body2" fontWeight="bold" color={theme.palette.mode === 'dark' ? 'warning.main' : 'warning.dark'}>
                                    Note: These sections are only visible to users with specific administrative privileges.
                                </Typography>
                            </Paper>

                             <Stack spacing={3}>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <SettingsIcon fontSize="small" /> Settings Page
                                    </Typography>
                                    <Typography variant="body2" paragraph>The control center for the application's data.</Typography>
                                    <Box component="ul" sx={{ pl: 2, m: 0, typography: 'body2', '& li': { mb: 1 } }}>
                                        <li><strong>Rooms:</strong> Manage room details:
                                            <Box component="ul" sx={{ pl: 2, color: 'text.secondary', mt: 0.5 }}>
                                                <li><em>Name:</em> The display name of the room.</li>
                                                <li><em>Availabilities:</em> Temporarily deactivate a room (e.g. for maintenance) without deleting it.</li>
                                                <li><em>Borrowable Items:</em> List items specific to this room that can be borrowed (e.g., HDMI cables).</li>
                                                <li><em>Capacity:</em> <strong>Max People</strong> (limit) and <strong>Min People</strong> (recommended minimum group size).</li>
                                            </Box>
                                        </li>
                                        <li><strong>Courses:</strong> Manage course codes and their grid display colors.</li>
                                        <li><strong>Note:</strong> You can add or remove any room or course. <strong>No changes are saved until you press the "Save" button at the top of the page.</strong></li>
                                    </Box>
                                </Box>

                                <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                                    <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <GppGoodIcon fontSize="small" /> Authorization
                                    </Typography>
                                    <Typography variant="body2" paragraph>Manage system access using <strong>Google Authentication</strong> only (no passwords).</Typography>
                                    <Box component="ul" sx={{ pl: 2, m: 0, typography: 'body2', '& li': { mb: 1 } }}>
                                        <li><strong>Add User:</strong> Enter the user's specific <strong>Gmail address</strong> (not an alias) to grant them access.</li>
                                        <li><strong>Permissions:</strong> Checkboxes determine what the user can do (Settings, Authorization, Analytics).</li>
                                        <li><strong>Pending Status:</strong> Means the user has been registered but hasn't logged in yet. They must log in once to confirm the account is active.</li>
                                        <li>Please see the <strong>Manage Users Page</strong> for more comprehensive details.</li>
                                    </Box>
                                </Box>

                                 <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                                    <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <BarChartIcon fontSize="small" /> Analytics
                                    </Typography>
                                    <Typography variant="body2" paragraph>Generate insights on room usage.</Typography>
                                    <Box component="ul" sx={{ pl: 2, m: 0, typography: 'body2' }}>
                                        <li><strong>Monthly Reports:</strong> Select a month and year to generate data.</li>
                                        <li><strong>Raw Data:</strong> Exports a detailed list of every booking, including duration and student numbers.</li>
                                        <li><strong>Room Stats:</strong> Summarizes total hours booked per room.</li>
                                    </Box>
                                </Box>
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                </Stack>
            </Container>
        </Box>
    )
}
