/**
 * Purpose: Module logic for lib\log.ts.
 */
import { supabase } from "./supabaseClient";

export type BookingCreateDetail = {
  type: 'manual' | 'smart' | 'extension';
  rank: number | null;
  name_entered: 'auto' | 'manual';
  state: 'active' | 'reserved' | 'ended';
  time: number; // seconds
};

export type StateChangeDetail = {
  type: 'manual' | 'quick' | 'double_tap' | 'extended' | 'auto';
  state: 'reserved_to_active' | 'active_to_ended';
  time: number; // minutes difference
};

export const logEvent = async (
  eventType: 'booking_create' | 'state_change', 
  detail: BookingCreateDetail | StateChangeDetail
) => {
  if (import.meta.env.VITE_LOGGING_ENABLED !== 'true') return;

  try {
    const { error } = await supabase.from('logs').insert({
      event_type: eventType,
      detail: detail
    });
    
    if (error) {
      console.error('Failed to log event:', error);
    }
  } catch (err) {
    console.error('Error logging event:', err);
  }
};
