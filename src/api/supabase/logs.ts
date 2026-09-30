import { supabase } from './client'
import { throwIfError } from './errors'

export type BookingCreateDetail = {
  type: 'manual' | 'smart' | 'extension'
  rank: number | null
  name_entered: 'auto' | 'manual'
  state: 'active' | 'reserved' | 'ended'
  time: number
}

export type StateChangeDetail = {
  type: 'manual' | 'quick' | 'double_tap' | 'extended' | 'auto'
  state: 'reserved_to_active' | 'active_to_ended'
  time: number
}

export const insertLogEvent = async (
  eventType: 'booking_create' | 'state_change',
  detail: BookingCreateDetail | StateChangeDetail,
) => {
  const { error } = await supabase.from('logs').insert({ event_type: eventType, detail })
  throwIfError(error, 'Failed to record the event')
}

export const insertLogEvents = async (events: Array<{
  eventType: 'booking_create' | 'state_change'
  detail: BookingCreateDetail | StateChangeDetail
}>) => {
  if (events.length === 0) return
  const { error } = await supabase.from('logs').insert(events.map(({ eventType, detail }) => ({
    event_type: eventType,
    detail,
  })))
  throwIfError(error, 'Failed to record events')
}
