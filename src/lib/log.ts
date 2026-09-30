import {
  insertLogEvent,
  insertLogEvents,
  type BookingCreateDetail,
  type StateChangeDetail,
} from '../api/supabase/logs'

export type { BookingCreateDetail, StateChangeDetail }

export const logEvent = async (
  eventType: 'booking_create' | 'state_change', 
  detail: BookingCreateDetail | StateChangeDetail
) => {
  if (import.meta.env.VITE_LOGGING_ENABLED !== 'true') return;

  try {
    await insertLogEvent(eventType, detail)
  } catch (err) {
    console.error('Error logging event:', err);
  }
};

export const logEvents = async (events: Array<{
  eventType: 'booking_create' | 'state_change'
  detail: BookingCreateDetail | StateChangeDetail
}>) => {
  if (import.meta.env.VITE_LOGGING_ENABLED !== 'true' || events.length === 0) return
  try {
    await insertLogEvents(events)
  } catch (err) {
    console.error('Error logging events:', err)
  }
}
