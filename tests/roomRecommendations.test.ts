import assert from 'node:assert/strict'
import test from 'node:test'
import { getRoomAvailability, isReclaimableReservation, rankRooms } from '../src/lib/roomRecommendations.ts'
import type { RoomCandidate, RoomBooking, RoomRequest } from '../src/lib/roomRecommendations.ts'

const room = (id: number, overrides: Partial<RoomCandidate> = {}): RoomCandidate =>
  ({ id, name: `Room ${id}`, max_people: 8, min_people: 1, ...overrides })
const booking = (room_id: number, start_time: string, end_time: string, overrides: Partial<RoomBooking> = {}): RoomBooking =>
  ({ id: room_id, room_id, booking_day: '2026-10-03', start_time, end_time, state: 'Reserved', ...overrides })
const request: RoomRequest = { date: '2026-10-03', time: '13:00', now: new Date('2026-10-02T12:00'),
  openingHours: { start: '06:00', end: '21:00' } }
const ids = (rooms: RoomCandidate[]) => rooms.map(room => room.id)

test('capacity and room availability are mandatory before best-fit ranking', () => {
  assert.deepEqual(ids(rankRooms(4, [room(1, { max_people: 3 }), room(2, { is_available: false }), room(3)], [], request)), [3])
})
test('a future booking must fit the entire selected duration', () => {
  const rooms = [room(1, { min_people: 4 }), room(2)]
  const bookings = [booking(1, '13:30', '14:30')]
  assert.deepEqual(ids(rankRooms(4, rooms, bookings, { ...request, duration: 90 })), [2])
  assert.deepEqual(ids(rankRooms(4, rooms, bookings, { ...request, duration: 30 })), [1, 2])
})
test('no duration selected still requires one bookable half-hour', () => {
  assert.deepEqual(rankRooms(4, [room(1)], [booking(1, '13:15', '14:00')], request), [])
})
test('configured opening and closing hours bound availability', () => {
  for (const time of ['05:30', '21:00', '21:30', '', 'garbage', '13:15']) {
    assert.deepEqual(rankRooms(4, [room(1)], [], { ...request, time }), [], time)
  }
  assert.equal(getRoomAvailability(1, [], { ...request, time: '20:30' }).minutesAvailable, 30)
  assert.deepEqual(rankRooms(4, [room(1)], [], { ...request, time: '20:30', duration: 60 }), [])
  assert.equal(getRoomAvailability(1, [], { ...request, openingHours: { start: '08:00', end: '14:00' } }).minutesAvailable, 60)
})
test('reservations on a future day cannot be reclaimed using the current clock', () => {
  const bookings = [booking(1, '13:00', '14:00')]
  assert.deepEqual(rankRooms(4, [room(1)], bookings, request), [])
  assert.equal(isReclaimableReservation(bookings[0], request), false)
})
test('late reclaiming uses the actual clock and a strict ten-minute threshold', () => {
  const b = booking(1, '13:00', '14:00', { booking_day: '2026-10-02' })
  const live = { ...request, date: '2026-10-02', now: new Date('2026-10-02T13:10') }
  assert.equal(isReclaimableReservation(b, live), false)
  assert.deepEqual(rankRooms(4, [room(1)], [b], live), [])
  assert.equal(isReclaimableReservation(b, { ...live, now: new Date('2026-10-02T13:10:01') }), true)
  assert.equal(isReclaimableReservation({ ...b, state: 'Active' }, { ...live, now: new Date('2026-10-02T13:30') }), false)
})
test('past schedules do not mark every old reservation reclaimable', () => {
  const past = { ...request, date: '2026-10-01' }
  const b = booking(1, '13:00', '14:00', { booking_day: past.date })
  assert.equal(isReclaimableReservation(b, past), false)
  assert.deepEqual(rankRooms(4, [room(1)], [b], past), [])
})
test('Ended rows block their recorded interval just as the database does', () => {
  for (const state of ['Active', 'Reserved', 'Ended']) {
    assert.deepEqual(rankRooms(4, [room(1)], [booking(1, '13:00', '14:00', { state })], request), [])
  }
})
test('bookings from another date never cap or occupy the selected day', () => {
  assert.equal(getRoomAvailability(1, [booking(1, '13:00', '14:00', { booking_day: '2026-10-02' })], request).minutesAvailable, 480)
})
test('adjacent bookings allow an exact end boundary and exclude the booking being edited', () => {
  const bookings = [booking(1, '12:00', '13:00'), booking(1, '14:00', '15:00', { id: 2 })]
  assert.equal(getRoomAvailability(1, bookings, request).minutesAvailable, 60)
  assert.equal(getRoomAvailability(1, bookings, { ...request, excludeBookingId: 2 }).minutesAvailable, 480)
})
test('fit, clean availability, length, maintenance and name keep their existing priority', () => {
  assert.deepEqual(ids(rankRooms(4, [room(1), room(2, { min_people: 4 }), room(3, { min_people: 6 })], [], request)), [2, 1, 3])
  assert.deepEqual(ids(rankRooms(4, [room(1), room(2)], [booking(1, '14:00', '15:00')], request)), [2, 1])
  assert.deepEqual(ids(rankRooms(4, [room(1, { dynamic_labels: ['Lights 💡'] }), room(2)], [], request)), [2, 1])
  assert.deepEqual(ids(rankRooms(4, [room(2), room(1)], [], request)), [1, 2])
  const live = { ...request, date: '2026-10-02', now: new Date('2026-10-02T13:20') }
  assert.deepEqual(ids(rankRooms(4, [room(1), room(2)], [booking(1, '13:00', '14:00', { booking_day: live.date })], live)), [2, 1])
})
test('overdue status remains a same-day tie-breaker, never future occupancy', () => {
  const b = booking(1, '10:00', '11:00', { booking_day: '2026-10-02', state: 'Active' })
  assert.equal(getRoomAvailability(1, [b], { ...request, date: b.booking_day }).overdueMinutes, 60)
  assert.equal(getRoomAvailability(1, [b], request).overdueMinutes, 0)
})
test('invalid group sizes, dates and durations return no recommendations', () => {
  for (const size of [0, -1, 1.5, NaN]) assert.deepEqual(rankRooms(size, [room(1)], [], request), [])
  for (const duration of [0, -30, 15, NaN]) assert.deepEqual(rankRooms(4, [room(1)], [], { ...request, duration }), [])
  for (const date of ['', 'not-a-date', '2026-02-30']) assert.deepEqual(rankRooms(4, [room(1)], [], { ...request, date }), [])
})
