import React, { useState, useRef, useEffect } from "react";
import { parseISO } from "date-fns";
import { Button, Box, Typography } from "@mui/material";
import { useNow } from "../context/NowContext";
import { getBookingSoftState } from "../utils/helpers";
import { 
    StyledBookingCell, 
    StyledStatusDot, 
    StyledQuickActionOverlay, 
    StyledResizeHandle, 
    StyledPreviewBox, 
    StyledIntersectionPreview 
} from "../styles";

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
  onBookingMouseDown?: (bookingId: string, e: React.MouseEvent) => void;
  onResizeStart?: (bookingId: string, e: React.MouseEvent) => void;
  onQuickAction?: (bookingId: string, action: 'activate' | 'end') => void;
  onHover?: (isHovering: boolean, timeOverrideIso?: string) => void;
  isCurrentRow?: boolean;
  isHighlighted?: boolean;
  isDragSource?: boolean;
  preview?: {
      type?: 'CREATE' | 'MOVE';
      isValid?: boolean;
      isPartOfDrag?: boolean;
      isStart?: boolean;
      isEnd?: boolean;
      color?: string;
      label?: string;
  } | undefined;
  // Global drag state to calculate full overlap on mult-row cells
  dragGlobal?: {
      start: Date;
      end: Date;
      type: 'CREATE' | 'MOVE';
      isValid: boolean;
      color?: string;
      label?: string;
  } | null;
}

export const BookingCell: React.FC<BookingCellProps> = ({ 
    booking, roomId, timeSlot, 
    onCellClick, onQuickAction, onHover, onBookingMouseDown, onResizeStart,
    isCurrentRow, isHighlighted, isDragSource, preview, dragGlobal
}) => {
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
    onQuickAction(booking.id, action);
    setShowQuickAction(false);
  };

  // Helper to render the drag preview overlay
  const renderPreview = (p: NonNullable<BookingCellProps['preview']>) => {
      const isValid = p.isValid !== false;
      return (
           <StyledPreviewBox
               isValid={isValid}
               isStart={p.isStart}
               isEnd={p.isEnd}
               color={p.color}
               type={p.type}
           >
             {p.isStart && (
                 <Typography variant="caption" fontWeight="bold" sx={{ 
                     color: '#fff', 
                     textShadow: '0px 1px 2px rgba(0,0,0,0.6)', 
                 }}>
                     {p.label || (isValid ? (p.type === 'CREATE' ? '+ New' : 'Move') : 'Conflict')}
                 </Typography>
             )}
           </StyledPreviewBox>
      );
  };
  
  const renderIntersectionPreview = () => {
      if (!dragGlobal || !booking) return null;
      const bStart = parseISO(booking.start_time);
      const bEnd = parseISO(booking.end_time);
      const dStart = dragGlobal.start;
      const dEnd = dragGlobal.end;
      
      if (dEnd <= bStart || dStart >= bEnd) return null;
      
      const overlapStart = new Date(Math.max(bStart.getTime(), dStart.getTime()));
      const overlapEnd = new Date(Math.min(bEnd.getTime(), dEnd.getTime()));
      
      const sessionDuration = bEnd.getTime() - bStart.getTime();
      const overlapDuration = overlapEnd.getTime() - overlapStart.getTime();
      const startOffset = overlapStart.getTime() - bStart.getTime();
      
      if (overlapDuration <= 0) return null;
      
      const topPct = (startOffset / sessionDuration) * 100;
      const heightPct = (overlapDuration / sessionDuration) * 100;
      const isValid = dragGlobal.isValid;

      return (
         <StyledIntersectionPreview
            isValid={isValid}
            color={dragGlobal.color}
            type={dragGlobal.type}
            topPct={topPct}
            heightPct={heightPct}
         >
             {heightPct > 15 && (
                <Typography 
                    variant="caption" 
                    sx={{ 
                        color: 'inherit', 
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        textShadow: 'none', // Removed shadow as contrast is now handled by color
                        fontSize: '0.75rem',
                        userSelect: 'none'
                    }}
                >
                     {dragGlobal.label || (isValid ? (dragGlobal.type === 'CREATE' ? '+ NEW' : 'MOVE') : 'CONFLICT')}
                 </Typography>
             )}
         </StyledIntersectionPreview>
      );
  }

  // 1. If NO Booking: Handle Empty Cell or Ghost-Only
  if (!booking) {
    if (preview?.isPartOfDrag) {
       return (
        <StyledBookingCell 
            sx={{ p: 0, border: 'none', position: 'relative' }}
            onMouseEnter={() => onHover?.(true)} 
            onMouseLeave={() => onHover?.(false)}
        >
           {renderPreview(preview)}
        </StyledBookingCell>
       );
    }

    return (
      <StyledBookingCell
        onMouseDown={(e) => {
            if (e.button === 0) onCellClick(roomId, timeSlot.toISOString());
        }}
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

  // 2. If Booking Exists: Handle RowSpan and Potential Conflict Overlay
  const start = parseISO(booking.start_time);
  const isStart = start.getHours() === timeSlot.getHours() && start.getMinutes() === timeSlot.getMinutes();
  
  // CRITICAL: If this slot is part of a booking but NOT the start, we MUST return null 
  // to respect the rowSpan of the start cell. 
  // This means any Drag Preview for these "middle" slots will be invisible (swallowed).
  if (!isStart) return null;

  const end = parseISO(booking.end_time);
  const durationMinutes = Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000));
  const rowSpan = Math.max(1, Math.floor(durationMinutes / 30));
  const bgColor = booking.course?.color_hex ?? booking.color ?? "#64748b";

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
      onMouseDown={(e) => {
           if (e.button === 0 && onBookingMouseDown) onBookingMouseDown(booking.id, e);
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={(e) => {
        // Calculate relative slot index for large cells
        if (rowSpan > 1 && onHover) {
            const rect = e.currentTarget.getBoundingClientRect();
            const offsetY = e.clientY - rect.top;
            const fraction = offsetY / rect.height;
            // Map fraction to minutes
            const totalMinutes = durationMinutes;
            const minutesOffset = Math.floor((fraction * totalMinutes) / 30) * 30;
            const preciseDate = new Date(start.getTime() + minutesOffset * 60000);
            
            onHover(true, preciseDate.toISOString());
        }
      }}
      onMouseLeave={handleMouseLeave}
      sx={{
          opacity: isDragSource ? 0.3 : 1,
          transition: 'opacity 0.2s',
          ...(isDragSource && { filter: 'grayscale(100%)' })
      }}
    >
        <Box sx={{ position: 'relative', width: '100%', height: '100%', p: 1 }}>
            <StyledStatusDot color={getStatusDotColor(booking.state)} />
            <Typography variant="caption" fontWeight="bold" display="block" noWrap>
                {booking.course?.name ?? booking.course_name ?? 'Course'}
            </Typography>
            <Typography variant="caption" display="block" sx={{ opacity: 0.9 }}>
                {booking.booked_by}
            </Typography>

            {showQuickAction && onQuickAction && booking.state !== 'Ended' && (
                <StyledQuickActionOverlay onMouseDown={(e) => e.stopPropagation()}>
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
                </StyledQuickActionOverlay>
            )}

            {onResizeStart && booking.state !== 'Ended' && (
                <StyledResizeHandle
                    className="resize-handle"
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onResizeStart(booking.id, e);
                    }} 
                />
            )}

            {dragGlobal ? renderIntersectionPreview() : (preview?.isPartOfDrag && renderPreview(preview))}
        </Box>
        <style>{`
            .MuiTableCell-root:hover .resize-handle {
                opacity: 0.5;
            }
            .resize-handle:hover {
                opacity: 1 !important;
            }
        `}</style>
    </StyledBookingCell>
  );
};

export default BookingCell;
