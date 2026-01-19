import { useEffect, ReactNode } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardHeader,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Stack,
  Avatar
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import SettingsIcon from '@mui/icons-material/Settings';
import BarChartIcon from '@mui/icons-material/BarChart';
import GppGoodIcon from '@mui/icons-material/GppGood';
import BugReportIcon from '@mui/icons-material/BugReport';
import SearchIcon from '@mui/icons-material/Search';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import DateRangeIcon from '@mui/icons-material/DateRange';
import BuildIcon from '@mui/icons-material/Build';
import { useLayout } from '../../components/LayoutContext';

export default function DocumentPage() {
    const { setHeaderContent } = useLayout();

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
            <Avatar sx={{ bgcolor: `${color}.light`, color: `${color}.main`, width: 34, height: 34 }}>
                {icon}
            </Avatar>
            <Typography variant="h6" fontWeight="medium">{title}</Typography>
        </Box>
    );

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100%', pb: 4 }}>
            <Container maxWidth="xl">
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" fontWeight="bold" gutterBottom>User Guide</Typography>
                    <Typography variant="body1" color="text.secondary">
                        Comprehensive documentation for the Study Centre Booking System.
                        Learn how to navigate, manage bookings, and utilize administrative features.
                    </Typography>
                </Box>

                <Card sx={{ mb: 4, borderLeft: '4px solid', borderColor: 'primary.main' }}>
                    <CardHeader 
                        avatar={<InfoIcon color="primary" />}
                        title={<Typography variant="h6" fontWeight="bold">Quick Start</Typography>}
                        subheader="Essential basics for all users"
                    />
                    <CardContent sx={{ pt: 0 }}>
                        <Stack spacing={1}>
                            <Typography variant="body2">
                                <Box component="span" fontWeight="bold">Navigation:</Box> Use the <Box component="span" fontWeight="bold">Hamburger Menu</Box> (top left) to switch between pages like Bookings, Maintenance, and Settings.
                            </Typography>
                            <Typography variant="body2">
                                <Box component="span" fontWeight="bold">Dashboard:</Box> The <Box component="span" fontWeight="bold">Bookings</Box> page is your home screen. It shows a real-time grid of room availability.
                            </Typography>
                            <Typography variant="body2">
                                <Box component="span" fontWeight="bold">Booking:</Box> The fastest way to book is to <Box component="span" fontWeight="bold">click on a time slot</Box> in the grid.
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>

                <Stack spacing={2}>
                    {/* BOOKINGS SECTION */}
                    <Accordion disableGutters variant="outlined" sx={{ borderRadius: 2, '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <AccordionTrigger 
                                title="Bookings & Dashboard" 
                                icon={<DateRangeIcon fontSize="small" />} 
                                color="info" 
                            />
                        </AccordionSummary>
                        <AccordionDetails>
                            <Typography paragraph>
                                The Bookings page is the central hub. It displays a timeline grid where rows represent rooms and columns represent time slots.
                            </Typography>

                            <Stack spacing={3}>
                                <Box>
                                    <Typography variant="h6" sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mb: 2 }}>Making a Booking</Typography>
                                    <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2}>
                                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <TouchAppIcon fontSize="small" /> Click to Book
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" paragraph>The fastest way to book.</Typography>
                                            <Box component="ol" sx={{ pl: 2, m: 0, typography: 'caption' }}>
                                                <li>Find an empty slot in the grid.</li>
                                                <li>Click the cell corresponding to your desired Room and Time.</li>
                                                <li>The booking form will open with the Room and Time pre-filled.</li>
                                                <li>Adjust duration if needed and click <strong>Book-in</strong> or <strong>Reserve</strong>.</li>
                                            </Box>
                                        </Paper>

                                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CalendarTodayIcon fontSize="small" /> "Book Now" Button
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" paragraph>For advanced options.</Typography>
                                            <Box component="ol" sx={{ pl: 2, m: 0, typography: 'caption' }}>
                                                <li>Click the <strong>Book Now</strong> button in the top toolbar.</li>
                                                <li>Select a <strong>Room</strong>, <strong>Date</strong>, and <strong>Time</strong> manually.</li>
                                                <li>Or use <strong>Smart Select</strong> or <strong>Bulk Mode</strong> (see below).</li>
                                            </Box>
                                        </Paper>
                                    </Box>

                                    <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2} mt={2}>
                                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.lighter', borderColor: 'primary.light' }}>
                                            <Typography variant="subtitle1" fontWeight="bold" color="primary.main" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <SearchIcon fontSize="small" /> Smart Select
                                            </Typography>
                                            <Typography variant="caption" paragraph>The system finds the best room for you.</Typography>
                                            <Box component="ul" sx={{ pl: 2, m: 0, typography: 'caption' }}>
                                                <li>Open the "Book Now" form.</li>
                                                <li>Click <strong>Smart Select</strong>.</li>
                                                <li>Enter your <strong>Group Size</strong> when prompted.</li>
                                                <li>The system suggests the best available room based on capacity and schedule.</li>
                                            </Box>
                                        </Paper>

                                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'info.lighter', borderColor: 'info.light' }}>
                                             <Typography variant="subtitle1" fontWeight="bold" color="info.main" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <FileCopyIcon fontSize="small" /> Bulk Booking
                                            </Typography>
                                            <Typography variant="caption" paragraph>Book multiple slots or rooms at once.</Typography>
                                             <Box component="ul" sx={{ pl: 2, m: 0, typography: 'caption' }}>
                                                <li>In the "Book Now" form, toggle <strong>Bulk Mode</strong> on.</li>
                                                <li>Add multiple <strong>Date Ranges</strong> and <strong>Time Ranges</strong>.</li>
                                                <li>Select one or more <strong>Rooms</strong>.</li>
                                                <li>The system will attempt to create bookings for all combinations.</li>
                                            </Box>
                                        </Paper>
                                    </Box>
                                </Box>

                                <Box>
                                    <Typography variant="h6" sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mb: 2 }}>Managing Bookings</Typography>
                                    <Stack spacing={1}>
                                        <Box display="flex" gap={2}>
                                            <Typography variant="body2" fontWeight="bold" minWidth={80}>Editing:</Typography>
                                            <Typography variant="body2">Click on any existing booking block. You can change the time, room, or notes.</Typography>
                                        </Box>
                                        <Box display="flex" gap={2}>
                                            <Typography variant="body2" fontWeight="bold" minWidth={80}>Status:</Typography>
                                            <Typography variant="body2">Colored dots indicate status: <Box component="span" color="success.main" fontWeight="bold">Green</Box> (Active), <Box component="span" color="warning.main" fontWeight="bold">Orange</Box> (Reserved), <Box component="span" color="error.main" fontWeight="bold">Red</Box> (Overdue).</Typography>
                                        </Box>
                                        <Box display="flex" gap={2}>
                                            <Typography variant="body2" fontWeight="bold" minWidth={80}>Deleting:</Typography>
                                            <Typography variant="body2">Click a booking and select <strong>Delete</strong>.</Typography>
                                        </Box>
                                    </Stack>
                                </Box>

                                <Box>
                                    <Typography variant="h6" sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mb: 2 }}>Toolbar & Navigation</Typography>
                                    <Stack spacing={1}>
                                         <Box display="flex" gap={2}>
                                            <Typography variant="body2" fontWeight="bold" minWidth={80}>Date:</Typography>
                                            <Typography variant="body2">Use the calendar icon to jump to a specific date. The <strong>TODAY</strong> button returns to the current day.</Typography>
                                        </Box>
                                    </Stack>
                                </Box>
                            </Stack>
                        </AccordionDetails>
                    </Accordion>

                    {/* ROOM MAINTENANCE SECTION */}
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

                    {/* REPORT BUG SECTION */}
                    <Accordion disableGutters variant="outlined" sx={{ borderRadius: 2, '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                           <AccordionTrigger 
                                title="Report a Bug" 
                                icon={<BugReportIcon fontSize="small" />} 
                                color="error" 
                            />
                        </AccordionSummary>
                        <AccordionDetails>
                            <Typography paragraph>
                                Found something broken? Use the Bug Report page to let the development team know.
                            </Typography>
                            <Box component="ul" sx={{ pl: 2, typography: 'body2' }}>
                                <li><strong>Submit a New Bug:</strong> Fill out the form with your name and a detailed description of the issue. Be specific about what you were doing when the error occurred.</li>
                                <li><strong>View Existing Bugs:</strong> Check the list below the form to see if your issue has already been reported.</li>
                                <li><strong>Upvote:</strong> If you see a bug that affects you too, click the up arrow to "upvote" it. This helps prioritize fixes.</li>
                                <li><strong>Status:</strong> You can filter bugs by status (New, Acknowledged, Fixed) to track progress.</li>
                            </Box>
                        </AccordionDetails>
                    </Accordion>
                    
                    {/* ADMIN SECTIONS */}
                     <Accordion disableGutters variant="outlined" sx={{ borderRadius: 2, '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                           <AccordionTrigger 
                                title="Admin Features" 
                                icon={<SettingsIcon fontSize="small" />} 
                                color="secondary" 
                            />
                        </AccordionSummary>
                        <AccordionDetails>
                            <Paper sx={{ p: 1.5, mb: 2, bgcolor: 'warning.lighter', border: 1, borderColor: 'warning.light' }}>
                                <Typography variant="body2" fontWeight="bold" color="warning.dark">
                                    Note: These sections are only visible to users with specific administrative privileges.
                                </Typography>
                            </Paper>

                             <Stack spacing={3}>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <SettingsIcon fontSize="small" /> Settings Page
                                    </Typography>
                                    <Typography variant="body2" paragraph>The control center for the application's data.</Typography>
                                    <Box component="ul" sx={{ pl: 2, m: 0, typography: 'body2' }}>
                                        <li><strong>Rooms:</strong> Add or edit rooms. You can set the <strong>Capacity</strong> (how many people fit) and list <strong>Borrowable Items</strong> (e.g., "HDMI cable, Whiteboard markers"). This information is displayed when selecting a room.</li>
                                        <li><strong>Courses:</strong> Manage the list of courses available in the booking dropdown. You can assign colors to courses to make them distinct on the grid.</li>
                                        <li><strong>Operation Hours:</strong> Set the global opening and closing times for the centre. The booking grid will only show slots within these hours.</li>
                                    </Box>
                                </Box>

                                <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                                    <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <GppGoodIcon fontSize="small" /> Authorization
                                    </Typography>
                                    <Typography variant="body2" paragraph>Manage who can access the system and what they can do.</Typography>
                                    <Box component="ul" sx={{ pl: 2, m: 0, typography: 'body2' }}>
                                        <li><strong>User List:</strong> View all registered users.</li>
                                        <li><strong>Permissions:</strong> Toggle flags for each user:
                                            <Box component="ul" sx={{ pl: 2, color: 'text.secondary' }}>
                                                <li><em>Settings:</em> Access to global configuration.</li>
                                                <li><em>Authorisation:</em> Ability to manage other users.</li>
                                                <li><em>Analytics:</em> Access to data reports.</li>
                                            </Box>
                                        </li>
                                        <li><strong>Add Users:</strong> Create new user accounts manually.
                                             <Box component="ul" sx={{ pl: 2, color: 'text.secondary' }}>
                                                <li>New users are assigned the default password: <strong>MISC1234</strong>.</li>
                                                <li>They must use the <strong>Forgot Password</strong> link on the login page to set their own secure password via email.</li>
                                            </Box>
                                        </li>
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
                                        <li><strong>Room Stats:</strong> Summarizes total hours booked per room, helping identify underutilized or overbooked spaces.</li>
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
