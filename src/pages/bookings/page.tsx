/**
 * Purpose: Module logic for pages\bookings\page.tsx.
 */
import { useState, useEffect, useRef, SyntheticEvent, useCallback, useMemo } from "react";
import { deleteBooking, getBookingById, updateBooking, updateBookingGroup } from '../../api/supabase/bookings'
import timeLib from "../../lib/time";
import { TopToolbar } from "./components/TopToolbar";
import { BookingGrid } from "./components/BookingGrid";
import { BookingPanel } from "./components/BookingPanel";
import { SearchPanel } from "./components/SearchPanel";
import { useConfirm, ConfirmDialogProvider } from "./context/ConfirmDialogContext";
import { NowProvider } from "./context/NowContext";
import { BookingsDataProvider, useBookingsData } from './context/BookingsDataContext'
import { format, parseISO, differenceInMinutes, isSameDay } from "date-fns";
import { Snackbar, Alert } from "@mui/material";
import { StyledPageContainer, StyledContentContainer, StyledGridContainer } from "./styles";
import { useLayout } from "../../components/LayoutContext";
import { logEvent } from "../../lib/log";
import type { BookingRow } from '../../api/supabase/types'
import { useSession } from '../../context/SessionContext'

type BookingPanelData = {
    roomId?: string
    timeSlot?: string
    booking?: BookingRow
    bookingId?: string
}

const BookingsContent = () => {
    const { profile } = useSession();
    const { confirm } = useConfirm();
    const { setHeaderContent } = useLayout();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [dateReady, setDateReady] = useState(false);
    const [currentUser, setCurrentUser] = useState<string>("");
    useEffect(() => { setCurrentUser(profile?.full_name || ""); }, [profile?.full_name]);
    const [statusCounts, setStatusCounts] = useState<{late: number, overdue: number}>({late: 0, overdue: 0});
    const [initialSearchFilter, setInitialSearchFilter] = useState<'late' | 'overdue' | null>(null);

    const {
        rooms,
        courses,
        operationHours,
        referenceLoading,
        referenceError,
        syncState,
        lastSyncedAt,
        getBookings,
        getBooking,
        isDateLoading,
        isDateRefreshing,
        setActiveDate,
        refreshDate,
        upsertBookings,
        removeBookings,
    } = useBookingsData()
    const selectedDateKey = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate])
    const bookings = getBookings(selectedDateKey)

    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");
    const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error" | "info">("info");

    const showToast = useCallback((title: string, description: string, severity: "success" | "error" | "info" = "success") => {
        setSnackbarMessage(`${title}: ${description}`);
        setSnackbarSeverity(severity);
        setSnackbarOpen(true);
    }, []);

    const handleStatusCountsChange = useCallback((late: number, overdue: number) => {
        setStatusCounts(prev => {
            if (prev.late === late && prev.overdue === overdue) return prev;   
            return { late, overdue };
        });
    }, []);

    const handleFilterClick = useCallback((filter: 'late' | 'overdue') => {
        setInitialSearchFilter(filter);
        setIsSearchOpen(true);
    }, []);

    const handleSnackbarClose = (_?: SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') return;
        setSnackbarOpen(false);
    };

    useEffect(() => {
        if (referenceLoading) return
        let active = true
        timeLib.getTime()
            .then((time) => { if (active) setSelectedDate(time) })
            .catch((error) => console.warn('Unable to load the configured clock; using local time.', error))
            .finally(() => { if (active) setDateReady(true) })
        return () => { active = false }
    }, [referenceLoading]);

    useEffect(() => {
        if (!dateReady) return
        setActiveDate(selectedDateKey)
    }, [dateReady, selectedDateKey, setActiveDate])
    const [panelOpen, setPanelOpen] = useState(false);
    const [panelData, setPanelData] = useState<BookingPanelData | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
    const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [creationStartTime, setCreationStartTime] = useState<number | null>(null);

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

        const { start: openTime, end: closeTime } = operationHours

        const [closeH, closeM] = closeTime.split(':').map(Number);
        const [openH, openM] = openTime.split(':').map(Number);

        const mins = now.getMinutes();
        const rem = mins % 30;
        // Normalize to the nearest 30-minute slot used by the schedule grid.
        if (rem < 15) now.setMinutes(mins - rem);
        else now.setMinutes(mins + (30 - rem));
        now.setSeconds(0, 0);

        const nowH = now.getHours();
        const nowM = now.getMinutes();

        if ((nowH > closeH) || (nowH === closeH && nowM >= closeM) || (nowH < openH) || (nowH === openH && nowM < openM)) {
            now.setHours(openH);
            now.setMinutes(openM);
        }

        setPanelData({ timeSlot: now.toISOString() });
        setCreationStartTime(Date.now());
        setPanelOpen(true);
    }, [operationHours]);

    const handleCellClick = (roomId: string, timeSlotIso: string) => {
        setPanelData({ roomId, timeSlot: timeSlotIso });
        setCreationStartTime(Date.now());
        setPanelOpen(true);
    };

    const handleBookingClick = (bookingId: string) => {
        (async () => {
            try {
                const data = getBooking(bookingId) ?? await getBookingById(bookingId)
                upsertBookings([data])
                setPanelData({ booking: data });
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
        if (referenceError) showToast('Error', `${referenceError}. Refresh the page to try again.`, 'error')
    }, [referenceError, showToast])

    const handleQuickAction = async (bookingId: string, action: 'activate' | 'end', source?: 'quick' | 'double_tap') => {
        const logType = source === 'double_tap' ? 'double_tap' : 'quick';
        try {
            const booking = getBooking(bookingId) ?? await getBookingById(bookingId)
            if (!booking) throw new Error("Booking not found");

            const roomName = booking.rooms?.name || `Room ${booking.room_id}`;
            const startTime = format(parseISO(`${booking.booking_day}T${booking.start_time}`), 'HH:mm');
            const endTime = format(parseISO(`${booking.booking_day}T${booking.end_time}`), 'HH:mm');

            const now = await timeLib.getTime();
            const m = now.getMinutes();
            const roundedM = Math.round(m / 30) * 30;
            now.setMinutes(roundedM);
            now.setSeconds(0);
            now.setMilliseconds(0);

            const bookingStart = parseISO(`${booking.booking_day}T${booking.start_time}`);
            const bookingEnd = parseISO(`${booking.booking_day}T${booking.end_time}`);

            const exactNow = await timeLib.getTime();

            if (action === 'activate') {
                const confirmed = await confirm({
                    title: "Start Booking",
                    description: `Start ${startTime} - ${endTime} booking for ${roomName}?`,
                    confirmText: "Start",
                    cancelText: "Cancel"
                });
                if (!confirmed) return;
            } else if (action === 'end') {
                let warningMessage: string | undefined;
                
                if (now < bookingEnd) {
                    if (now <= bookingStart) {
                        warningMessage = 'Booking has not started or has not been active long enough and will be permanently deleted.';
                    } else {
                        const newEndTime = format(now, 'HH:mm');
                        warningMessage = `Booking is ending early and will be adjusted to ${startTime} - ${newEndTime}.`;
                    }
                }

                const confirmed = await confirm({
                    title: "End Booking",
                    description: `End booking ${startTime} - ${endTime} for ${roomName}?`,
                    warning: warningMessage,
                    confirmText: "End",
                    cancelText: "Cancel"
                });
                if (!confirmed) return;
            }

            let scope = 'single';
            if (booking.bulk_booking_id) {
                  // Bulk bookings require explicit scope selection.
                 const result = await confirm({
                     title: action === 'activate' ? "Activate Booking" : "End Booking",
                     description: `This booking is part of a bulk group.`,
                     cancelText: "Cancel",
                     actions: [
                         { label: `${action === 'activate' ? 'Activate' : 'End'} This Only`, value: 'single', variant: 'outlined' },
                         { label: `${action === 'activate' ? 'Activate' : 'End'} Entire Group`, value: 'group', variant: 'contained' }
                     ]
                 });
                 if (typeof result !== 'string') return;
                 scope = result;
            }

            const newState = action === 'activate' ? 'Active' : 'Ended';

            if (action === 'end') {
                
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

                    if (now < bookingEnd) {
                        // End-before-start deletes; mid-session end truncates end_time.
                        if (now <= bookingStart) {
                             await deleteBooking(bookingId)
                             removeBookings([bookingId])
                             showToast("Deleted", "Booking deleted (ended before start time)", "info");
                             return;
                        } else {
                            const newEndTime = format(now, "HH:mm:ss");
                            upsertBookings([await updateBooking(bookingId, { state: newState, end_time: newEndTime })])

                            await logEvent('state_change', {
                                type: logType,
                                state: 'active_to_ended',
                                time: isSameDay(exactNow, bookingEnd) ? differenceInMinutes(exactNow, bookingEnd) : 1000
                            });

                            showToast("Success", `Booking ended early at ${format(now, "HH:mm")}`, "success");
                            return;
                        }
                    } else {
                         upsertBookings([await updateBooking(bookingId, { state: newState })])
                         
                         await logEvent('state_change', {
                             type: logType,
                             state: 'active_to_ended',
                             time: isSameDay(exactNow, bookingEnd) ? differenceInMinutes(exactNow, bookingEnd) : 1000
                         });
                         
                         showToast("Success", "Booking ended", "success");
                         return;
                    }
                } else {
                    // Group end only updates state, not individual timings.
                    upsertBookings(await updateBookingGroup(booking.bulk_booking_id!, { state: newState }))
                    
                    await logEvent('state_change', {
                        type: logType,
                        state: 'active_to_ended',
                        time: isSameDay(exactNow, bookingEnd) ? differenceInMinutes(exactNow, bookingEnd) : 1000
                    });

                    showToast("Success", `Group ended`, "success");
                    return;
                }
            }

            if (scope === 'group') {
                upsertBookings(await updateBookingGroup(booking.bulk_booking_id!, { state: newState }))
                 
                 await logEvent('state_change', {
                    type: logType,
                    state: 'reserved_to_active', 
                    time: isSameDay(exactNow, bookingStart) ? differenceInMinutes(exactNow, bookingStart) : 1000
                 });

                 showToast("Success", `Group ${newState.toLowerCase()}`, "success");
            } else {
                upsertBookings([await updateBooking(bookingId, { state: newState })])

                 await logEvent('state_change', {
                    type: logType,
                    state: 'reserved_to_active',
                    time: isSameDay(exactNow, bookingStart) ? differenceInMinutes(exactNow, bookingStart) : 1000
                 });
                 showToast("Success", `Booking ${newState.toLowerCase()}`, "success");
            }
        } catch (err: unknown) {
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
                onSearchClick={() => {
                    setInitialSearchFilter(null);
                    setIsSearchOpen(prev => !prev);
                }}
                currentUser={currentUser}
                onUserChange={setCurrentUser}
                lateCount={statusCounts.late}
                overdueCount={statusCounts.overdue}
                onFilterClick={handleFilterClick}
                syncState={syncState}
                lastSyncedAt={lastSyncedAt}
                onRefresh={() => {
                    void refreshDate(selectedDateKey).catch(() => {
                        showToast('Refresh failed', 'Bookings could not be refreshed. Existing data is still shown.', 'error')
                    })
                }}
            />
        );
        return () => setHeaderContent(null);
    }, [
        selectedDate,
        selectedDateKey,
        currentUser,
        setHeaderContent,
        handleBookClick,
        statusCounts,
        handleFilterClick,
        syncState,
        lastSyncedAt,
        refreshDate,
        showToast,
    ]);

    return (
        <StyledPageContainer>
            <StyledContentContainer>
                <StyledGridContainer>
                    <BookingGrid
                        selectedDate={selectedDate}
                        rooms={rooms}
                        bookings={bookings}
                        openingHours={operationHours}
                        loading={referenceLoading || !dateReady || isDateLoading(selectedDateKey)}
                        refreshing={isDateRefreshing(selectedDateKey)}
                        onCellClick={handleCellClick}
                        onBookingClick={handleBookingClick}
                        onQuickAction={handleQuickAction}
                        onStatusCountsChange={handleStatusCountsChange}
                        highlightedBookingId={highlightedBookingId}
                    />
                </StyledGridContainer>
                <SearchPanel 
                    isOpen={isSearchOpen} 
                    onClose={() => {
                        setIsSearchOpen(false);
                        setInitialSearchFilter(null);
                    }} 
                    selectedDate={selectedDate}
                    bookings={bookings}
                    loading={isDateLoading(selectedDateKey)}
                    onBookingSelect={handleBookingSelect}
                    showToast={showToast}
                    initialFilter={initialSearchFilter}
                />
            </StyledContentContainer>

            <BookingPanel
                key={panelOpen ? (panelData?.booking?.id ? `edit-${panelData.booking.id}` : `new-${panelData?.roomId || ''}-${panelData?.timeSlot || ''}`) : 'closed'}
                open={panelOpen}
                onClose={() => { setPanelOpen(false); setPanelData(null); setCreationStartTime(null); }}
                prefill={panelData}
                defaultStaffName={currentUser}
                showToast={showToast}
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
            <BookingsDataProvider>
                <NowProvider>
                    <BookingsContent />
                </NowProvider>
            </BookingsDataProvider>
        </ConfirmDialogProvider>
    );
};

export default Bookings;
