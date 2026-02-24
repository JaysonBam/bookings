import React, { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { format, addMinutes } from "date-fns";
import { supabase } from "../../../lib/supabaseClient";
import BookingCell from "./BookingCell";
import { getBookingSoftState } from "../utils/helpers";
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
  onCellClick: (roomId: string, timeSlotIso: string) => void;
  onBookingClick: (bookingId: string) => void;
  onQuickAction?: (bookingId: string, action: 'activate' | 'end') => void;
  onStatusCountsChange?: (late: number, overdue: number) => void;
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
  onStatusCountsChange,
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
    if (!onStatusCountsChange) return;

    let l = 0;
    let o = 0;
    if (bookings && currentTime) {
        bookings.forEach(b => {
            const s = getBookingSoftState(b as any, currentTime);
            if (s === 'late') l++;
            if (s === 'overdue') o++;
        });
    }
    onStatusCountsChange(l, o);
  }, [bookings, currentTime, onStatusCountsChange]);

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
    <StyledTableContainer>
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
                return (
                  <BookingCell
                    key={`${room.id}-${slot.toISOString()}`}
                    booking={booking}
                    roomId={room.id}
                    timeSlot={slot}
                    onCellClick={onCellClick}
                    onBookingClick={onBookingClick}
                    onQuickAction={onQuickAction}
                    onHover={(isHovering) => setHoveredCell(isHovering ? { roomId: room.id, timeSlotIso: slot.toISOString() } : { roomId: null, timeSlotIso: null })}
                    isCurrentRow={isCurrentRow}
                    isHighlighted={booking?.id === highlightedBookingId}
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
