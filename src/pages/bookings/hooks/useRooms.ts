import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export interface Room {
  id: string;
  name: string;
  capacity?: number | null;
  is_available?: boolean | null;
  dynamic_labels?: string[] | null;
  borrowable_items?: string[];
}

export function useRooms() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const { data: roomsData, error } = await supabase.from("rooms").select("*");
                if (error) throw error;
                
                if (roomsData) {
                    const fetched = (roomsData as any[])
                        .filter((r) => r.is_available !== false)
                        .map((r) => ({ ...r, id: String(r.id) }));
                        
                    // Sort rooms: Numeric rooms first, then alphabetical
                    const roomRegex = /^Room\s*(\d+)$/i;
                    const numericRooms = fetched
                        .map((r) => ({ r, m: (r.name.match(roomRegex) || [])[1] }))
                        .filter((x) => x.m)
                        .map((x) => ({ room: x.r, num: parseInt(x.m, 10) }))
                        .sort((a, b) => a.num - b.num)
                        .map((x) => x.room);
                    
                    const otherRooms = fetched
                        .filter((r) => !roomRegex.test(r.name))
                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
                        
                    setRooms([...numericRooms, ...otherRooms]);
                }
            } catch (err) {
                console.error("Error loading rooms", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    return { rooms, loading };
}
