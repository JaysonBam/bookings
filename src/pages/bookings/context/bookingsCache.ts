import type { BookingRow } from '../../../api/supabase/types'

export type BookingCache = Record<string, BookingRow[]>

const sameBooking = (left: BookingRow, right: BookingRow) => Number(left.id) === Number(right.id)
const byStartTime = (left: BookingRow, right: BookingRow) => left.start_time.localeCompare(right.start_time)

export const upsertBookingRows = (cache: BookingCache, rows: BookingRow[]): BookingCache => {
  if (rows.length === 0) return cache
  const next: BookingCache = { ...cache }

  for (const row of rows) {
    for (const date of Object.keys(next)) {
      if (date !== row.booking_day) {
        next[date] = next[date].filter((booking) => !sameBooking(booking, row))
      }
    }

    // Do not create a cache entry for a date that has never been loaded. An empty
    // cache entry means "authoritatively loaded" to ensureDate.
    if (!next[row.booking_day]) continue
    const withoutExisting = next[row.booking_day].filter((booking) => !sameBooking(booking, row))
    next[row.booking_day] = [...withoutExisting, row].sort(byStartTime)
  }

  return next
}

export const removeBookingRows = (cache: BookingCache, ids: Array<string | number>): BookingCache => {
  if (ids.length === 0) return cache
  const numericIds = new Set(ids.map(Number))
  return Object.fromEntries(
    Object.entries(cache).map(([date, rows]) => [
      date,
      rows.filter((row) => !numericIds.has(Number(row.id))),
    ]),
  )
}
