import React, { useState, useRef, useEffect } from "react";
import { parseISO } from "date-fns";
import { Button, Box, Typography } from "@mui/material";
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
      const isStartP = p.isStart;
      const isEndP = p.isEnd;
      const bg = isValid ? (p.type === 'CREATE' ? 'primary.main' : (p.color || 'info.main')) : 'error.main';
      
      const borderTop = isStartP ? '2px dashed rgba(255,255,255,0.5)' : 'none';
      const borderBottom = isEndP ? '2px dashed rgba(255,255,255,0.5)' : 'none';
      const borderX = '2px dashed rgba(255,255,255,0.5)';

      return (
           <Box sx={{
               position: 'absolute', 
               inset: 0,
               bgcolor: bg,
               opacity: isValid ? 0.8 : 0.6,
               borderTop: borderTop,
               borderBottom: borderBottom,
               borderLeft: borderX,
               borderRight: borderX,
               display: 'flex', alignItems: 'center', justifyContent: 'center',
               zIndex: 5,
               pointerEvents: 'none'
           }}>
             {isStartP && (
                 <Typography variant="caption" fontWeight="bold" sx={{ 
                     color: '#fff', 
                     textShadow: '0px 1px 2px rgba(0,0,0,0.6)', 
                 }}>
                     {p.label || (isValid ? (p.type === 'CREATE' ? '+ New' : 'Move') : 'Conflict')}
                 </Typography>
             )}
           </Box>
      );
  };
  
  // Helper to render Intersection Override (for multi-row bookings)
  const renderIntersectionPreview = () => {
      // Logic: 
      // 1. We know this cell occupies [start, end]
      // 2. We compare with dragGlobal [dStart, dEnd]
      // 3. Render box for the intersection
      if (!dragGlobal || !booking) return null;
      const bStart = parseISO(booking.start_time);
      const bEnd = parseISO(booking.end_time);
      
      const dStart = dragGlobal.start;
      const dEnd = dragGlobal.end;
      
      // Check intersection
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
      const bg = isValid ? (dragGlobal.type === 'CREATE' ? 'primary.main' : (dragGlobal.color || 'info.main')) : 'error.main';
      
      return (
         <Box sx={{
            position: 'absolute',
            left: 0, right: 0,
            top: `${topPct}%`,
            height: `${heightPct}%`,
            bgcolor: bg,
            opacity: isValid ? 0.8 : 0.6,
            border: '2px dashed rgba(255,255,255,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10, // Higher than normal content
            pointerEvents: 'none'
         }}>
             {/* Only show text if tall enough? */}
             {heightPct > 20 && (
                <Typography variant="caption" fontWeight="bold" sx={{ 
                     color: '#fff', 
                     textShadow: '0px 1px 2px rgba(0,0,0,0.6)', 
                 }}>
                     {dragGlobal.label || (isValid ? (dragGlobal.type === 'CREATE' ? '+ New' : 'Move') : 'Conflict')}
                 </Typography>
             )}
         </Box>
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
                <Box 
                    onMouseDown={(e) => e.stopPropagation()}
                    sx={{ 
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

            {/* Resize Handle - Only show on hover/active */}
            {onResizeStart && booking.state !== 'Ended' && (
                <Box
                    className="resize-handle"
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onResizeStart(booking.id, e);
                    }} 
                    sx={{
                        position: 'absolute',
                        bottom: -5, // Extend slightly below the cell for easier grabbing
                        left: 0, 
                        right: 0,
                        height: 15, // Larger hit area (10px inside, 5px outside)
                        cursor: 'ns-resize',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        '&:hover': { opacity: 1 },
                        // Visual indicator pill
                        '&::after': {
                            content: '""',
                            width: 40,
                            height: 4,
                            bgcolor: 'rgba(255,255,255,0.9)',
                            borderRadius: 2,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                        }
                    }}
                />
            )}

            {/* If we have global drag intersection logic (preferred for multi-row), use it. 
                Otherwise fall back to per-slot preview if exists (legacy/single-slot). */}
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
