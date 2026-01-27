import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { format } from 'date-fns';

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
  state?: 'Active' | 'Reserved' | 'Ended';
  booking_day?: string;
  student_numbers?: string;
  borrowed_items?: string[];
}

export function useBookings(selectedDate: Date, refreshTrigger: number = 0) {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchBookings = useCallback(async (dateStr: string) => {
        try {
            setLoading(true);
            const { data: bookingsData, error: bookingsErr } = await supabase
                .from("bookings")
                .select(`*, courses(id, name, color_hex), rooms(name)`)
                .eq("booking_day", dateStr);
            
            if (bookingsErr) {
                console.error("Error loading bookings:", bookingsErr);
                setLoading(false);
                return;
            }

            if (bookingsData) {
                const mapped = (bookingsData as any[]).map((b) => {
                    const startIso = `${b.booking_day}T${(b.start_time || "").slice(0,8)}`;
                    const endIso = `${b.booking_day}T${(b.end_time || "").slice(0,8)}`;
                    return {
                        ...b, // Spread original props
                        id: String(b.id),
                        room_id: String(b.room_id),
                        start_time: startIso,
                        end_time: endIso,
                        course: b.courses ?? null,
                    } as Booking;
                });
                setBookings(mapped);
            }
            setLoading(false);
        } catch (e) {
            console.error("Error fetching bookings", e);
            setLoading(false);
        }
    }, []);

    // Initial Fetch
    useEffect(() => {
        fetchBookings(format(selectedDate, "yyyy-MM-dd"));
    }, [selectedDate, fetchBookings, refreshTrigger]);

    // Realtime
    useEffect(() => {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const channel = supabase.channel(`bookings_realtime_${dateStr}_${Date.now()}`);
        
        channel
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'bookings' },
            (payload: any) => {
               if ((payload.new && payload.new.booking_day === dateStr) || 
                   (payload.old && payload.old.booking_day === dateStr)) {
                   fetchBookings(dateStr);
               }
            }
          )
          .subscribe();
    
        return () => { channel.unsubscribe(); };
    }, [selectedDate, fetchBookings]);

    return { bookings, loading, refreshBookings: () => fetchBookings(format(selectedDate, "yyyy-MM-dd")) };
}
