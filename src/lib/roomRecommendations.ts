export interface RoomCandidate {
  id: string | number;
  name: string;
  max_people?: number | null;
  min_people?: number | null;
  is_available?: boolean | null;
  dynamic_labels?: unknown[] | null;
}

export interface RoomBooking {
  id?: string | number;
  room_id: string | number;
  booking_day: string;
  start_time: string;
  end_time: string;
  state: string;
}

export interface RoomRequest {
  date: string;
  time: string;
  now: Date;
  openingHours: { start: string; end: string };
  duration?: number;
  excludeBookingId?: string | number;
}

const minutes = (time: string) => {
  const [h, m, s = 0] = time.split(':').map(Number);
  return h * 60 + m + s / 60;
};

const dayOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Reclaiming a late reservation is a live, same-day action, never a rule for
// historical schedules. Save still asks for confirmation before deleting it.
export function isReclaimableReservation(booking: RoomBooking, request: RoomRequest) {
  return booking.state === 'Reserved' && booking.booking_day === request.date &&
    request.date === dayOf(request.now) &&
    request.now.getTime() > new Date(`${booking.booking_day}T${booking.start_time}`).getTime() + 10 * 60_000;
}

export function getRoomAvailability(roomId: string | number, bookings: RoomBooking[], request: RoomRequest) {
  const target = new Date(`${request.date}T${request.time}`);
  const start = minutes(request.time);
  const open = minutes(request.openingHours.start);
  const close = minutes(request.openingHours.end);
  const validStart = Number.isFinite(target.getTime()) && dayOf(target) === request.date &&
    Number.isFinite(start) && start % 30 === 0 && start >= open && start < close;
  let limit = close;
  let occupied = false;
  let reserved = false;
  let lateMinutes = 0;
  let overdueMinutes = 0;

  for (const booking of bookings) {
    if (String(booking.room_id) !== String(roomId) || booking.booking_day !== request.date ||
      (request.excludeBookingId !== undefined && String(booking.id) === String(request.excludeBookingId))) continue;
    const bookingStart = minutes(booking.start_time);
    const bookingEnd = minutes(booking.end_time);
    const late = isReclaimableReservation(booking, request);

    if (bookingStart <= start && bookingEnd > start) {
      if (late) {
        lateMinutes = Math.max(lateMinutes, Math.floor((request.now.getTime() - new Date(`${booking.booking_day}T${booking.start_time}`).getTime()) / 60_000));
      } else {
        // Ended rows also occupy their recorded interval under the database's
        // exclusion constraint. Ignoring them would recommend unsavable slots.
        occupied = true;
        reserved = booking.state === 'Reserved';
      }
    }
    if (!late && bookingStart > start) limit = Math.min(limit, bookingStart);
    if (booking.state === 'Active' && request.date === dayOf(request.now)) {
      overdueMinutes = Math.max(overdueMinutes, Math.floor((request.now.getTime() - new Date(`${booking.booking_day}T${booking.end_time}`).getTime()) / 60_000));
    }
  }

  return { minutesAvailable: validStart && !occupied ? Math.max(0, limit - start) : 0,
    occupied, reserved, lateMinutes, overdueMinutes };
}

export function rankRooms<T extends RoomCandidate>(groupSize: number, rooms: T[], bookings: RoomBooking[], request: RoomRequest): T[] {
  const duration = request.duration ?? 30;
  if (!Number.isInteger(groupSize) || groupSize <= 0 || !Number.isFinite(duration) || duration <= 0 || duration % 30 !== 0) return [];
  return rooms.filter(room => room.is_available !== false && (room.max_people ?? 0) >= groupSize)
    .map(room => {
      const min = room.min_people ?? 0;
      return { room, fit: groupSize >= min ? min : -min,
        issues: (room.dynamic_labels ?? []).length, ...getRoomAvailability(room.id, bookings, request) };
    })
    .filter(room => room.minutesAvailable >= duration)
    .sort((a, b) => {
      if (a.fit !== b.fit) return b.fit - a.fit;
      if (!!a.lateMinutes !== !!b.lateMinutes) return a.lateMinutes ? 1 : -1;
      if (!a.lateMinutes && a.minutesAvailable !== b.minutesAvailable) return b.minutesAvailable - a.minutesAvailable;
      if (a.lateMinutes && a.lateMinutes !== b.lateMinutes) return b.lateMinutes - a.lateMinutes;
      if (!a.overdueMinutes && b.overdueMinutes) return -1;
      if (a.overdueMinutes && !b.overdueMinutes) return 1;
      if (a.overdueMinutes !== b.overdueMinutes) return b.overdueMinutes - a.overdueMinutes;
      if (a.issues !== b.issues) return a.issues - b.issues;
      return a.room.name.localeCompare(b.room.name);
    }).map(result => result.room);
}
