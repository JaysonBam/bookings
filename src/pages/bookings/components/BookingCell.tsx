import React, { useState, useRef, useEffect } from "react";
import { parseISO } from "date-fns";
import { Button, Box, Typography } from "@mui/material";
import { useNow } from "../context/NowContext";
import { getBookingSoftState } from "../utils/bookingLogic";
import { getTextColorForBackground } from "../utils/styleUtils";
import { StyledBookingCell } from "../styles";

interface BookingCellProps {
  booking?: {
    id: string;
    room_id: string;
    start_time: string;
    end_time: string;
    title?: string;
    color?: string;
    state?: 'Active' | 'Reserved' | 'Ended';
    booked_by?: string;
    course_id?: number | null;
    course_name?: string | null;
    course?: {
      id: number;
      name: string;
      color_hex?: string | null;
    } | null;
    borrowed_items?: string[];
    booking_day?: string; 
  } | null;
  roomId: string;
  timeSlot: Date;
  onCellClick: (roomId: string, timeSlotIso: string) => void;
  onBookingClick: (bookingId: string) => void;
  onQuickAction?: (bookingId: string, action: 'activate' | 'end') => void;
  onHover?: (roomId: string | null, timeSlotIso: string | null) => void;
  isCurrentRow?: boolean;
  isHighlighted?: boolean;
}

const BookingCell = React.memo(({ booking, roomId, timeSlot, onCellClick, onBookingClick, onQuickAction, onHover, isCurrentRow, isHighlighted }: BookingCellProps) => {
  const { currentTime } = useNow();
  const [showQuickAction, setShowQuickAction] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cellRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (isHighlighted && cellRef.current) {
      cellRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [isHighlighted]);

  const handleMouseEnter = () => {
    onHover?.(roomId, timeSlot.toISOString());
    if (!booking || booking.state === 'Ended') return;
    hoverTimeoutRef.current = setTimeout(() => {
      setShowQuickAction(true);
    }, 1000);
  };

  const handleMouseLeave = () => {
    onHover?.(null, null);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowQuickAction(false);
  };

  const handleQuickActionClick = (e: React.MouseEvent, action: 'activate' | 'end') => {
    e.stopPropagation();
    if (!booking || !onQuickAction) return;
    onQuickAction(booking.id, action);
    setShowQuickAction(false);
  };

  if (!booking) {
    return (
      <StyledBookingCell
        onClick={() => onCellClick(roomId, timeSlot.toISOString())}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="button"
        tabIndex={0}
        sx={{
            cursor: 'pointer',
            backgroundColor: isCurrentRow ? 'action.selected' : 'inherit',
            '&:hover': { backgroundColor: 'action.hover' }
        }}
      />
    );
  }

  // Determine if this timeSlot is the start of the booking
  const start = parseISO(booking.start_time);
  const isStart = start.getHours() === timeSlot.getHours() && start.getMinutes() === timeSlot.getMinutes();
  if (!isStart) return null;

  const end = parseISO(booking.end_time);
  const durationMinutes = Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000));
  const rowSpan = Math.max(1, Math.floor(durationMinutes / 30));

  // Determine background color from course color, or fallback to blue-gray
  const bgColor = booking.course?.color_hex ?? booking.color ?? "#64748b"; // slate-500 fallback

  const textColor = getTextColorForBackground(bgColor);

  const softState = getBookingSoftState(booking, currentTime);

  const getStatusDotColor = (state?: string) => {
    if (softState === 'late') return 'orange';
    if (softState === 'overdue') return 'red';

    switch (state) {
      case 'Active': return 'green';
      case 'Reserved': return 'yellow';
      case 'Ended': return 'gray';
      default: return 'gray';
    }
  };

  return (
    <StyledBookingCell
      ref={cellRef}
      rowSpan={rowSpan}
      bgColor={bgColor}
      textColor={textColor}
      isHighlighted={isHighlighted}
      state={booking.state}
      onClick={() => onBookingClick(booking.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
        <Box sx={{ position: 'relative', width: '100%', height: '100%', p: 1 }}>
            <Box sx={{ 
                position: 'absolute', top: 4, right: 4, width: 8, height: 8, 
                borderRadius: '50%', backgroundColor: getStatusDotColor(booking.state),
                boxShadow: 1
            }} />
            <Typography variant="caption" fontWeight="bold" display="block" noWrap>
                {booking.course?.name ?? booking.course_name ?? 'Course'}
            </Typography>
            <Typography variant="caption" display="block" sx={{ opacity: 0.9 }}>
                {booking.booked_by}
            </Typography>

            {showQuickAction && onQuickAction && booking.state !== 'Ended' && (
                <Box sx={{ 
                    position: 'absolute', inset: 0, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(2px)',
                    zIndex: 2, borderRadius: 1
                }}>
                    <Button 
                        size="small" 
                        variant="contained" 
                        color={booking.state === 'Reserved' ? 'primary' : 'error'}
                        onClick={(e) => handleQuickActionClick(e, booking.state === 'Reserved' ? 'activate' : 'end')}
                        sx={{ fontSize: '0.7rem', minWidth: '50px', p: '2px 8px' }}
                    >
                        {booking.state === 'Reserved' ? 'Activate' : 'End'}
                    </Button>
                </Box>
            )}
        </Box>
    </StyledBookingCell>
  );
});

export default BookingCell;
 