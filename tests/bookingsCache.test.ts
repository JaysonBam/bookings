import assert from 'node:assert/strict'
import test from 'node:test'
import { removeBookingRows, upsertBookingRows } from '../src/pages/bookings/context/bookingsCache.ts'
import type { BookingRow } from '../src/api/supabase/types.ts'

const booking = (id: number, day: string, startTime: string): BookingRow => ({
  id,
  room_id: 1,
  booking_day: day,
  start_time: startTime,
  end_time: '10:00:00',
  booked_by: 'Tester',
  state: 'Active',
})

test('upsert replaces and reorders a booking without duplicating it', () => {
  const day = '2026-07-31'
  const result = upsertBookingRows(
    { [day]: [booking(1, day, '09:00:00'), booking(2, day, '10:00:00')] },
    [booking(2, day, '08:30:00')],
  )
  assert.deepEqual(result[day].map((row) => row.id), [2, 1])
})

test('moving a booking removes it from its previously cached date', () => {
  const oldDay = '2026-07-31'
  const newDay = '2026-08-01'
  const result = upsertBookingRows(
    { [oldDay]: [booking(1, oldDay, '09:00:00')], [newDay]: [] },
    [booking(1, newDay, '09:00:00')],
  )
  assert.equal(result[oldDay].length, 0)
  assert.equal(result[newDay].length, 1)
})

test('realtime changes do not mark an unloaded date as fully cached', () => {
  const result = upsertBookingRows({}, [booking(1, '2026-08-01', '09:00:00')])
  assert.equal(Object.hasOwn(result, '2026-08-01'), false)
})

test('removal accepts either numeric or string ids', () => {
  const day = '2026-07-31'
  const result = removeBookingRows({ [day]: [booking(1, day, '09:00:00')] }, ['1'])
  assert.equal(result[day].length, 0)
})
