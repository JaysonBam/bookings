import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import * as XLSX from "xlsx";
import {
  Box,
  Typography,
  Card,
  Button,
  TextField,
  CircularProgress,
  Container,
  Snackbar,
  Alert,
  Grid,
  Paper,
  Stack,
  Avatar,
  Divider
} from "@mui/material";
import { useLayout } from "../../components/LayoutContext";
import { format, parse, differenceInMinutes } from "date-fns";
import DownloadIcon from '@mui/icons-material/Download';
import TableChartIcon from '@mui/icons-material/TableChart';
import SchoolIcon from '@mui/icons-material/School';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';

export default function ReportPage() {
  const { setHeaderContent } = useLayout();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return format(now, "yyyy-MM");
  });
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    setHeaderContent(
      <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
        Analytics & Reports
      </Typography>
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });

  const showMessage = (message: string, severity: "success" | "error") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleGenerateReports = async () => {
    if (!selectedMonth) {
      showMessage("Please select a month first.", "error");
      return;
    }

    setLoading(true);
    try {
      const [year, month] = selectedMonth.split("-");
      const startDate = `${selectedMonth}-01`;
      // Calculate end date (last day of the month)
      const endD = new Date(parseInt(year), parseInt(month), 0);
      const endDate = format(endD, "yyyy-MM-dd");

      // 1. Fetch Data
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .gte("booking_day", startDate)
        .lte("booking_day", endDate);

      if (bookingsError) throw bookingsError;

      const { data: rooms, error: roomsError } = await supabase
        .from("rooms")
        .select("id, name");

      if (roomsError) throw roomsError;

      const { data: courses, error: coursesError } = await supabase
        .from("courses")
        .select("id, name");

      if (coursesError) throw coursesError;

      // Create Maps for easy lookup
      const roomMap = new Map(rooms?.map((r) => [r.id, r.name]));
      const courseMap = new Map(courses?.map((c) => [c.id, c.name]));

      // Helper to calculate duration in hours
      const calculateDuration = (start: string, end: string) => {
        const s = parse(start, "HH:mm:ss", new Date());
        const e = parse(end, "HH:mm:ss", new Date());
        return differenceInMinutes(e, s) / 60;
      };

      // 2. Process Data for Report 1: Raw Booking Data
      const rawData = bookings?.map((booking) => {
        const roomName = roomMap.get(booking.room_id) || `Room ${booking.room_id}`;
        const courseName =
          booking.course_name ||
          (booking.course_id ? courseMap.get(booking.course_id) : "N/A") ||
          "N/A";
        const duration = calculateDuration(booking.start_time, booking.end_time);
        const studentCount = booking.student_numbers
          ? booking.student_numbers.split("\n").filter((l: string) => l.trim()).length
          : 0;

        return {
          Date: booking.booking_day,
          Room: roomName,
          Course: courseName,
          "Start Time": booking.start_time,
          "End Time": booking.end_time,
          "Duration (Hours)": duration.toFixed(2),
          "Booked By": booking.booked_by,
          "Student Numbers": booking.student_numbers,
          "Student Count": studentCount,
        };
      });

      // 3. Process Data for Report 2: Room Stats
      const roomStats: Record<string, { bookings: number; hours: number }> = {};

      // Initialize all rooms with 0
      rooms?.forEach((room) => {
        roomStats[room.name] = { bookings: 0, hours: 0 };
      });

      bookings?.forEach((booking) => {
        const roomName = roomMap.get(booking.room_id);
        if (roomName) {
          const duration = calculateDuration(booking.start_time, booking.end_time);
          roomStats[roomName].bookings += 1;
          roomStats[roomName].hours += duration;
        }
      });

      const roomReport = Object.entries(roomStats)
        .map(([room, stats]) => ({
          Room: room,
          "Total Bookings": stats.bookings,
          "Total Hours": stats.hours.toFixed(2),
        }))
        .sort((a, b) => a.Room.localeCompare(b.Room));

      // 4. Process Data for Report 3: Course Stats
      const courseStats: Record<string, { bookings: number; hours: number }> = {};

      // Initialize known courses with 0
      courses?.forEach((course) => {
        courseStats[course.name] = { bookings: 0, hours: 0 };
      });

      bookings?.forEach((booking) => {
        const courseName =
          booking.course_name || (booking.course_id ? courseMap.get(booking.course_id) : null);

        if (courseName) {
          if (!courseStats[courseName]) {
            courseStats[courseName] = { bookings: 0, hours: 0 };
          }
          const duration = calculateDuration(booking.start_time, booking.end_time);
          courseStats[courseName].bookings += 1;
          courseStats[courseName].hours += duration;
        }
      });

      const courseReport = Object.entries(courseStats)
        .map(([course, stats]) => ({
          Course: course,
          "Total Bookings": stats.bookings,
          "Total Hours": stats.hours.toFixed(2),
        }))
        .sort((a, b) => a.Course.localeCompare(b.Course));

      // 5. Generate Excel File
      const wb = XLSX.utils.book_new();

      const ws1 = XLSX.utils.json_to_sheet(rawData || []);
      XLSX.utils.book_append_sheet(wb, ws1, "Raw Data");

      const ws2 = XLSX.utils.json_to_sheet(roomReport);
      XLSX.utils.book_append_sheet(wb, ws2, "Room Stats");

      const ws3 = XLSX.utils.json_to_sheet(courseReport);
      XLSX.utils.book_append_sheet(wb, ws3, "Course Stats");

      // Auto-width columns (simple approximation)
      const setColWidth = (ws: XLSX.WorkSheet, data: any[]) => {
        if (data.length === 0) return;
        const cols = Object.keys(data[0]).map((key) => ({
          wch:
            Math.max(
              key.length,
              ...data.map((row) => (row[key] ? row[key].toString().length : 0))
            ) + 2,
        }));
        ws["!cols"] = cols;
      };

      setColWidth(ws1, rawData || []);
      setColWidth(ws2, roomReport);
      setColWidth(ws3, courseReport);

      XLSX.writeFile(wb, `Booking_Report_${selectedMonth}.xlsx`);

      showMessage("Reports generated and downloaded successfully.", "success");
    } catch (error: any) {
      console.error("Error generating reports:", error);
      showMessage(error.message || "Failed to generate reports.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100%", pb: 4 }}>
      <Container maxWidth="xl">
        <Grid container spacing={3}>
            {/* Control Panel */}
            <Grid item xs={12}>
                <Paper sx={{ p: 3, display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, gap: 4, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h5" fontWeight="bold" gutterBottom>Monthly Analytics Export</Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                            Select a month to generate comprehensive Excel reports for administration and planning.
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', width: { xs: '100%', md: 'auto' }, flexDirection: { xs: 'column', sm: 'row' } }}>
                        <TextField
                            id="month-select"
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            variant="outlined"
                            size="small"
                            sx={{ 
                                bgcolor: 'background.paper', 
                                borderRadius: 1, 
                                minWidth: 200,
                                '& .MuiOutlinedInput-notchedOutline': { border: 'none' } 
                            }}
                        />
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={handleGenerateReports}
                            disabled={loading}
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
                            size="large"
                            sx={{ whiteSpace: 'nowrap', width: { xs: '100%', sm: 'auto' }, px: 3, py: 1 }}
                        >
                            {loading ? "Generating..." : "Download Excel Report"}
                        </Button>
                    </Box>
                </Paper>
            </Grid>

            {/* Information Cards */}
            <Grid item xs={12}>
                <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mt: 2, mb: 2 }}>Included in Report</Typography>
            </Grid>

            <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                    <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'info.light', color: 'info.contrastText', width: 48, height: 48 }}>
                            <TableChartIcon />
                        </Avatar>
                        <Box>
                             <Typography variant="subtitle1" fontWeight="bold">Raw Data</Typography>
                             <Typography variant="body2" color="text.secondary">Complete registry of all bookings.</Typography>
                        </Box>
                    </Box>
                    <Divider />
                    <Box sx={{ p: 2, bgcolor: 'action.hover', height: '100%' }}>
                        <Typography variant="caption" color="text.secondary" component="div">
                            <Stack spacing={1}>
                                <Box>• Date & Time details</Box>
                                <Box>• Booker information</Box>
                                <Box>• Duration & Student counts</Box>
                            </Stack>
                        </Typography>
                    </Box>
                </Card>
            </Grid>

            <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                    <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'warning.light', color: 'warning.contrastText', width: 48, height: 48 }}>
                            <MeetingRoomIcon />
                        </Avatar>
                        <Box>
                             <Typography variant="subtitle1" fontWeight="bold">Room Statistics</Typography>
                             <Typography variant="body2" color="text.secondary">Usage metrics by room.</Typography>
                        </Box>
                    </Box>
                     <Divider />
                    <Box sx={{ p: 2, bgcolor: 'action.hover', height: '100%' }}>
                         <Typography variant="caption" color="text.secondary" component="div">
                            <Stack spacing={1}>
                                <Box>• Total booking count</Box>
                                <Box>• Total hours utilized</Box>
                                <Box>• Identification of high-traffic zones</Box>
                            </Stack>
                        </Typography>
                    </Box>
                </Card>
            </Grid>

            <Grid item xs={12} md={4}>
                 <Card variant="outlined" sx={{ height: '100%' }}>
                    <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'success.light', color: 'success.contrastText', width: 48, height: 48 }}>
                            <SchoolIcon />
                        </Avatar>
                        <Box>
                             <Typography variant="subtitle1" fontWeight="bold">Course Statistics</Typography>
                             <Typography variant="body2" color="text.secondary">Engagement by course.</Typography>
                        </Box>
                    </Box>
                     <Divider />
                    <Box sx={{ p: 2, bgcolor: 'action.hover', height: '100%' }}>
                         <Typography variant="caption" color="text.secondary" component="div">
                            <Stack spacing={1}>
                                <Box>• Bookings per course</Box>
                                <Box>• Hours allocated to coursework</Box>
                                <Box>• Resource demand analysis</Box>
                            </Stack>
                        </Typography>
                    </Box>
                </Card>
            </Grid>
        </Grid>
      </Container>
      
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
