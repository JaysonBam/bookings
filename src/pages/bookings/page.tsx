import { useState, useEffect, useRef, SyntheticEvent, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import timeLib from "../../lib/time";
import { TopToolbar } from "./components/TopToolbar";
import { BookingGrid } from "./components/BookingGrid";
import { BookingPanel } from "./components/BookingPanel";
import { SearchPanel } from "./components/SearchPanel";
import { useConfirm, ConfirmDialogProvider } from "./context/ConfirmDialogContext";
import { NowProvider } from "./context/NowContext";
import { format, parseISO } from "date-fns";
import { Snackbar, Alert } from "@mui/material";
import { StyledPageContainer, StyledContentContainer, StyledGridContainer } from "./styles";
import { useLayout } from "../../components/LayoutContext";
import { useBookings } from "./hooks/useBookings";
import { useRooms } from "./hooks/useRooms";
import { getSmartPanelTime, formatBorrowedItems, roundToNearest30 } from "./utils/bookingLogic";

const BookingsContent = () => {
    const { confirm } = useConfirm();
    const { setHeaderContent } = useLayout();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [currentUser, setCurrentUser] = useState<string>("");

    // Hook Data
    const { bookings, loading: bookingsLoading, refreshBookings } = useBookings(selectedDate);
    const { rooms, loading: roomsLoading } = useRooms();

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
            }
        })();
    }, []);
    const [panelOpen, setPanelOpen] = useState(false);
    const [panelData, setPanelData] = useState<any>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
    const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        const now = await timeLib.getTime();
        const smartTime = getSmartPanelTime(now);
        setPanelData({ timeSlot: smartTime.toISOString() });
        setPanelOpen(true);
    }, []);

    const handleCellClick = (roomId: string, timeSlotIso: string) => {
        setPanelData({ roomId, timeSlot: timeSlotIso });
        setPanelOpen(true);
    };

    const handleBookingClick = (bookingId: string) => {
        // Find in our local data first if available, otherwise fetch or just use ID
        const localBooking = bookings.find(b => b.id === bookingId);
        if (localBooking) {
            setPanelData({ booking: localBooking });
            setPanelOpen(true);
        } else {
            (async () => {
                try {
                    const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
                    if (error) {
                        setPanelData({ bookingId });
                    } else {
                        setPanelData({ booking: data });
                    }
                } catch (e) {
                    setPanelData({ bookingId });
                } finally {
                    setPanelOpen(true);
                }
            })();
        }
    };

    const handleQuickAction = async (bookingId: string, action: 'activate' | 'end') => {
        try {
            const newState = action === 'activate' ? 'Active' : 'Ended';

            if (action === 'end') {
                const { data: booking, error: fetchError } = await supabase
                    .from('bookings')
                    .select('start_time, end_time, booking_day, borrowed_items')
                    .eq('id', bookingId)
                    .single();

                if (fetchError) throw fetchError;

                if (booking?.borrowed_items && booking.borrowed_items.length > 0) {
                    const formattedList = formatBorrowedItems(booking.borrowed_items);
                    const verb = booking.borrowed_items.length === 1 ? 'Is' : 'Are';
                    
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
                const roundedNow = roundToNearest30(now);
                roundedNow.setSeconds(0);
                roundedNow.setMilliseconds(0);

                const bookingEnd = parseISO(`${booking.booking_day}T${booking.end_time}`);
                const bookingStart = parseISO(`${booking.booking_day}T${booking.start_time}`);

                if (roundedNow <= bookingStart) {
                     const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
                     if (error) throw error;
                     showToast("Deleted", "Booking deleted (ended before start time)", "info");
                     refreshBookings();
                     return;
                }

                if (roundedNow < bookingEnd) {
                    const newEndTime = format(roundedNow, "HH:mm:ss");
                    const { error } = await supabase
                        .from('bookings')
                        .update({ state: newState, end_time: newEndTime })
                        .eq('id', bookingId);
                    if (error) throw error;
                    showToast("Success", `Booking ended early at ${format(roundedNow, "HH:mm")}`, "success");
                    refreshBookings();
                    return;
                }
            }

            const { error } = await supabase
                .from('bookings')
                .update({ state: newState })
                .eq('id', bookingId);

            if (error) throw error;
            
            showToast("Success", `Booking ${newState.toLowerCase()}`, "success");
            refreshBookings();
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
                        rooms={rooms}
                        bookings={bookings}
                        loading={bookingsLoading || roomsLoading}
                        onCellClick={handleCellClick}
                        onBookingClick={handleBookingClick}
                        onQuickAction={handleQuickAction}
                        highlightedBookingId={highlightedBookingId}
                    />
                </StyledGridContainer>
                <SearchPanel 
                    isOpen={isSearchOpen} 
                    onClose={() => setIsSearchOpen(false)} 
                    bookings={bookings} 
                    loading={bookingsLoading}
                    onBookingSelect={handleBookingSelect}
                />
            </StyledContentContainer>

            <BookingPanel
                open={panelOpen}
                onClose={() => { setPanelOpen(false); setPanelData(null); }}
                prefill={panelData}
                defaultStaffName={currentUser}
                showToast={showToast}
                onBookingUpdate={refreshBookings}
                rooms={rooms}
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
