export interface Room {
  id: string;
  name: string;
  capacity?: number | null;
  is_available?: boolean | null;
  dynamic_labels?: string[] | null;
}

export interface Booking {
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

export interface DragState {
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
}
