import React, { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { format, addMinutes, differenceInMinutes } from "date-fns";
import { supabase } from "../../../lib/supabaseClient";
import BookingCell from "./BookingCell";
import { useNow } from "../context/NowContext";
import { CircularProgress, Box, Table, TableBody, TableRow, TableHead } from "@mui/material";
import { alpha } from '@mui/material/styles';
import { StyledTableContainer, StyledHeaderCell, StyledCornerCell, StyledTimeCell, StyledHeaderContent, StyledHeaderName, StyledHeaderMeta, StyledDynamicLabel, StyledLabelBackground, StyledLabelText } from "../styles";
import { Booking, Room } from "../types";
import { useDragBooking } from "../hooks/useDragBooking";

interface BookingGridProps {
  selectedDate: Date;
  rooms?: Room[];
  bookings?: Booking[];
  openingHours?: { start: string; end: string };
  onCellClick: (roomId: string, timeSlotIso: string, duration?: number, isDrag?: boolean) => void;
  onBookingClick: (bookingId: string) => void;
  onQuickAction?: (bookingId: string, action: 'activate' | 'end') => void;
  onMoveBooking?: (bookingId: string, newRoomId: string, newStartTime: string) => void;
  onExtendBooking?: (originalBookingId: string, durationMinutes: number) => void;
  highlightedBookingId?: string | null;
  refreshTrigger?: number;
  showToast?: (title: string, description: string, severity?: "success" | "error" | "info") => void;
}

const defaultRooms: Room[] = [
  { id: "r1", name: "Room 1" },
  { id: "r2", name: "Room 2" },
  { id: "r3", name: "Room 3" },
];

export const BookingGrid: React.FC<BookingGridProps> = ({
  selectedDate,
  rooms: roomsProp,
  bookings: bookingsProp,
  openingHours: openingHoursProp,
  onCellClick,
  onBookingClick,
  onQuickAction,
  onMoveBooking,
  onExtendBooking,
  highlightedBookingId,
  refreshTrigger = 0,
  showToast = () => {},
}) => {
  const [rooms, setRooms] = useState<Room[]>(roomsProp ?? defaultRooms);
  const [openingHours, setOpeningHours] = useState<{ start: string; end: string }>(openingHoursProp ?? { start: "06:00", end: "21:00" });
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const bookingsRef = useRef<Booking[]>([]);
  const [hoveredCell, setHoveredCell] = useState<{ roomId: string | null; timeSlotIso: string | null }>({ roomId: null, timeSlotIso: null });
  const { currentTime } = useNow();

  // --- Drag & Drop State ---
  const { 
      dragState, 
      handleMouseDownCell, 
      handleMouseDownBooking, 
      handleExtendStart, 
      handleMouseEnterCell 
  } = useDragBooking({
      bookingsRef,
      onCellClick,
      onBookingClick,
      onMoveBooking,
      onExtendBooking
  });

  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);



  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: roomsData, error: roomsErr } = await supabase.from("rooms").select("*");
        if (roomsErr) {
          showToast("Error", "Failed to load rooms", "error");
        } else if (roomsData) {
          const fetched = (roomsData as any[])
            .filter((r) => r.is_available === false ? false : true)
            .map((r) => ({ id: String(r.id), name: r.name, capacity: r.capacity, is_available: r.is_available, dynamic_labels: r.dynamic_labels }));
          
          const roomRegex = /^Room\s*(\d+)$/i;
          const numericRooms = fetched
            .map((r) => ({ r, m: (r.name.match(roomRegex) || [])[1] }))
            .filter((x) => x.m)
            .map((x) => ({ room: x.r, num: parseInt(x.m, 10) }))
            .sort((a, b) => a.num - b.num)
            .map((x) => x.room);
          const otherRooms = fetched.filter((r) => !roomRegex.test(r.name)).slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
          setRooms([...numericRooms, ...otherRooms]);
        }

        const { data: hoursData } = await supabase.from("settings").select("value").eq("key", "operation_hours").maybeSingle();
        if (hoursData && hoursData.value) {
          const val = hoursData.value as any;
          const start = val.start ?? val.open ?? "06:00";
          const end = val.end ?? val.close ?? "21:00";
          setOpeningHours({ start, end });
        }
      } catch (err) {
        showToast("Error", "Failed to load grid configuration", "error");
      } finally {
        
      }
    };

    if (roomsProp && roomsProp.length > 0) setRooms(roomsProp as any);
    if (openingHoursProp) setOpeningHours(openingHoursProp);
    
    if ((!roomsProp || roomsProp.length === 0) || !openingHoursProp) {
        load();
    }
  }, [roomsProp, openingHoursProp]);

  const fetchBookings = useCallback(async (dateStr: string) => {
      try {
        const { data: bookingsData, error: bookingsErr } = await supabase
          .from("bookings")
          .select(`*, courses(id, name, color_hex)`)
          .eq("booking_day", dateStr);
        if (bookingsErr) { showToast("Error", "Failed to load bookings", "error"); setLoading(false); return; }
        if (bookingsData) {
          const mapped = (bookingsData as any[]).map((b) => {
            const startIso = `${b.booking_day}T${(b.start_time || "").slice(0,8)}`;
            const endIso = `${b.booking_day}T${(b.end_time || "").slice(0,8)}`;
            return {
              id: String(b.id),
              room_id: String(b.room_id),
              start_time: startIso,
              end_time: endIso,
              booked_by: b.booked_by,
              course_id: b.course_id ?? null,
              course_name: b.course_name ?? null,
              course: b.courses ?? null,
              state: b.state,
              booking_day: b.booking_day,
              bulk_booking_id: b.bulk_booking_id,
            } as Booking;
          });
          setBookings(mapped);
        }
        setLoading(false);
      } catch (e) {
          showToast("Error", "Failed to refresh bookings", "error");
          setLoading(false);
      }
  }, [showToast]);

  useEffect(() => {
    if (bookingsProp && bookingsProp.length > 0) {
      setBookings(bookingsProp as any);
      setLoading(false);
    } else {
      fetchBookings(format(selectedDate, "yyyy-MM-dd"));
    }
  }, [selectedDate, bookingsProp, refreshTrigger, fetchBookings]); 

  useEffect(() => {
    if (bookingsProp && bookingsProp.length > 0) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
    const channel = supabase.channel(`bookings_realtime_${dateStr}_${Date.now()}`);
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload: any) => {
          if (payload.new && payload.new.booking_day === dateStr) {
               fetchBookings(dateStr);
          } else if (payload.old) {
               fetchBookings(dateStr);
          }
        }
      )
      .subscribe(() => {
        // status subscription logic
      });

    return () => {
        channel.unsubscribe();
    };
  }, [selectedDate, bookingsProp, fetchBookings]);

  const timeSlots = useMemo(() => {
    const [sh, sm] = openingHours.start.split(":").map(Number);
    const [eh, em] = openingHours.end.split(":").map(Number);
    const start = new Date(selectedDate);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(eh, em, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);

    const slots: Date[] = [];
    let cur = new Date(start);
    while (cur < end) {
      slots.push(new Date(cur));
      cur = addMinutes(cur, 30);
    }
    return slots;
  }, [selectedDate, openingHours]);

  const getBookingForCell = React.useCallback((roomId: string, slot: Date) => {
    return bookings.find((b) => {
      const s = new Date(b.start_time);
      const e = new Date(b.end_time);
      return b.room_id === roomId && slot >= s && slot < e;
    }) || null;
  }, [bookings]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <StyledTableContainer sx={{ userSelect: dragState.isDragging ? 'none' : 'auto' }}>
      <Table stickyHeader padding="none" sx={{ minWidth: 'max-content' }}>
        <TableHead>
          <TableRow>
            <StyledCornerCell></StyledCornerCell>
            {rooms.map((r) => (
              <StyledHeaderCell 
                key={r.id} 
                sx={(theme) => ({ 
                    backgroundColor: theme.palette.background.paper,
                    color: hoveredCell.roomId === r.id ? theme.palette.primary.main : 'inherit',
                    verticalAlign: 'bottom',
                    ...(hoveredCell.roomId === r.id && {
                      boxShadow: `0 4px 8px ${alpha(theme.palette.primary.main, 0.12)}`,
                      zIndex: 20,
                    })
                })}
              >
                <StyledHeaderContent>
                  <StyledHeaderName>{r.name}</StyledHeaderName>
                  <StyledHeaderMeta>
                    {r.dynamic_labels && r.dynamic_labels.length > 0 ? (
                      r.dynamic_labels.map((l, idx) => (
                        <StyledDynamicLabel key={idx}>
                          <StyledLabelBackground />
                          <StyledLabelText>{l.split(' ').pop()}</StyledLabelText>
                        </StyledDynamicLabel>
                      ))
                    ) : (
                      '\u00A0'
                    )}
                  </StyledHeaderMeta>
                </StyledHeaderContent>
              </StyledHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {timeSlots.map((slot) => {
            const isCurrentRow = currentTime ? slot <= currentTime && currentTime < addMinutes(slot, 30) : false;
            return (
            <TableRow key={slot.toISOString()}>
              <StyledTimeCell 
                sx={(theme) => ({ 
                    backgroundColor: theme.palette.background.paper,
                    color: hoveredCell.timeSlotIso === slot.toISOString() ? theme.palette.primary.main : isCurrentRow ? theme.palette.secondary.main : 'inherit',
                    fontWeight: isCurrentRow ? 'bold' : 'normal',
                    ...(hoveredCell.timeSlotIso === slot.toISOString() && {
                      boxShadow: `0 4px 8px ${alpha(theme.palette.primary.main, 0.12)}`,
                      zIndex: 21,
                    })
                })}
              >
                {format(slot, "HH:mm")}
              </StyledTimeCell>
              {rooms.map((room) => {
                const booking = getBookingForCell(room.id, slot);
                
                let previewProps: { 
                    type?: 'CREATE' | 'MOVE'; 
                    isValid?: boolean; 
                    isStart?: boolean; 
                    isEnd?: boolean; 
                    isPartOfDrag?: boolean;
                    color?: string;
                    label?: string;
                } | undefined = undefined;

                // Prepare Global Drag info to pass to occupied cells
                let dragGlobalProps: {
                    start: Date;
                    end: Date;
                    type: 'CREATE' | 'MOVE';
                    isValid: boolean;
                    color?: string;
                    label?: string;
                } | null = null;

                if (dragState.isDragging && dragState.startConfig && dragState.currentConfig) {
                    const { type, startConfig, currentConfig, isValid, originalDuration } = dragState;
                    
                    let dragStart: Date;
                    let dragEnd: Date;
                    let color = dragState.originalColor;

                    if (type === 'CREATE') {
                         if (room.id === startConfig.roomId) {
                             // Re-evaluate limits same as in mouseDown/enter for consistent range
                             let dStart = startConfig.timeSlot;
                             let dEnd = addMinutes(currentConfig.timeSlot, 30);
                             // Enforce drag down only and max duration
                             if (currentConfig.timeSlot < startConfig.timeSlot) dEnd = addMinutes(startConfig.timeSlot, 30);
                             let dur = differenceInMinutes(dEnd, dStart);
                             if (dur > 120) { dur = 120; dEnd = addMinutes(dStart, 120); }

                             if (slot >= dStart && slot < dEnd) {
                                 previewProps = {
                                     type: 'CREATE',
                                     isValid,
                                     isPartOfDrag: true,
                                     isStart: slot.getTime() === dStart.getTime(),
                                     isEnd: slot.getTime() === addMinutes(dEnd, -30).getTime()
                                 };
                             }
                        }
                    } else if (type === 'MOVE') {
                         if (room.id === currentConfig.roomId) {
                             // Note: currentConfig in state already accounts for offset in handleMouseEnterCell?
                             // Let's verify: newCurrent.timeSlot = addMinutes(timeSlot, -offset);
                             // YES. So currentConfig.timeSlot is the TRUE start time of the ghost.
                             dragStart = currentConfig.timeSlot;
                             dragEnd = addMinutes(dragStart, originalDuration);
                             
                             dragGlobalProps = {
                                 start: dragStart,
                                 end: dragEnd,
                                 type: 'MOVE',
                                 isValid,
                                 color
                             };

                             if (slot >= dragStart && slot < dragEnd) {
                                  previewProps = {
                                     type: 'MOVE',
                                     isValid,
                                     isPartOfDrag: true,
                                     isStart: slot.getTime() === dragStart.getTime(),
                                     isEnd: slot.getTime() === addMinutes(dragEnd, -30).getTime(),
                                     color: dragState.originalColor
                                 };
                             }
                         }
                    } else if (type === 'EXTEND') {
                        if (room.id === startConfig.roomId) {
                             const dragStart = startConfig.timeSlot;
                             // We trust currentConfig.timeSlot has been capped in handleMouseEnterCell
                             let dragEnd = addMinutes(currentConfig.timeSlot, 30);
                             let dur = differenceInMinutes(dragEnd, dragStart);
                             
                             // Safety cap just in case mouse didn't move recently but render happened
                             if (dur > 120) {
                                 dur = 120;
                                 dragEnd = addMinutes(dragStart, 120);
                             }

                             let label = "";
                             if (dur > 0) {
                                  label = `+${dur} min`;
                             } else {
                                  label = "+0 min";
                                  dur = 0;
                             }
                             
                             if (dur > 0) {
                                 // ALWAYS send global props even if invalid, so overlap shows RED
                                 dragGlobalProps = {
                                     start: dragStart,
                                     end: dragEnd,
                                     type: 'MOVE',
                                     isValid, // This comes from state (checkOverlap result)
                                     color: dragState.originalColor,
                                     label: isValid ? label : "Conflict"
                                 };

                                 // Render the ghost cells
                                 // If invalid, we still render ghost but red?
                                 // User said "proper overlapping ui logic".
                                 // Usually ghost cells turn red if !isValid.
                                 // `previewProps` handles validity inside `BookingCell`.
                                 
                                 if (slot >= dragStart && slot < dragEnd) {
                                      previewProps = {
                                         type: 'MOVE',
                                         isValid,
                                         isPartOfDrag: true,
                                         isStart: slot.getTime() === dragStart.getTime(),
                                         isEnd: slot.getTime() === addMinutes(dragEnd, -30).getTime(),
                                         color: dragState.originalColor,
                                         label: isValid ? label : "Conflict"
                                     };
                                 }
                             }
                        }
                    }
                }

                return (
                  <BookingCell
                    key={`${room.id}-${slot.toISOString()}`}
                    booking={booking}
                    roomId={room.id}
                    timeSlot={slot}
                    onCellClick={(rid, t) => handleMouseDownCell(rid, new Date(t))}
                    onBookingMouseDown={handleMouseDownBooking}
                    onResizeStart={handleExtendStart}
                    onQuickAction={onQuickAction}
                    onHover={(hovering, overrideTimeIso) => {
                        if (hovering) {
                            handleMouseEnterCell(room.id, overrideTimeIso || slot.toISOString());
                        } else if (!dragState.isDragging) {
                            setHoveredCell({ roomId: null, timeSlotIso: null });
                        }
                    }}
                    isCurrentRow={isCurrentRow}
                    isHighlighted={booking?.id === highlightedBookingId}
                    preview={previewProps}
                    dragGlobal={dragGlobalProps}
                    isDragSource={dragState.isDragging && dragState.type !== 'EXTEND' && dragState.bookingId === booking?.id}
                  />
                );
              })}
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </StyledTableContainer>
  );
};

export default BookingGrid;
