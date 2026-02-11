import { useState, useEffect, useCallback } from 'react';
import { addMinutes, differenceInMinutes, parseISO } from 'date-fns';
import { Booking, DragState } from '../types';

interface UseDragBookingProps {
  bookingsRef: React.MutableRefObject<Booking[]>;
  onCellClick: (roomId: string, timeSlotIso: string, duration?: number, isDrag?: boolean) => void;
  onBookingClick: (bookingId: string) => void;
  onMoveBooking?: (bookingId: string, newRoomId: string, newStartTime: string) => void;
  onExtendBooking?: (originalBookingId: string, durationMinutes: number) => void;
}

export const useDragBooking = ({
  bookingsRef,
  onCellClick,
  onBookingClick,
  onMoveBooking,
  onExtendBooking,
}: UseDragBookingProps) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    type: 'CREATE',
    startConfig: null,
    currentConfig: null,
    bookingId: null,
    originalDuration: 30,
    isValid: true,
    hasMoved: false
  });

  const checkOverlap = useCallback((roomId: string, start: Date, end: Date, excludeBookingId?: string | null) => {
    return bookingsRef.current.some(b => {
      if (excludeBookingId && b.id === excludeBookingId) return false;
      const bStart = parseISO(b.start_time);
      const bEnd = parseISO(b.end_time);
      return b.room_id === roomId && (start < bEnd && end > bStart);
    });
  }, [bookingsRef]);

  const handleMouseDownCell = (roomId: string, timeSlot: Date) => {
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
    e.preventDefault();
    const booking = bookingsRef.current.find(b => b.id === bookingId);
    if (!booking) return;

    const duration = differenceInMinutes(parseISO(booking.end_time), parseISO(booking.start_time));
    const rect = e.currentTarget.getBoundingClientRect();
    const pixelOffset = e.clientY - rect.top;
    const pixelHeight = rect.height;
    const offsetRatio = pixelOffset / pixelHeight;
    const offsetMinutesRaw = offsetRatio * duration;
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
    if (!dragState.isDragging || !dragState.startConfig) return;
    
    const timeSlot = new Date(timeSlotIso);
    
    setDragState(prev => {
        if (!prev.startConfig) return prev; // Should be covered by check above but for TS narrowing
        
        // Safety check: if we somehow lost startConfig, bail
        if (!prev.startConfig) return prev;

        let isValid = true;
        let newCurrent = { roomId, timeSlot };

        if (prev.type === 'CREATE') {
            newCurrent.roomId = prev.startConfig.roomId;
            
            if (timeSlot < prev.startConfig.timeSlot) {
                newCurrent.timeSlot = prev.startConfig.timeSlot;
            }

            let duration = differenceInMinutes(addMinutes(newCurrent.timeSlot, 30), prev.startConfig.timeSlot);
            if (duration > 120) {
                const maxSlots = 4;
                newCurrent.timeSlot = addMinutes(prev.startConfig.timeSlot, (maxSlots - 1) * 30);
                duration = 120;
            }
            
            const start = prev.startConfig.timeSlot;
            const end = addMinutes(prev.startConfig.timeSlot, duration);
            
            isValid = !checkOverlap(prev.startConfig.roomId, start, end);
        } 
        else if (prev.type === 'MOVE') {
            newCurrent.roomId = roomId;

            const offset = prev.dragOffsetInMinutes || 0;
            newCurrent.timeSlot = addMinutes(timeSlot, -offset);

            const start = newCurrent.timeSlot;
            const end = addMinutes(start, prev.originalDuration);
            isValid = !checkOverlap(newCurrent.roomId, start, end, prev.bookingId);
        }
        else if (prev.type === 'EXTEND') {
            newCurrent.roomId = prev.startConfig.roomId;
            
            const start = prev.startConfig.timeSlot; 
            let proposedEnd = addMinutes(timeSlot, 30);
            
            const duration = differenceInMinutes(proposedEnd, start);
            
            let targetEnd = proposedEnd;

            if (targetEnd <= start) {
                targetEnd = start; 
            } else {
                if (duration > 120) {
                    targetEnd = addMinutes(start, 120);
                }
            }
            
            if (differenceInMinutes(targetEnd, start) > 0) {
                isValid = !checkOverlap(newCurrent.roomId, start, targetEnd, prev.bookingId);
            } else {
                isValid = true;
            }
            
            if (targetEnd > start) {
                newCurrent.timeSlot = addMinutes(targetEnd, -30);
            } else {
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
          onCellClick(startConfig.roomId, startConfig.timeSlot.toISOString(), duration, hasMoved);
        } else if (type === 'MOVE' && bookingId) {
          if (!hasMoved) {
            onBookingClick(bookingId);
          } else if ((currentConfig.roomId !== startConfig.roomId || currentConfig.timeSlot.getTime() !== startConfig.timeSlot.getTime()) && onMoveBooking) {
            onMoveBooking(bookingId, currentConfig.roomId, currentConfig.timeSlot.toISOString());
          }
        } else if (type === 'EXTEND' && bookingId && onExtendBooking) {
          const start = startConfig.timeSlot;
          let proposedEnd = addMinutes(currentConfig.timeSlot, 30);
          
          if (proposedEnd > start) {
            const duration = differenceInMinutes(proposedEnd, start);
            if (duration >= 30) {
              onExtendBooking(bookingId, duration);
            }
          }
        }
      }

      setDragState(prev => ({ ...prev, isDragging: false, startConfig: null, currentConfig: null, bookingId: null, hasMoved: false }));
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [dragState, onCellClick, onMoveBooking, onExtendBooking, onBookingClick]);

  return {
    dragState,
    handleMouseDownCell,
    handleMouseDownBooking,
    handleExtendStart,
    handleMouseEnterCell,
  };
};
