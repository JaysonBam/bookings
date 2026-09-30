import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './client'
import type { BookingRow, SettingRow } from './types'

export type RealtimeStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'

export type BookingRealtimeChange = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  newRow: BookingRow | null
  oldRow: Partial<BookingRow> | null
}

export const subscribeToBookingChanges = (
  onChange: (change: BookingRealtimeChange) => void,
  onStatus?: (status: RealtimeStatus) => void,
): RealtimeChannel => {
  const channel = supabase
    .channel(`bookings_workspace_${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bookings' },
      (payload) => onChange({
        eventType: payload.eventType as BookingRealtimeChange['eventType'],
        newRow: payload.eventType === 'DELETE' ? null : payload.new as BookingRow,
        oldRow: payload.old as Partial<BookingRow>,
      }),
    )
    .subscribe((status) => onStatus?.(status as RealtimeStatus))

  return channel
}

export const subscribeToSettingChanges = (
  onChange: (setting: SettingRow) => void,
): RealtimeChannel => supabase
  .channel(`settings_workspace_${crypto.randomUUID()}`)
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'settings' },
    (payload) => {
      if (payload.eventType !== 'DELETE') onChange(payload.new as SettingRow)
    },
  )
  .subscribe()

export const removeRealtimeChannel = async (channel: RealtimeChannel) => {
  await supabase.removeChannel(channel)
}
