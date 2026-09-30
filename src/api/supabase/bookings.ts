import { supabase } from './client'
import { throwIfError } from './errors'
import type { BookingRow, BookingUpdate, BookingWrite, ReportBookingRow } from './types'

export const BOOKING_COLUMNS = `
  id,
  room_id,
  course_id,
  course_name,
  start_time,
  end_time,
  booking_day,
  student_numbers,
  borrowed_items,
  booked_by,
  bulk_booking_id,
  state,
  rooms(name),
  courses(id,name,color_hex)
`

const castBookings = (data: unknown) => (data || []) as BookingRow[]

export const getBookingsForDate = async (date: string) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .eq('booking_day', date)
    .order('start_time')
  throwIfError(error, 'Failed to load bookings')
  return castBookings(data)
}

export const getBookingById = async (id: string | number) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .eq('id', id)
    .single()
  throwIfError(error, 'Failed to load the booking')
  return data as unknown as BookingRow
}

export const getBookingsByBulkId = async (bulkBookingId: string) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .eq('bulk_booking_id', bulkBookingId)
    .order('booking_day')
    .order('start_time')
  throwIfError(error, 'Failed to load the booking group')
  return castBookings(data)
}

export const getUnendedBookingsBefore = async (roomId: string | number, date: string, startTime: string) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('id,room_id,start_time,end_time,state,booking_day')
    .eq('room_id', roomId)
    .eq('booking_day', date)
    .lt('start_time', startTime)
    .neq('state', 'Ended')
  throwIfError(error, 'Failed to check earlier bookings')
  return castBookings(data)
}

export const createBooking = async (booking: BookingWrite | Record<string, unknown>) => {
  const { data, error } = await supabase
    .from('bookings')
    .insert(booking)
    .select(BOOKING_COLUMNS)
    .single()
  throwIfError(error, 'Failed to create the booking')
  return data as unknown as BookingRow
}

export const createBookings = async (bookings: Array<BookingWrite | Record<string, unknown>>) => {
  if (bookings.length === 0) return []
  const { data, error } = await supabase
    .from('bookings')
    .insert(bookings)
    .select(BOOKING_COLUMNS)
  throwIfError(error, 'Failed to create bookings')
  return castBookings(data)
}

export const updateBooking = async (id: string | number, updates: BookingUpdate | Record<string, unknown>) => {
  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select(BOOKING_COLUMNS)
    .single()
  throwIfError(error, 'Failed to update the booking')
  return data as unknown as BookingRow
}

export const updateBookingGroup = async (bulkBookingId: string, updates: BookingUpdate | Record<string, unknown>) => {
  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('bulk_booking_id', bulkBookingId)
    .select(BOOKING_COLUMNS)
  throwIfError(error, 'Failed to update the booking group')
  return castBookings(data)
}

export const endEarlierBookings = async (roomId: string | number, date: string, startTime: string) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({ state: 'Ended' })
    .eq('room_id', roomId)
    .eq('booking_day', date)
    .lt('start_time', startTime)
    .neq('state', 'Ended')
    .select(BOOKING_COLUMNS)
  throwIfError(error, 'Failed to end earlier bookings')
  return castBookings(data)
}

export const deleteBooking = async (id: string | number) => {
  const { data, error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', id)
    .select('id,booking_day')
  throwIfError(error, 'Failed to delete the booking')
  return (data || []) as Array<Pick<BookingRow, 'id' | 'booking_day'>>
}

export const deleteBookings = async (ids: Array<string | number>) => {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('bookings')
    .delete()
    .in('id', ids)
    .select('id,booking_day')
  throwIfError(error, 'Failed to delete bookings')
  return (data || []) as Array<Pick<BookingRow, 'id' | 'booking_day'>>
}

export const deleteBookingGroup = async (bulkBookingId: string) => {
  const { data, error } = await supabase
    .from('bookings')
    .delete()
    .eq('bulk_booking_id', bulkBookingId)
    .select('id,booking_day')
  throwIfError(error, 'Failed to delete the booking group')
  return (data || []) as Array<Pick<BookingRow, 'id' | 'booking_day'>>
}

export const getBookingsPage = async (startDate: string, endDate: string, from: number, to: number) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('id,room_id,course_id,course_name,start_time,end_time,booking_day,student_numbers,booked_by,bulk_booking_id')
    .gte('booking_day', startDate)
    .lte('booking_day', endDate)
    .range(from, to)
    .order('booking_day', { ascending: true })
    .order('start_time', { ascending: true })
    .order('id', { ascending: true })
  throwIfError(error, 'Failed to load report bookings')
  return (data || []) as ReportBookingRow[]
}
