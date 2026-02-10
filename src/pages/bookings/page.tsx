import { useState, useEffect, useRef, SyntheticEvent, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import timeLib from "../../lib/time";
import { TopToolbar } from "./components/TopToolbar";
import { BookingGrid } from "./components/BookingGrid";
import { BookingPanel } from "./components/BookingPanel";
import { SearchPanel } from "./components/SearchPanel";
import { useConfirm, ConfirmDialogProvider } from "./context/ConfirmDialogContext";
import { NowProvider } from "./context/NowContext";
import { format, parseISO, differenceInMinutes, addMinutes } from "date-fns";
import { Snackbar, Alert } from "@mui/material";
import { StyledPageContainer, StyledContentContainer, StyledGridContainer } from "./styles";
import { useLayout } from "../../components/LayoutContext";
import { logEvent } from "../../lib/log";

const BookingsContent = () => {
    const { confirm } = useConfirm();
    const { setHeaderContent } = useLayout();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [currentUser, setCurrentUser] = useState<string>("");

    // Snackbar state
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");
    const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error" | "info">("info");

    const showToast = (title: string, description: string, severity: "success" | "error" | "info" = "success") => {
        setSnackbarMessage(`${title}: ${description}`);
        setSnackbarSeverity(severity);
        setSnackbarOpen(true);
    };

    const handleSnackbarClose = (_?: SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') return;
        setSnackbarOpen(false);
    };

    // On mount, if testing clock is enabled in settings, use that time/date as the selectedDate
    useEffect(() => {
        (async () => {
            try {
                const t = await timeLib.getTime();
                setSelectedDate(t);
            } catch (e) {
                // ignore and keep system date
                // Silent failure is acceptable here as it falls back to system time
            }
        })();
    }, []);
    const [panelOpen, setPanelOpen] = useState(false);
    const [panelData, setPanelData] = useState<any>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
    const [refreshGridTrigger, setRefreshGridTrigger] = useState(0);
    const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [creationStartTime, setCreationStartTime] = useState<number | null>(null);

    // Static data caching
    const [rooms, setRooms] = useState<any[]>([]);
    const [courses, setCourses] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [{ data: roomsData, error: roomsError }, { data: coursesData, error: coursesError }] = await Promise.all([
                    supabase.from("rooms").select("id,name,borrowable_items,is_available,dynamic_labels,max_people,min_people").order("name"),
                    supabase.from("courses").select("id,name").order("name"),
                ]);
                
                if (roomsError) throw roomsError;
                if (coursesError) throw coursesError;

                setRooms((roomsData || []).filter((r: any) => r.is_available !== false).map((r: any) => ({ ...r, id: String(r.id) })));
                setCourses(coursesData || []);
            } catch (error) {
                console.error("Failed to load initial data", error);
                showToast("Error", "Failed to load rooms and courses. Please refresh.", "error");
            }
        };
        fetchData();
    }, []);

    const handleBookingSelect = (id: string) => {
        setHighlightedBookingId(id);
        if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedBookingId(null);
        }, 3000);
    };

    const handleBookClick = useCallback(async () => {
        // open panel with current time rounded to nearest 30 minutes (no room selected)
        const now = await timeLib.getTime();

        // Fetch operational hours
        const { data: settings } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'operation_hours')
            .maybeSingle();

        let openTime = "06:00";
        let closeTime = "21:00";

        if (settings?.value) {
            const val = settings.value as any;
            openTime = val.start ?? val.open ?? "06:00";
            closeTime = val.end ?? val.close ?? "21:00";
        }

        const [closeH, closeM] = closeTime.split(':').map(Number);
        const [openH, openM] = openTime.split(':').map(Number);

        const mins = now.getMinutes();
        const rem = mins % 30;
        if (rem < 15) now.setMinutes(mins - rem);
        else now.setMinutes(mins + (30 - rem));
        now.setSeconds(0, 0);

        const nowH = now.getHours();
        const nowM = now.getMinutes();

        // If after close or before open, set to open time
        if ((nowH > closeH) || (nowH === closeH && nowM >= closeM) || (nowH < openH) || (nowH === openH && nowM < openM)) {
            now.setHours(openH);
            now.setMinutes(openM);
        }

        setPanelData({ timeSlot: now.toISOString() });
        setCreationStartTime(Date.now());
        setPanelOpen(true);
    }, []);

    const handleCellClick = (roomId: string, timeSlotIso: string, duration = 30) => {
        setPanelData({ roomId, timeSlot: timeSlotIso, duration });
        setCreationStartTime(Date.now());
        setPanelOpen(true);
    };

    const handleMoveBooking = async (bookingId: string, newRoomId: string, newStartTime: string) => {
        const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
        if (!booking) return;

        const newRoom = rooms.find(r => r.id === newRoomId)?.name || "New Room";
        const newStart = parseISO(newStartTime);
        const timeStr = format(newStart, "HH:mm");

        try {
            const confirmed = await confirm({
                title: "Confirm Move",
                description: `Move "${booking.course_name || 'Booking'}" to ${newRoom} at ${timeStr}?`,
                confirmText: "Move",
                cancelText: "Cancel"
            });

            if (!confirmed) return;

            // Handle start/end parsing robustly. Booking usually stores "YYYY-MM-DD" in booking_day 
            // and "HH:mm:ss" in start_time/end_time.
            // When moving, newStartTime is a full ISO date string.
            
            // 1. Calculate original duration
            const originalStart = parseISO(`${booking.booking_day}T${booking.start_time}`);
            const originalEnd = parseISO(`${booking.booking_day}T${booking.end_time}`);
            const duration = differenceInMinutes(originalEnd, originalStart);

            // 2. Calculate new end date (Full Date Object)
            const newStartObj = parseISO(newStartTime);
            const newEndObj = addMinutes(newStartObj, duration);

            // 3. Extract parts for Supabase update (Time vs Date columns)
            // 'start_time' and 'end_time' are usually TIME columns. 'booking_day' is DATE.
            const newBookingDay = format(newStartObj, 'yyyy-MM-dd');
            const newStartTimeStr = format(newStartObj, 'HH:mm:ss');
            const newEndTimeStr = format(newEndObj, 'HH:mm:ss');

            // Optimistic update or just wait for refresh?
            // Let's do direct DB update
            const { error } = await supabase
                .from('bookings')
                .update({ 
                    room_id: newRoomId, 
                    booking_day: newBookingDay,
                    start_time: newStartTimeStr,
                    end_time: newEndTimeStr 
                })
                .eq('id', bookingId);
            
            if (error) throw error;
            
            showToast("Success", "Booking moved successfully", "success");
            setRefreshGridTrigger(prev => prev + 1);

        } catch (error) {
            console.error("Move failed:", error);
            showToast("Error", "Failed to move booking", "error");
        }
    };

    const handleExtendBooking = async (bookingId: string, durationMinutes: number) => {
        const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
        if (!booking) return;

        // Start of extension is the end of the original booking
        const startOfExtension = parseISO(`${booking.booking_day}T${booking.end_time}`);
        const endOfExtension = addMinutes(startOfExtension, durationMinutes);
        
        const startTimeStr = format(startOfExtension, "HH:mm:ss");
        const endTimeStr = format(endOfExtension, "HH:mm:ss");

        try {
            const confirmed = await confirm({
                title: "Confirm Extension",
                description: `Create extension for "${booking.course_name || 'Booking'}" (+${durationMinutes} min)?`,
                confirmText: "Extend",
                cancelText: "Cancel"
            });

            if (!confirmed) return;
            
            // 1. End the previous booking (as per methodology)
            // Time: Start -> End (Original end time)
            // State: Active -> Ended
             const { error: updateError } = await supabase
                 .from('bookings')
                 .update({ state: 'Ended' })
                 .eq('id', bookingId);

             if (updateError) throw updateError;
             
             // Log the state change for the old booking
             await logEvent('state_change', {
                 type: 'extended',
                 state: 'active_to_ended',
                 time: 0 // rough estimate or diff from now? Panel uses diff(now, originalEnd). We can use 0 for simplicity or calc it.
             });

            // 2. Create New Booking (Clone logic)
             const newPayload = {
                 room_id: booking.room_id,
                 booking_day: booking.booking_day,
                 start_time: startTimeStr,
                 end_time: endTimeStr,
                 state: 'Active',
                 booked_by: booking.booked_by,
                 course_id: booking.course_id,
                 course_name: booking.course_name,
                 borrowed_items: booking.borrowed_items,
                 student_numbers: booking.student_numbers,
                 description: booking.description,
                 bulk_booking_id: booking.bulk_booking_id,
                 title: booking.title,
                 color: booking.color
             };

             const { error } = await supabase.from("bookings").insert(newPayload);

            if (error) throw error;
            
            await logEvent('booking_create', {
                 type: 'extension',
                 rank: null,
                 name_entered: 'auto', 
                 state: 'active',
                 time: 0
            });
            
            showToast("Success", "Booking extended", "success");
            setRefreshGridTrigger(prev => prev + 1);

        } catch (error) {
            console.error("Extension failed:", error);
            showToast("Error", "Failed to extend booking", "error");
        }
    };

    const handleBookingClick = (bookingId: string) => {
        // fetch booking details and open panel in edit mode
        (async () => {
            try {
                const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
                if (error) {
                    console.error('Error fetching booking', error);
                    showToast("Error", "Could not load full booking details", "error");
                    // still open panel with id only as fallback
                    setPanelData({ bookingId });
                } else {
                    setPanelData({ booking: data });
                }
            } catch (e) {
                console.error('Failed to load booking', e);
                showToast("Error", "Failed to load booking details", "error");
                setPanelData({ bookingId });
            } finally {
                setPanelOpen(true);
            }
        })();
    };

    const handleQuickAction = async (bookingId: string, action: 'activate' | 'end') => {
        try {
            // Fetch booking to check valid bulk ID
            const { data: booking, error: fetchError } = await supabase
                .from('bookings')
                .select('start_time, end_time, booking_day, borrowed_items, bulk_booking_id')
                .eq('id', bookingId)
                .single();

            if (fetchError || !booking) throw fetchError || new Error("Booking not found");

            let scope = 'single';
            if (booking.bulk_booking_id) {
                 const result = await confirm({
                     title: action === 'activate' ? "Activate Booking" : "End Booking",
                     description: `This booking is part of a bulk group.`,
                     cancelText: "Cancel",
                     actions: [
                         { label: `${action === 'activate' ? 'Activate' : 'End'} This Only`, value: 'single', variant: 'outlined' },
                         { label: `${action === 'activate' ? 'Activate' : 'End'} Entire Group`, value: 'group', variant: 'contained' }
                     ]
                 });
                 if (!result) return;
                 scope = result;
            }

            const newState = action === 'activate' ? 'Active' : 'Ended';

            if (action === 'end') {
                // If it's a group end action, we apply simple state update to End time, or complex logic?
                // The user requested "delete this booking or delete all booking".
                // Logic: If ending early, we might encounter complications with distinct start/end times in a group.
                // Simplification for group: Just set state to Ended. We can't intelligently truncate time for 50 different bookings at once easily without more inputs.
                // However, for single booking, we keep the truncation logic.
                
                if (scope === 'single') {
                    if (booking?.borrowed_items && booking.borrowed_items.length > 0) {
                        const lowercasedItems = booking.borrowed_items.map((item: string) => item.toLowerCase());
                        const itemsList = lowercasedItems.join(', ');
                        const lastIndex = itemsList.lastIndexOf(', ');
                        const formattedList = lastIndex !== -1 
                            ? itemsList.substring(0, lastIndex) + ' and ' + itemsList.substring(lastIndex + 2)
                            : itemsList;
                        
                        const verb = lowercasedItems.length === 1 ? 'Is' : 'Are';
                        const returned = await confirm({
                            title: "Confirm Return",
                            description: `${verb} ${formattedList} returned?`,
                            confirmText: "Yes",
                            cancelText: "No",
                        });
                        if (!returned) return;
                    }

                    // Truncate logic
                    const now = await timeLib.getTime();
                    const m = now.getMinutes();
                    const roundedM = Math.round(m / 30) * 30;
                    now.setMinutes(roundedM);
                    now.setSeconds(0);
                    now.setMilliseconds(0);

                    const bookingEnd = parseISO(`${booking.booking_day}T${booking.end_time}`);
                    const bookingStart = parseISO(`${booking.booking_day}T${booking.start_time}`);

                    if (now < bookingEnd) {
                        if (now <= bookingStart) {
                             // Delete
                             const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
                             if (error) throw error;
                             showToast("Deleted", "Booking deleted (ended before start time)", "info");
                             return;
                        } else {
                            // Truncate
                            const newEndTime = format(now, "HH:mm:ss");
                            const { error } = await supabase
                                .from('bookings')
                                .update({ state: newState, end_time: newEndTime })
                                .eq('id', bookingId);
                            if (error) throw error;

                            await logEvent('state_change', {
                                type: 'quick',
                                state: 'active_to_ended',
                                time: differenceInMinutes(now, bookingEnd)
                            });

                            showToast("Success", `Booking ended early at ${format(now, "HH:mm")}`, "success");
                            return;
                        }
                    } else {
                         // Past End Time
                         const { error } = await supabase
                            .from('bookings')
                            .update({ state: newState })
                            .eq('id', bookingId);
                         if (error) throw error;
                         
                         await logEvent('state_change', {
                             type: 'quick',
                             state: 'active_to_ended',
                             time: differenceInMinutes(now, bookingEnd)
                         });
                         
                         showToast("Success", "Booking ended", "success");
                         return;
                    }
                } else {
                    // Group End
                    // We just end them. We don't truncate time because they might be on different days or times.
                    // Just marking them as 'Ended' stops them from being Active.
                    const { error } = await supabase
                        .from('bookings')
                        .update({ state: newState })
                        .eq('bulk_booking_id', booking.bulk_booking_id);
                    if (error) throw error;
                    
                    const now = await timeLib.getTime();
                    const bEnd = parseISO(`${booking.booking_day}T${booking.end_time}`);
                    await logEvent('state_change', {
                        type: 'quick',
                        state: 'active_to_ended',
                        time: differenceInMinutes(now, bEnd)
                    });

                    showToast("Success", `Group ended`, "success");
                    return;
                }
            }

            // ACTIVATE Logic
            const nowForLog = await timeLib.getTime();
            const bStart = parseISO(`${booking.booking_day}T${booking.start_time}`);

            if (scope === 'group') {
                const { error } = await supabase
                    .from('bookings')
                    .update({ state: newState })
                    .eq('bulk_booking_id', booking.bulk_booking_id);
                if (error) throw error;
                 
                 await logEvent('state_change', {
                    type: 'quick',
                    state: 'reserved_to_active', 
                    time: differenceInMinutes(nowForLog, bStart)
                 });

                 showToast("Success", `Group ${newState.toLowerCase()}`, "success");
            } else {
                const { error } = await supabase
                    .from('bookings')
                    .update({ state: newState })
                    .eq('id', bookingId);
                if (error) throw error;

                 await logEvent('state_change', {
                    type: 'quick',
                    state: 'reserved_to_active',
                    time: differenceInMinutes(nowForLog, bStart)
                 });

                 showToast("Success", `Booking ${newState.toLowerCase()}`, "success");
            }
        } catch (err: any) {
            console.error("Quick action failed", err);
            showToast("Error", "Failed to update booking", "error");
        }
    };

    useEffect(() => {
        setHeaderContent(
            <TopToolbar
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onBookClick={handleBookClick}
                onSearchClick={() => setIsSearchOpen(prev => !prev)}
                currentUser={currentUser}
                onUserChange={setCurrentUser}
            />
        );
        return () => setHeaderContent(null);
    }, [selectedDate, currentUser, setHeaderContent, handleBookClick]);

    return (
        <StyledPageContainer>
            <StyledContentContainer>
                <StyledGridContainer>
                    <BookingGrid
                        selectedDate={selectedDate}
                        onCellClick={handleCellClick}
                        onBookingClick={handleBookingClick}
                        onQuickAction={handleQuickAction}
                        onMoveBooking={handleMoveBooking}
                        onExtendBooking={handleExtendBooking}
                        highlightedBookingId={highlightedBookingId}
                        refreshTrigger={refreshGridTrigger}
                        showToast={showToast}
                    />
                </StyledGridContainer>
                <SearchPanel 
                    isOpen={isSearchOpen} 
                    onClose={() => setIsSearchOpen(false)} 
                    selectedDate={selectedDate}
                    onBookingSelect={handleBookingSelect}
                    showToast={showToast}
                />
            </StyledContentContainer>

            <BookingPanel
                key={panelOpen ? (panelData?.booking?.id ? `edit-${panelData.booking.id}` : `new-${panelData?.roomId || ''}-${panelData?.timeSlot || ''}`) : 'closed'}
                open={panelOpen}
                onClose={() => { setPanelOpen(false); setPanelData(null); setCreationStartTime(null); }}
                prefill={panelData}
                defaultStaffName={currentUser}
                showToast={showToast}
                onBookingUpdate={() => setRefreshGridTrigger(prev => prev + 1)}
                rooms={rooms}
                courses={courses}
                creationStartTime={creationStartTime}
            />
             <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
                <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </StyledPageContainer>
    );
};

const Bookings = () => {
    return (
        <ConfirmDialogProvider>
            <NowProvider>
                <BookingsContent />
            </NowProvider>
        </ConfirmDialogProvider>
    );
};

export default Bookings;