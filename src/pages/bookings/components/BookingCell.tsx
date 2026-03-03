import React, { useState, useRef, useEffect } from "react";
import { parseISO } from "date-fns";
import { Button, Box, Typography } from "@mui/material";
import BuildIcon from '@mui/icons-material/Build';
import { useNow } from "../context/NowContext";
import { getBookingSoftState } from "../utils/helpers";
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
  onQuickAction?: (bookingId: string, action: 'activate' | 'end', source?: 'quick' | 'double_tap') => void;
  onHover?: (isHovering: boolean) => void;
  isCurrentRow?: boolean;
  isHighlighted?: boolean;
}

export const BookingCell: React.FC<BookingCellProps> = ({ booking, roomId, timeSlot, onCellClick, onBookingClick, onQuickAction, onHover, isCurrentRow, isHighlighted }) => {
  const { currentTime } = useNow();
  const [showQuickAction, setShowQuickAction] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cellRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (isHighlighted && cellRef.current) {
      cellRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [isHighlighted]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    onHover?.(true);
    if (!booking || booking.state === 'Ended') return;
    hoverTimeoutRef.current = setTimeout(() => {
      setShowQuickAction(true);
    }, 1000);
  };

  const handleMouseLeave = () => {
    onHover?.(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowQuickAction(false);
  };

  const handleQuickActionClick = (e: React.MouseEvent, action: 'activate' | 'end') => {
    e.stopPropagation();
    if (!booking || !onQuickAction) return;
    onQuickAction(booking.id, action, 'quick');
    setShowQuickAction(false);
  };

  const handleCellTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!booking) return;

    if (clickTimeoutRef.current) {
        // Double Tap
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
        
        if (booking.state === 'Reserved') {
            onQuickAction?.(booking.id, 'activate', 'double_tap');
        } else if (booking.state === 'Active') {
            onQuickAction?.(booking.id, 'end', 'double_tap');
        }
    } else {
        // Single Tap
        clickTimeoutRef.current = setTimeout(() => {
            clickTimeoutRef.current = null;
            onBookingClick(booking.id);
        }, 250);
    }
  };

  if (!booking) {
    return (
      <StyledBookingCell
        onClick={() => onCellClick(roomId, timeSlot.toISOString())}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
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

  // Decide text color based on background luminance for readability
  const getTextColor = (hex: string) => {
    try {
      const h = hex.replace('#','');
      const r = parseInt(h.substring(0,2),16)/255;
      const g = parseInt(h.substring(2,4),16)/255;
      const b = parseInt(h.substring(4,6),16)/255;
      const lum = 0.2126*r + 0.7152*g + 0.0722*b;
      return lum > 0.6 ? 'black' : 'white';
    } catch (e) {
      return 'white';
    }
  };

  const textColor = getTextColor(bgColor);

  const softState = getBookingSoftState(booking, currentTime); // Now using the stub helper

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
      onClick={handleCellTap}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Box sx={{ position: 'relative', width: '100%', height: '100%', p: 1 }}>
        <Box sx={{ 
          position: 'absolute', top: 4, right: 4, width: 8, height: 8, 
          borderRadius: '50%', backgroundColor: getStatusDotColor(booking.state),
          boxShadow: 1
        }} />
        {/* Tools icon if borrowed items exist */}
        {booking.borrowed_items && booking.borrowed_items.length > 0 && (
          <Box sx={{ position: 'absolute', bottom: 4, right: 4, zIndex: 3, color: textColor }}>
            <BuildIcon fontSize="medium" sx={{ fontSize: 22 }} titleAccess="Items borrowed" />
          </Box>
        )}
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
            bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(1px)',
            zIndex: 2, borderRadius: 1
          }}>
            <Button 
              size="small" 
              variant="contained" 
              color={booking.state === 'Reserved' ? 'success' : 'error'}
              onClick={(e) => handleQuickActionClick(e, booking.state === 'Reserved' ? 'activate' : 'end')}
              sx={{ 
                fontSize: '0.8rem', 
                minWidth: '70px', 
                p: '4px 12px', 
                fontWeight: 'bold', 
                boxShadow: 3 
              }}
            >
              {booking.state === 'Reserved' ? 'Start' : 'End'}
            </Button>
          </Box>
        )}
      </Box>
    </StyledBookingCell>
  );
};

export default BookingCell;
