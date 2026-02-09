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
      // Group bookings by bulk_booking_id + date + time
      const groupedBookings = new Map<string, any[]>();
      
      bookings?.forEach((booking) => {
        // Create a unique key for grouping: bulk_booking_id + date + start_time
        // This merges multi-room bookings for the same time slot, but keeps separate dates distinct
        const key = booking.bulk_booking_id 
          ? `${booking.bulk_booking_id}_${booking.booking_day}_${booking.start_time}`
          : booking.id;
          
        if (!groupedBookings.has(key)) {
          groupedBookings.set(key, []);
        }
        groupedBookings.get(key)?.push(booking);
      });

      const rawData = Array.from(groupedBookings.values()).map((group) => {
        const mainBooking = group[0];
        // Combine room names
        const roomNames = group
          .map((b: any) => roomMap.get(b.room_id) || `Room ${b.room_id}`)
          .sort()
          .join(", ");
          
        const courseName =
          mainBooking.course_name ||
          (mainBooking.course_id ? courseMap.get(mainBooking.course_id) : "N/A") ||
          "N/A";
          
        const duration = calculateDuration(mainBooking.start_time, mainBooking.end_time);
        
        // Calculate student count
        // Check for special bulk format in student_numbers: "bulk booking - [UUID] - [count]"
        let studentCount = 0;
        const bulkMatch = mainBooking.student_numbers?.match(/^bulk booking - [0-9a-fA-F-]+ - (\d+)$/);
        
        if (bulkMatch && mainBooking.bulk_booking_id) {
           studentCount = parseInt(bulkMatch[1], 10);
        } else {
           const sn = mainBooking.student_numbers || "";
           // Only count lines if it is NOT a bulk string format we missed
           if (!sn.startsWith("bulk booking -")) {
               studentCount = sn.split("\n").filter((l: string) => l.trim()).length;
           }
        }

        // Parse local date from YYYY-MM-DD
        const [y, m, d] = (mainBooking.booking_day || "").split('-').map((n: string) => parseInt(n, 10));
        const bookingDate = (y && m && d) ? new Date(y, m - 1, d) : new Date(0);

        // Convert time string HH:mm:ss to Excel fraction of a day (0.0 to 1.0)
        // This ensures purely Time values without Date components in Excel
        const timeToFraction = (timeStr: string) => {
            if (!timeStr) return 0;
            const parts = timeStr.split(':').map((n: string) => parseInt(n, 10));
            // Hours * 3600 + Minutes * 60 + Seconds
            const seconds = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
            return seconds / 86400; // 86400 seconds in a day
        };
        const startTime = timeToFraction(mainBooking.start_time);
        const endTime = timeToFraction(mainBooking.end_time);

        return {
          Date: bookingDate,
          Room: roomNames,
          Course: courseName,
          "Start Time": startTime,
          "End Time": endTime,
          "Duration (Hours)": Number(duration.toFixed(2)),
          "Booked By": mainBooking.booked_by,
          "Student Numbers": mainBooking.bulk_booking_id ? "" : mainBooking.student_numbers,
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
          "Total Hours": Number(stats.hours.toFixed(2)),
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
          "Total Hours": Number(stats.hours.toFixed(2)),
        }))
        .sort((a, b) => a.Course.localeCompare(b.Course));

      // 5. Generate Excel File
      const wb = XLSX.utils.book_new();

      const ws1 = XLSX.utils.json_to_sheet(rawData || [], { cellDates: true });

      // Apply Column Formatting: Raw Data
      if (ws1['!ref']) {
        const range = XLSX.utils.decode_range(ws1['!ref']);
        const timeFmt = XLSX.SSF.get_table()[20] || 'h:mm'; // Use 24-hour Time format (ID 20)

        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          // Date (A)
          const dateCell = ws1[XLSX.utils.encode_cell({r: R, c: 0})];
          if (dateCell) { dateCell.t = 'd'; dateCell.z = 'm/d/yy'; }

          // Room (B), Course (C)
          const roomCell = ws1[XLSX.utils.encode_cell({r: R, c: 1})];
          if (roomCell) { roomCell.t = 's'; roomCell.z = '@'; }
          
          const courseCell = ws1[XLSX.utils.encode_cell({r: R, c: 2})];
          if (courseCell) { courseCell.t = 's'; courseCell.z = '@'; }

          // Start Time (D), End Time (E)
          const startCell = ws1[XLSX.utils.encode_cell({r: R, c: 3})];
          if (startCell) { startCell.t = 'n'; startCell.z = timeFmt; }
          
          const endCell = ws1[XLSX.utils.encode_cell({r: R, c: 4})];
          if (endCell) { endCell.t = 'n'; endCell.z = timeFmt; }

          // Duration (F)
          const durCell = ws1[XLSX.utils.encode_cell({r: R, c: 5})];
          if (durCell) { durCell.t = 'n'; durCell.z = '0.00'; }

          // Booked By (G), Student Numbers (H)
          const bookedByCell = ws1[XLSX.utils.encode_cell({r: R, c: 6})];
          if (bookedByCell) { bookedByCell.t = 's'; bookedByCell.z = '@'; }
          
          const studNumCell = ws1[XLSX.utils.encode_cell({r: R, c: 7})];
          if (studNumCell) { studNumCell.t = 's'; studNumCell.z = '@'; }

          // Student Count (I)
          const studCountCell = ws1[XLSX.utils.encode_cell({r: R, c: 8})];
          if (studCountCell) { studCountCell.t = 'n'; studCountCell.z = '0'; }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws1, "Raw Data");

      // Helper for other reports
      const formatStatSheet = (ws: XLSX.WorkSheet) => {
        if (!ws['!ref']) return;
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
           const labelCell = ws[XLSX.utils.encode_cell({r: R, c: 0})];
           if (labelCell) { labelCell.t = 's'; labelCell.z = '@'; }
           
           const countCell = ws[XLSX.utils.encode_cell({r: R, c: 1})];
           if (countCell) { countCell.t = 'n'; countCell.z = '0'; }
           
           const hourCell = ws[XLSX.utils.encode_cell({r: R, c: 2})];
           if (hourCell) { hourCell.t = 'n'; hourCell.z = '0.00'; }
        }
      };

      const ws2 = XLSX.utils.json_to_sheet(roomReport);
      formatStatSheet(ws2);
      XLSX.utils.book_append_sheet(wb, ws2, "Room Stats");

      const ws3 = XLSX.utils.json_to_sheet(courseReport);
      formatStatSheet(ws3);
      XLSX.utils.book_append_sheet(wb, ws3, "Course Stats");

      // Auto-width columns
      const setColWidth = (ws: XLSX.WorkSheet, data: any[]) => {
        if (data.length === 0) return;
        const cols = Object.keys(data[0]).map((key) => {
          const maxLen = Math.max(
            key.length,
            ...data.map((row) => {
              const val = row[key];
              if (val instanceof Date) return 12; // Fixed width for dates
              return val ? val.toString().length : 0;
            })
          );
          return { wch: maxLen + 2 };
        });
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
    <Box sx={{ bgcolor: "background.default", minHeight: "100%", pb: { xs: 8, md: 12 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 1, md: 3 }, pt: { xs: 2, md: 3 } }}>
        <Grid container spacing={{ xs: 2, md: 3 }}>
            {/* Control Panel */}
            <Grid item xs={12}>
                <Paper sx={{ p: { xs: 2, md: 3 }, display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 2, md: 4 }, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
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
                             <Typography variant="body2" color="text.secondary">Complete data of all bookings.</Typography>
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
                             <Typography variant="body2" color="text.secondary">Usage by room.</Typography>
                        </Box>
                    </Box>
                     <Divider />
                    <Box sx={{ p: 2, bgcolor: 'action.hover', height: '100%' }}>
                         <Typography variant="caption" color="text.secondary" component="div">
                            <Stack spacing={1}>
                                <Box>• Total booking count</Box>
                                <Box>• Total hours utilized</Box>
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
                             <Typography variant="body2" color="text.secondary">Usages by course.</Typography>
                        </Box>
                    </Box>
                     <Divider />
                    <Box sx={{ p: 2, bgcolor: 'action.hover', height: '100%' }}>
                         <Typography variant="caption" color="text.secondary" component="div">
                            <Stack spacing={1}>
                                <Box>• Bookings per course</Box>
                                <Box>• Hours allocated to course</Box>
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
