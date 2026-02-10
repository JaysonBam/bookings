import { useState, useEffect, useRef, SyntheticEvent, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import timeLib from "../../lib/time";
import { TopToolbar } from "./components/TopToolbar";
import { BookingGrid } from "./components/BookingGrid";
import { BookingPanel } from "./components/BookingPanel";
import { SearchPanel } from "./components/SearchPanel";
import { useConfirm, ConfirmDialogProvider } from "./context/ConfirmDialogContext";
import { NowProvider } from "./context/NowContext";
import { Snackbar, Alert } from "@mui/material";
import { StyledPageContainer, StyledContentContainer, StyledGridContainer } from "./styles";
import { useLayout } from "../../components/LayoutContext";
import { useBookingActions } from "./hooks/useBookingActions";

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

    const { handleMoveBooking, handleExtendBooking, handleQuickAction } = useBookingActions({
        rooms,
        confirm,
        showToast,
        setRefreshGridTrigger
    });

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