import React, { useMemo, useState, useCallback } from "react";
import { format, addMinutes, parseISO } from "date-fns";
import BookingCell from "./BookingCell";
import { useNow } from "../context/NowContext";
import { CircularProgress, Box, Table, TableBody, TableRow, TableHead } from "@mui/material";
import { StyledTableContainer, StyledHeaderCell, StyledCornerCell, StyledTimeCell } from "../styles";
import { Booking } from "../hooks/useBookings";
import { Room } from "../hooks/useRooms";
import { generateTimeSlots } from "../utils/bookingLogic";

interface BookingGridProps {
  selectedDate: Date;
  rooms: Room[];
  bookings: Booking[];
  loading?: boolean;
  openingHours?: { start: string; end: string };
  onCellClick: (roomId: string, timeSlotIso: string) => void;
  onBookingClick: (bookingId: string) => void;
  onQuickAction?: (bookingId: string, action: 'activate' | 'end') => void;
  highlightedBookingId?: string | null;
}

export const BookingGrid: React.FC<BookingGridProps> = ({
  selectedDate,
  rooms,
  bookings,
  loading = false,
  openingHours = { start: "06:00", end: "21:00" },
  onCellClick,
  onBookingClick,
  onQuickAction,
  highlightedBookingId,
}) => {
  const [hoveredCell, setHoveredCell] = useState<{ roomId: string | null; timeSlotIso: string | null }>({ roomId: null, timeSlotIso: null });
  const { currentTime } = useNow();

  const handleCellHover = useCallback((roomId: string | null, timeSlotIso: string | null) => {
    setHoveredCell({ roomId, timeSlotIso });
  }, []);

  // Optimized Lookup Map: O(1) access
  const bookingMap = useMemo(() => {
    const map = new Map<string, Booking>();
    if (!bookings) return map;

    bookings.forEach((b) => {
      const start = parseISO(b.start_time);
      const end = parseISO(b.end_time);
      const roomId = String(b.room_id);
      
      let cur = new Date(start);
      cur.setMinutes(Math.round(cur.getMinutes() / 30) * 30);
      cur.setSeconds(0,0);

      while (cur < end) {
        const key = `${roomId}-${cur.toISOString()}`;
        map.set(key, b);
        cur = addMinutes(cur, 30);
      }
    });

    return map;
  }, [bookings]);

  const timeSlots = useMemo(() => {
    return generateTimeSlots(openingHours.start, openingHours.end, selectedDate);
  }, [selectedDate, openingHours]);

  if (loading && rooms.length === 0) {
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
                isHighlighted={hoveredCell.roomId === r.id}
                sx={{ 
                    color: hoveredCell.roomId === r.id ? 'primary.main' : 'inherit'
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{r.name}</div>
                {r.dynamic_labels && r.dynamic_labels.length > 0 && (
                  <div style={{ fontSize: '0.75rem', fontWeight: 'normal', marginTop: '2px' }}>
                    {r.dynamic_labels.map(l => l.split(' ').pop()).join(' ')}
                  </div>
                )}
              </StyledHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {timeSlots.map((slot) => {
            const slotIso = slot.toISOString();
            const isCurrentRow = currentTime ? slot <= currentTime && currentTime < addMinutes(slot, 30) : false;
            
            return (
              <TableRow key={slotIso}>
                <StyledTimeCell 
                  isHighlighted={hoveredCell.timeSlotIso === slotIso}
                  isCurrent={isCurrentRow}
                  sx={{ 
                      color: hoveredCell.timeSlotIso === slotIso ? 'primary.main' : isCurrentRow ? 'secondary.main' : 'inherit',
                  }}
                >
                  {format(slot, "HH:mm")}
                </StyledTimeCell>
                
                {rooms.map((room) => {
                  const booking = bookingMap.get(`${room.id}-${slotIso}`) || null;
                  
                  return (
                    <BookingCell
                      key={`${room.id}-${slotIso}`}
                      booking={booking}
                      roomId={room.id}
                      timeSlot={slot}
                      onCellClick={onCellClick}
                      onBookingClick={onBookingClick}
                      onQuickAction={onQuickAction}
                      onHover={handleCellHover}
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
