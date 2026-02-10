import React, { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { format, addMinutes, differenceInMinutes, parseISO } from "date-fns";
import { supabase } from "../../../lib/supabaseClient";
import BookingCell from "./BookingCell";
import { useNow } from "../context/NowContext";
import { CircularProgress, Box, Table, TableBody, TableRow, TableHead } from "@mui/material";
import { alpha } from '@mui/material/styles';
import { StyledTableContainer, StyledHeaderCell, StyledCornerCell, StyledTimeCell } from "../styles";

interface Room {
  id: string;
  name: string;
  capacity?: number | null;
  is_available?: boolean | null;
  dynamic_labels?: string[] | null;
}

interface Booking {
  id: string;
  room_id: string;
  start_time: string; // ISO
  end_time: string;   // ISO
  title?: string;
  color?: string;
  booked_by?: string;
  course_id?: number | null;
  course_name?: string | null;
  course?: { id: number; name: string; color_hex?: string } | null;
  state?: 'Active' | 'Reserved' | 'Ended' | undefined;
  booking_day?: string;
  bulk_booking_id?: string | null;
}

interface BookingGridProps {
  selectedDate: Date;
  rooms?: Room[];
  bookings?: Booking[];
  openingHours?: { start: string; end: string };
  onCellClick: (roomId: string, timeSlotIso: string, duration?: number) => void;
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
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    type: 'CREATE' | 'MOVE' | 'EXTEND';
    startConfig: { roomId: string; timeSlot: Date } | null;
    currentConfig: { roomId: string; timeSlot: Date } | null;
    bookingId: string | null;
    originalDuration: number;
    isValid: boolean;
    hasMoved: boolean;
    originalColor?: string;
    dragOffsetInMinutes?: number;
  }>({
    isDragging: false,
    type: 'CREATE',
    startConfig: null,
    currentConfig: null,
    bookingId: null,
    originalDuration: 30,
    isValid: true,
    hasMoved: false
  });

  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);

  const checkOverlap = useCallback((roomId: string, start: Date, end: Date, excludeBookingId?: string | null) => {
    return bookingsRef.current.some(b => {
      if (excludeBookingId && b.id === excludeBookingId) return false;
      const bStart = parseISO(b.start_time);
      const bEnd = parseISO(b.end_time);
      // Overlap: StartA < EndB && EndA > StartB
      return b.room_id === roomId && (start < bEnd && end > bStart);
    });
  }, []);

  const handleMouseDownCell = (roomId: string, timeSlot: Date) => {
     // Check if we are clicking on an existing booking? No, BookingCell handles that by deciding what to render.
     // If we click an empty cell area, start CREATE.
     const start = timeSlot;
     const end = addMinutes(timeSlot, 30);
     setDragState({
       isDragging: true,
       type: 'CREATE',
       startConfig: { roomId, timeSlot },
       currentConfig: { roomId, timeSlot },
       bookingId: null,
       originalDuration: 30,
       isValid: !checkOverlap(roomId, start, end),
       hasMoved: false
     });
  };

  const handleMouseDownBooking = (bookingId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault(); // Prevent text selection etc
      const booking = bookingsRef.current.find(b => b.id === bookingId);
      if (!booking) return;

      const duration = differenceInMinutes(parseISO(booking.end_time), parseISO(booking.start_time));
      // Calculate offset based on click position relative to top of element
      // We can approximate by checking the current time slot (if we could get it)
      // Or by using rect height.
      // Easiest is to just assume snap-to-start unless we do advanced math.
      // But user wants "keep reference".
      // We can do this: 
      // 1. Get the bounding rect of the target element. 
      // 2. Calculate e.clientY - rect.top.
      // 3. Map (pixelOffset / pixelHeight) * durationMinutes -> offsetMinutes.
      const rect = e.currentTarget.getBoundingClientRect();
      const pixelOffset = e.clientY - rect.top;
      const pixelHeight = rect.height;
      const offsetRatio = pixelOffset / pixelHeight;
      const offsetMinutesRaw = offsetRatio * duration;
      // Round to nearest 30 mins to align with slots
      const offsetMinutes = Math.floor(offsetMinutesRaw / 30) * 30;

      setDragState({
          isDragging: true,
          type: 'MOVE',
          startConfig: { roomId: booking.room_id, timeSlot: parseISO(booking.start_time) },
          currentConfig: { roomId: booking.room_id, timeSlot: parseISO(booking.start_time) },
          bookingId: booking.id,
          originalDuration: duration,
          isValid: true,
          hasMoved: false,
          originalColor: booking.course?.color_hex ?? booking.color ?? "#64748b",
          dragOffsetInMinutes: offsetMinutes
      });
  };

  const handleExtendStart = (bookingId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const booking = bookingsRef.current.find(b => b.id === bookingId);
      if (!booking) return;

      const duration = differenceInMinutes(parseISO(booking.end_time), parseISO(booking.start_time));
      
      // Start the extension from the END of the current booking
      setDragState({
          isDragging: true,
          type: 'EXTEND',
          startConfig: { roomId: booking.room_id, timeSlot: parseISO(booking.end_time) },
          currentConfig: { roomId: booking.room_id, timeSlot: parseISO(booking.end_time) },
          bookingId: booking.id,
          originalDuration: duration,
          isValid: true,
          hasMoved: false,
          originalColor: booking.course?.color_hex ?? booking.color ?? "#64748b"
      });
  };

  const handleMouseEnterCell = (roomId: string, timeSlotIso: string) => {
      if (!dragState.isDragging) {
         setHoveredCell({ roomId, timeSlotIso });
         return;
      }
      
      const timeSlot = new Date(timeSlotIso);
      
      setDragState(prev => {
          if (!prev.startConfig) return prev;

          let isValid = true;
          let newCurrent = { roomId, timeSlot };

          if (prev.type === 'CREATE') {
              // Lock to start Room
              newCurrent.roomId = prev.startConfig.roomId;
              
              // Lock to start time at minimum (drag down only)
              if (timeSlot < prev.startConfig.timeSlot) {
                  newCurrent.timeSlot = prev.startConfig.timeSlot;
              }

              // Max duration 2 hours
              let duration = differenceInMinutes(addMinutes(newCurrent.timeSlot, 30), prev.startConfig.timeSlot);
              if (duration > 120) {
                  const maxSlots = 4; // 2 hours / 30 mins
                  newCurrent.timeSlot = addMinutes(prev.startConfig.timeSlot, (maxSlots - 1) * 30);
                  duration = 120;
              }
              
              const start = prev.startConfig.timeSlot;
              const end = addMinutes(prev.startConfig.timeSlot, duration);
              
              isValid = !checkOverlap(prev.startConfig.roomId, start, end);
          } 
          else if (prev.type === 'MOVE') {
              // Update room and time (unlocked)
              newCurrent.roomId = roomId;

              // Apply offset to ensure the ghost moves relative to the mouse
              // If we picked up at +60mins, and we are now at T, the new start time should be T - 60mins.
              const offset = prev.dragOffsetInMinutes || 0;
              newCurrent.timeSlot = addMinutes(timeSlot, -offset);

              const start = newCurrent.timeSlot;
              const end = addMinutes(start, prev.originalDuration);
              isValid = !checkOverlap(newCurrent.roomId, start, end, prev.bookingId);
          }
          else if (prev.type === 'EXTEND') {
              // Lock Room
              newCurrent.roomId = prev.startConfig.roomId;
              
              // Lock Start Time to start of EXTENSION (which is end of original booking)
              const start = prev.startConfig.timeSlot; 
              
              // Determine new end time based on mouse position
              let proposedEnd = addMinutes(timeSlot, 30);
              
              // Cap Extension at 2 hours (120 min)
              // If dragging > 120min, clamp end to start + 120.
              const duration = differenceInMinutes(proposedEnd, start);
              
              // We need to calculate what the "visual" end is first to check overlap properly.
              let targetEnd = proposedEnd;

              if (targetEnd <= start) {
                  targetEnd = start; // Retract to start (0 min)
              } else {
                  if (duration > 120) {
                      targetEnd = addMinutes(start, 120);
                  }
              }
              
              // Update isValid based on the capped range
              // Only check overlap if extension > 0
              if (differenceInMinutes(targetEnd, start) > 0) {
                  isValid = !checkOverlap(newCurrent.roomId, start, targetEnd, prev.bookingId);
              } else {
                  isValid = true; // 0 extension is valid (cancel)
              }
              
              // We want the visual ghost to stop growing at 2 hours, even if mouse goes further.
              // So we fake the Mouse Position stored in state if we exceed the cap.
              // But render loop calculates End from `currentConfig.timeSlot`.
              // `targetEnd` = `addMinutes(timeSlot, 30)` (approx).
              // So if we clamp `targetEnd`, we should back-calculate `timeSlot` or better yet change render logic to use calculated vals.
              // Easier: Just update `newCurrent.timeSlot` so it aligns with `targetEnd`.
              // targetEnd = newCurrent.timeSlot + 30.
              // => newCurrent.timeSlot = targetEnd - 30.
              
              if (targetEnd > start) {
                  newCurrent.timeSlot = addMinutes(targetEnd, -30);
              } else {
                  // If retracted to start (0 min), ensure mouseUp calculates proposedEnd <= start
                  // mouseUp logic: proposedEnd = currentConfig.timeSlot + 30
                  // So we set currentConfig.timeSlot = start - 30
                  newCurrent.timeSlot = addMinutes(start, -30); 
              }
          }

          return {
              ...prev,
              hasMoved: true,
              currentConfig: newCurrent,
              isValid
          };
      });
  };

  useEffect(() => {
      const handleMouseUp = () => {
          if (!dragState.isDragging) return;

          const { type, startConfig, currentConfig, isValid, bookingId, hasMoved } = dragState;

          if (isValid && startConfig && currentConfig) {
              if (type === 'CREATE') {
                   const duration = differenceInMinutes(addMinutes(currentConfig.timeSlot, 30), startConfig.timeSlot);
                   onCellClick(startConfig.roomId, startConfig.timeSlot.toISOString(), duration);
              } else if (type === 'MOVE' && bookingId) {
                   if (!hasMoved) {
                        onBookingClick(bookingId);
                   } else if ((currentConfig.roomId !== startConfig.roomId || currentConfig.timeSlot.getTime() !== startConfig.timeSlot.getTime()) && onMoveBooking) {
                       onMoveBooking(bookingId, currentConfig.roomId, currentConfig.timeSlot.toISOString());
                   }
              } else if (type === 'EXTEND' && bookingId && onExtendBooking) {
                   const start = startConfig.timeSlot;
                   let proposedEnd = addMinutes(currentConfig.timeSlot, 30);
                   
                   // If proposedEnd <= start, the user dragged back or up.
                   // The request: "if retract back to no extension... do not extend"
                   if (proposedEnd > start) {
                        const duration = differenceInMinutes(proposedEnd, start);
                        if (duration >= 30) {
                             onExtendBooking(bookingId, duration);
                        }
                   }
                   // Else: do nothing (cancel)
              }
          }

          setDragState(prev => ({ ...prev, isDragging: false, startConfig: null, currentConfig: null, bookingId: null, hasMoved: false }));
      };

      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [dragState, onCellClick, onMoveBooking, onExtendBooking]);

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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <div style={{ fontWeight: 'bold' }}>{r.name}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'normal', marginTop: '2px', minHeight: '1.2em', display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                    {r.dynamic_labels && r.dynamic_labels.length > 0 ? (
                      r.dynamic_labels.map((l, idx) => (
                        <span key={idx} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          marginRight: 2
                        }}>
                          <span style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: '#b0b3b8', // Neutral grey, visible on both themes
                            zIndex: 0,
                          }} />
                          <span style={{ position: 'relative', zIndex: 1, color: '#222' }}>{l.split(' ').pop()}</span>
                        </span>
                      ))
                    ) : (
                      '\u00A0'
                    )}
                  </div>
                </div>
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
