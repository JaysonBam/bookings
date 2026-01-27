import React, { useEffect, useState, useMemo } from "react";
import { 
    Dialog, DialogContent, DialogTitle, DialogActions, 
    Button, Box, CircularProgress, Grid,
    FormControlLabel, Switch, TextField, MenuItem
} from '@mui/material';
import { supabase } from "../../../lib/supabaseClient";
import { format, parseISO } from "date-fns";
import { useConfirm } from "../context/ConfirmDialogContext";
import { useNow } from "../context/NowContext";
import { getOptimalRooms } from "../utils/smartSelectLogic";
import { useBookingForm } from "../hooks/useBookingForm";
import { useBookingMutations } from "../hooks/useBookingMutations";
import { BulkBookingFields } from "./BookingForm/BulkBookingFields";
// import { BookingCourseFields } from "./BookingForm/BookingCourseFields"; // Moved inside specific fields
import { SingleBookingFields } from "./BookingForm/SingleBookingFields";

interface BookingPanelProps {
  open: boolean;
  onClose: () => void;
  prefill?: { roomId?: string; timeSlot?: string; booking?: any } | null;
  defaultStaffName?: string;
  showToast?: (title: string, description: string, severity?: "success" | "error" | "info") => void;
  onBookingUpdate?: () => void;
  rooms?: any[];
}

export const BookingPanel: React.FC<BookingPanelProps> = ({ open, onClose, prefill = null, defaultStaffName = "", showToast = () => {}, onBookingUpdate, rooms: propRooms }) => {
  const { confirm } = useConfirm();
  const { currentTime } = useNow();

  const [rooms, setRooms] = useState<any[]>(propRooms || []);
  const [courses, setCourses] = useState<any[]>([]);

  useEffect(() => {
    if (propRooms) {
        setRooms(propRooms);
    }
  }, [propRooms]);

  // useBookingForm handles all form state
  const form = useBookingForm(open, prefill, defaultStaffName, rooms);
  
  // useBookingMutations handles database operations
  const { handleSingleSave, handleBulkSave, handleDelete } = useBookingMutations(
      form, prefill, onClose, onBookingUpdate, showToast, confirm
  );

  // Smart Select State (Keep mostly local as it interacts with both data and UI)
  const [isSmartSelecting, setIsSmartSelecting] = useState(false);
  const [rankedRooms, setRankedRooms] = useState<any[]>([]);
  const [currentRankIndex, setCurrentRankIndex] = useState(0);

  // Load Metadata
  useEffect(() => {
    if (!open) return;
    const load = async () => {
        // If we already have rooms from props, don't re-fetch them
        const promises = [];
        if (!propRooms || propRooms.length === 0) {
            promises.push(supabase.from("rooms").select("id,name,borrowable_items,is_available,dynamic_labels,capacity,is_open").order("name"));
        } else {
            promises.push(Promise.resolve({ data: null })); // Placeholder
        }
        
        // Always fetch courses (unless we add a prop for it later)
        promises.push(supabase.from("courses").select("id,name").order("name"));

        const [roomsResult, coursesResult] = await Promise.all(promises);
        
        if (roomsResult.data) {
             const rlist = (roomsResult.data || []).filter((r: any) => r.is_available !== false).map((r: any) => ({ ...r, id: String(r.id) }));
             setRooms(rlist);
        }
        
        setCourses(coursesResult.data || []);
    };
    load();
  }, [open, propRooms]);

  // Load Day Bookings for Context (Overlaps/Status)
  useEffect(() => {
    if (!form.startDate || !open) return;
    const fetchBookings = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, room_id, start_time, end_time, state, booking_day')
        .eq('booking_day', form.startDate);
      if (!error && data) form.setDayBookings(data);
    };
    fetchBookings();
  }, [form.startDate, open]);


  // --- Helper Logic for UI (Smart Select & Status) ---

  const handleSmartSelect = async () => {
    const sizeStr = window.prompt("Enter Group Size:");
    if (!sizeStr) return;
    const size = parseInt(sizeStr, 10);
    if (isNaN(size)) {
        showToast("Invalid size", "Please enter a number", "error");
        return;
    }

    let targetDate = new Date();
    try {
        targetDate = parseISO(`${form.startDate}T${form.startClock}`);
    } catch (e) { console.error(e); }

    // Ensure we have books
    if (form.dayBookings.length === 0) {
        // May need to re-fetch if state not ready?
        // But useEffect above should handle it.
    }

    const ranked = getOptimalRooms(size, rooms, form.dayBookings, targetDate);
    
    if (ranked.length === 0) {
        showToast("No rooms found", "No rooms match.", "info");
        return;
    }

    setRankedRooms(ranked);
    setCurrentRankIndex(0);
    form.setRoomId(String(ranked[0].id));
    setIsSmartSelecting(true);
  };

  const selectNextRankedRoom = () => {
      if (rankedRooms.length === 0) return;
      const nextIndex = (currentRankIndex + 1) % rankedRooms.length;
      setCurrentRankIndex(nextIndex);
      form.setRoomId(String(rankedRooms[nextIndex].id));
  };

  const getRoomStatus = (rId: string) => {
    if (!form.startClock || !form.startDate) return null;
    const isToday = format(currentTime, "yyyy-MM-dd") === form.startDate;
    const [h, m] = form.startClock.split(':').map(Number);
    const selectedTimeMins = h * 60 + m;
    const overlappingBooking = form.dayBookings.find(b => {
        if (String(b.room_id) !== String(rId)) return false;
        if (prefill?.booking && String(b.id) === String(prefill.booking.id)) return false;
        const [sh, sm] = b.start_time.split(':').map(Number);
        const [eh, em] = b.end_time.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        return startMins <= selectedTimeMins && endMins > selectedTimeMins;
    });
    if (overlappingBooking) {
        if (overlappingBooking.state === 'Active') return { color: 'error.main', text: 'Occupied' };
        if (isToday && overlappingBooking.state === 'Reserved') {
             const startDateObj = new Date(`${overlappingBooking.booking_day}T${overlappingBooking.start_time}`);
             const lateThreshold = new Date(startDateObj.getTime() + 10 * 60000);
             if (currentTime > lateThreshold) {
                 const diff = Math.floor((currentTime.getTime() - startDateObj.getTime()) / 60000);
                 return { color: 'warning.main', text: `${diff} min late` };
             }
             return { color: 'warning.light', text: 'Reserved' };
        }
        if (overlappingBooking.state === 'Reserved') return { color: 'warning.light', text: 'Reserved' };
    }
    // Overdue check
    if (isToday) {
        const overdueBooking = form.dayBookings.find(b => {
            if (String(b.room_id) !== String(rId)) return false;
            if (b.state !== 'Active') return false;
            const endDate = new Date(`${b.booking_day}T${b.end_time}`);
            return currentTime > endDate;
        });
        if (overdueBooking) {
             const endDate = new Date(`${overdueBooking.booking_day}T${overdueBooking.end_time}`);
             const diff = Math.floor((currentTime.getTime() - endDate.getTime()) / 60000);
             return { color: 'error.main', text: `Overdue ${diff} min` };
        }
    }
    return null;
  };

  const shouldHighlightReserve = useMemo(() => {
    if (!form.startDate || !form.startClock) return false;
    try {
        const selectedTime = parseISO(`${form.startDate}T${form.startClock}`);
        const roundedCurrent = new Date(currentTime);
        roundedCurrent.setMinutes(Math.round(roundedCurrent.getMinutes() / 30) * 30);
        roundedCurrent.setSeconds(0);
        return roundedCurrent < selectedTime;
    } catch (e) { return false; }
  }, [currentTime, form.startDate, form.startClock]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { overflowX: 'hidden' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
                {prefill?.booking ? "Edit Booking" : "New Booking"}
                {form.studentNumbers && ` - ${form.studentNumbers.split('\n').filter(l => l.trim()).length} students`}
            </Box>
            {!prefill?.booking && (
                <FormControlLabel 
                    control={<Switch checked={form.isBulkBooking} onChange={(e) => form.setIsBulkBooking(e.target.checked)} />} 
                    label="Bulk Mode" 
                />
            )}
        </DialogTitle>
        <DialogContent dividers sx={{ overflowX: 'hidden' }}>
            {form.loading ? (
                <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
            ) : (
                <Grid container spacing={2}>
                    {form.isBulkBooking ? (
                        <BulkBookingFields form={form} rooms={rooms} courses={courses} />
                    ) : (
                        <SingleBookingFields 
                            form={form} 
                            rooms={rooms} 
                            courses={courses}
                            isEditing={!!prefill?.booking}
                            getRoomStatus={getRoomStatus}
                            onSmartSelect={handleSmartSelect}
                            onNextRanked={selectNextRankedRoom}
                            isSmartSelecting={isSmartSelecting}
                            rankLabel={`(${currentRankIndex + 1}/${rankedRooms.length})`}
                        />
                    )}
                    
                </Grid>
            )}
        </DialogContent>
        <DialogActions>
             {prefill?.booking ? (
                 <>
                    <Box flexGrow={1} display="flex" gap={1}>
                        <TextField select size="small" label="Extend" value={form.selectedExtension} onChange={e => form.setSelectedExtension(e.target.value)} sx={{ width: 120 }}>
                            {form.availableExtensionOptions.map(m => <MenuItem key={m} value={String(m)}>+{m} mins</MenuItem>)}
                        </TextField>
                        <TextField select size="small" label="State" value={form.selectedState} onChange={e => form.setSelectedState(e.target.value as any)} sx={{ width: 120 }}>
                            <MenuItem value="Active">Active</MenuItem>
                            <MenuItem value="Reserved">Reserved</MenuItem>
                            <MenuItem value="Ended">Ended</MenuItem>
                        </TextField>
                    </Box>
                    <Button color="error" onClick={handleDelete} disabled={form.loading}>Delete</Button>
                    <Button variant="contained" onClick={() => handleSingleSave(form.selectedState)} disabled={form.loading}>Update</Button>
                 </>
             ) : (
                 <>
                    <Button onClick={onClose} color="inherit">Cancel</Button>
                     {form.isBulkBooking ? (
                        <Button variant="contained" onClick={() => handleBulkSave("Active")} disabled={form.loading}>
                            Book All
                        </Button>
                     ) : (
                         <>
                            <Button 
                                variant={shouldHighlightReserve ? "contained" : "outlined"} 
                                color={shouldHighlightReserve ? "primary" : "inherit"}
                                onClick={() => handleSingleSave("Reserved")}
                                disabled={form.loading}
                            >
                                Reserve
                            </Button>
                            <Button 
                                variant={shouldHighlightReserve ? "outlined" : "contained"} 
                                color="primary"
                                onClick={() => handleSingleSave("Active")}
                                disabled={form.loading}
                            >
                                Book (Active)
                            </Button>
                         </>
                     )}
                 </>
             )}
        </DialogActions>
    </Dialog>
  );
};
