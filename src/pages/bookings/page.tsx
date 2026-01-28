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
            }
        })();
    }, []);
    const [panelOpen, setPanelOpen] = useState(false);
    const [panelData, setPanelData] = useState<any>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
    const [refreshGridTrigger, setRefreshGridTrigger] = useState(0);
    const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Static data caching
    const [rooms, setRooms] = useState<any[]>([]);
    const [courses, setCourses] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const [{ data: roomsData }, { data: coursesData }] = await Promise.all([
                supabase.from("rooms").select("id,name,borrowable_items,is_available,dynamic_labels,max_people,min_people").order("name"),
                supabase.from("courses").select("id,name").order("name"),
            ]);
            setRooms((roomsData || []).filter((r: any) => r.is_available !== false).map((r: any) => ({ ...r, id: String(r.id) })));
            setCourses(coursesData || []);
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
        const mins = now.getMinutes();
        const rem = mins % 30;
        if (rem < 15) now.setMinutes(mins - rem);
        else now.setMinutes(mins + (30 - rem));
        now.setSeconds(0, 0);
        setPanelData({ timeSlot: now.toISOString() });
        setPanelOpen(true);
    }, []);

    const handleCellClick = (roomId: string, timeSlotIso: string) => {
        setPanelData({ roomId, timeSlot: timeSlotIso });
        setPanelOpen(true);
    };

    const handleBookingClick = (bookingId: string) => {
        // fetch booking details and open panel in edit mode
        (async () => {
            try {
                const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
                if (error) {
                    console.error('Error fetching booking', error);
                    // still open panel with id only as fallback
                    setPanelData({ bookingId });
                } else {
                    setPanelData({ booking: data });
                }
            } catch (e) {
                console.error('Failed to load booking', e);
                setPanelData({ bookingId });
            } finally {
                setPanelOpen(true);
            }
        })();
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
                        showToast("Success", `Booking ended early at ${format(now, "HH:mm")}`, "success");
                        return;
                    }
                }
            }

            const { error } = await supabase
                .from('bookings')
                .update({ state: newState })
                .eq('id', bookingId);

            if (error) throw error;
            
            showToast("Success", `Booking ${newState.toLowerCase()}`, "success");
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
                        highlightedBookingId={highlightedBookingId}
                        refreshTrigger={refreshGridTrigger}
                    />
                </StyledGridContainer>
                <SearchPanel 
                    isOpen={isSearchOpen} 
                    onClose={() => setIsSearchOpen(false)} 
                    selectedDate={selectedDate}
                    onBookingSelect={handleBookingSelect}
                />
            </StyledContentContainer>

            <BookingPanel
                key={panelOpen ? (panelData?.booking?.id ? `edit-${panelData.booking.id}` : `new-${panelData?.roomId || ''}-${panelData?.timeSlot || ''}`) : 'closed'}
                open={panelOpen}
                onClose={() => { setPanelOpen(false); setPanelData(null); }}
                prefill={panelData}
                defaultStaffName={currentUser}
                showToast={showToast}
                onBookingUpdate={() => setRefreshGridTrigger(prev => prev + 1)}
                rooms={rooms}
                courses={courses}
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