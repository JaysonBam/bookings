/**
 * Purpose: Module logic for pages\bookings\components\BookingGrid.tsx.
 */
import React, { useMemo, useEffect, useState, useCallback } from "react";
import { format, addMinutes } from "date-fns";
import BookingCell from "./BookingCell";
import { getBookingSoftState } from "../utils/helpers";
import { useNow } from "../context/NowContext";
import { CircularProgress, Box, LinearProgress, Table, TableBody, TableRow, TableHead } from "@mui/material";
import { alpha, useTheme } from '@mui/material/styles';
import { StyledTableContainer, StyledHeaderCell, StyledCornerCell, StyledTimeCell } from "../styles";
import type { BookingRow, RoomRow } from '../../../api/supabase/types'

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
  course?: { id: number; name: string; color_hex?: string | null } | null;
  state?: 'Active' | 'Reserved' | 'Ended' | undefined;
  booking_day?: string;
  bulk_booking_id?: string | null;
  borrowed_items?: string[];
}

interface BookingGridProps {
  selectedDate: Date;
  rooms: RoomRow[];
  bookings: BookingRow[];
  openingHours: { start: string; end: string };
  loading?: boolean;
  refreshing?: boolean;
  onCellClick: (roomId: string, timeSlotIso: string) => void;
  onBookingClick: (bookingId: string) => void;
  onQuickAction?: (bookingId: string, action: 'activate' | 'end', source?: 'quick' | 'double_tap') => void;
  onStatusCountsChange?: (late: number, overdue: number) => void;
  highlightedBookingId?: string | null;
}

export const BookingGrid: React.FC<BookingGridProps> = ({
  selectedDate,
  rooms: roomRows,
  bookings: bookingRows,
  openingHours,
  loading = false,
  refreshing = false,
  onCellClick,
  onBookingClick,
  onQuickAction,
  onStatusCountsChange,
  highlightedBookingId,
}) => {
  const theme = useTheme();
  const [hoveredCell, setHoveredCell] = useState<{ roomId: string | null; timeSlotIso: string | null }>({ roomId: null, timeSlotIso: null });
  const { currentTime } = useNow();
  const handleCellHover = useCallback((roomId: string, timeSlotIso: string, isHovering: boolean) => {
    setHoveredCell(isHovering ? { roomId, timeSlotIso } : { roomId: null, timeSlotIso: null })
  }, [])

  const rooms = useMemo(() => {
    const roomRegex = /^Room\s*(\d+)$/i;
    const numericRooms = roomRows
      .map((room) => ({ room, match: room.name.match(roomRegex)?.[1] }))
      .filter((item) => item.match)
      .map((item) => ({ room: item.room, number: Number(item.match) }))
      .sort((a, b) => a.number - b.number)
      .map((item) => item.room)
    const otherRooms = roomRows
      .filter((room) => !roomRegex.test(room.name))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    return [...numericRooms, ...otherRooms]
  }, [roomRows])

  const bookings = useMemo<Booking[]>(() => bookingRows.map((booking) => ({
    id: String(booking.id),
    room_id: String(booking.room_id),
    start_time: `${booking.booking_day}T${booking.start_time.slice(0, 8)}`,
    end_time: `${booking.booking_day}T${booking.end_time.slice(0, 8)}`,
    booked_by: booking.booked_by,
    course_id: booking.course_id ?? null,
    course_name: booking.course_name ?? null,
    course: booking.courses ?? null,
    state: booking.state,
    booking_day: booking.booking_day,
    bulk_booking_id: booking.bulk_booking_id,
    borrowed_items: booking.borrowed_items ?? [],
  })), [bookingRows])

  useEffect(() => {
    if (!onStatusCountsChange) return;

    let l = 0;
    let o = 0;
    if (bookings && currentTime) {
        bookings.forEach(b => {
            const s = getBookingSoftState(b, currentTime);
            if (s === 'late') l++;
            if (s === 'overdue') o++;
        });
    }
    onStatusCountsChange(l, o);
  }, [bookings, currentTime, onStatusCountsChange]);

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

  const bookingByCell = useMemo(() => {
    const index = new Map<string, Booking>()
    bookings.forEach((booking) => {
      const end = new Date(booking.end_time)
      let slot = new Date(booking.start_time)
      while (slot < end) {
        index.set(`${booking.room_id}|${slot.toISOString()}`, booking)
        slot = addMinutes(slot, 30)
      }
    })
    return index
  }, [bookings])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <StyledTableContainer>
      {refreshing && <LinearProgress aria-label="Refreshing bookings" sx={{ position: 'sticky', top: 0, zIndex: 30 }} />}
      <Table stickyHeader padding="none" sx={{ minWidth: 'max-content' }}>
        <TableHead>
          <TableRow>
            <StyledCornerCell></StyledCornerCell>
            {rooms.map((r) => (
              <StyledHeaderCell 
                key={r.id} 
                sx={(theme) => ({ 
                    backgroundColor: theme.palette.background.paper,
                    color: hoveredCell.roomId === String(r.id) ? theme.palette.primary.main : 'inherit',
                    verticalAlign: 'bottom',
                    ...(hoveredCell.roomId === String(r.id) && {
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
                            background: theme.palette.action.disabled,
                            zIndex: 0,
                          }} />
                          <span style={{ position: 'relative', zIndex: 1, color: theme.palette.text.primary }}>{l.split(' ').pop()}</span>
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
                const roomId = String(room.id)
                const booking = bookingByCell.get(`${roomId}|${slot.toISOString()}`) ?? null;
                return (
                  <BookingCell
                    key={`${roomId}-${slot.toISOString()}`}
                    booking={booking}
                    roomId={roomId}
                    timeSlot={slot}
                    onCellClick={onCellClick}
                    onBookingClick={onBookingClick}
                    onQuickAction={onQuickAction}
                    onHover={handleCellHover}
                    currentTime={booking ? currentTime : undefined}
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
