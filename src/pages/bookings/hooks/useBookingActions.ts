import { useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { format, parseISO, differenceInMinutes, addMinutes } from 'date-fns';
import { logEvent } from '../../../lib/log';
import timeLib from '../../../lib/time';

interface UseBookingActionsProps {
    rooms: any[];
    confirm: any;
    showToast: (title: string, description: string, severity?: "success" | "error" | "info") => void;
    setRefreshGridTrigger: React.Dispatch<React.SetStateAction<number>>;
}

export const useBookingActions = ({ rooms, confirm, showToast, setRefreshGridTrigger }: UseBookingActionsProps) => {

    const handleMoveBooking = useCallback(async (bookingId: string, newRoomId: string, newStartTime: string) => {
        const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
        if (!booking) return;

        const newRoom = rooms.find(r => r.id === newRoomId)?.name || "New Room";
        const newStart = parseISO(newStartTime);
        const timeStr = format(newStart, "HH:mm");

        try {
            const confirmed = await confirm({
                title: "Confirm Move",
                description: `Do you want to move the booking to ${newRoom} at ${timeStr}?`,
                confirmText: "Move",
                cancelText: "Cancel"
            });

            if (!confirmed) return;

            const originalStart = parseISO(`${booking.booking_day}T${booking.start_time}`);
            const originalEnd = parseISO(`${booking.booking_day}T${booking.end_time}`);
            const duration = differenceInMinutes(originalEnd, originalStart);

            const newStartObj = parseISO(newStartTime);
            const newEndObj = addMinutes(newStartObj, duration);

            const newBookingDay = format(newStartObj, 'yyyy-MM-dd');
            const newStartTimeStr = format(newStartObj, 'HH:mm:ss');
            const newEndTimeStr = format(newEndObj, 'HH:mm:ss');

            const { error } = await supabase
                .from('bookings')
                .update({ 
                    room_id: newRoomId, 
                    booking_day: newBookingDay,
                    start_time: newStartTimeStr,
                    end_time: newEndTimeStr 
                })
                .eq('id', bookingId);
            
            if (error) throw error;
            
            showToast("Success", "Booking moved successfully", "success");
            setRefreshGridTrigger(prev => prev + 1);

        } catch (error) {
            console.error("Move failed:", error);
            showToast("Error", "Failed to move booking", "error");
        }
    }, [rooms, confirm, showToast, setRefreshGridTrigger]);

    const handleExtendBooking = useCallback(async (bookingId: string, durationMinutes: number) => {
        const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
        if (!booking) return;

        const startOfExtension = parseISO(`${booking.booking_day}T${booking.end_time}`);
        const endOfExtension = addMinutes(startOfExtension, durationMinutes);
        
        const startTimeStr = format(startOfExtension, "HH:mm:ss");
        const endTimeStr = format(endOfExtension, "HH:mm:ss");

        try {
            const confirmed = await confirm({
                title: "Confirm Extension",
                description: `Do you want to extend the booking by ${durationMinutes} minutes?`,
                confirmText: "Extend",
                cancelText: "Cancel"
            });

            if (!confirmed) return;
            
             const { error: updateError } = await supabase
                 .from('bookings')
                 .update({ state: 'Ended' })
                 .eq('id', bookingId);

             if (updateError) throw updateError;
             
             await logEvent('state_change', {
                 type: 'extended',
                 state: 'active_to_ended',
                 time: 0 
             });

             const newPayload = {
                 room_id: booking.room_id,
                 booking_day: booking.booking_day,
                 start_time: startTimeStr,
                 end_time: endTimeStr,
                 state: 'Active',
                 booked_by: booking.booked_by,
                 course_id: booking.course_id,
                 course_name: booking.course_name,
                 borrowed_items: booking.borrowed_items,
                 student_numbers: booking.student_numbers,
                 description: booking.description,
                 bulk_booking_id: booking.bulk_booking_id,
                 title: booking.title,
                 color: booking.color
             };

             const { error } = await supabase.from("bookings").insert(newPayload);

            if (error) throw error;
            
            await logEvent('booking_create', {
                 type: 'extension',
                 rank: null,
                 name_entered: 'auto', 
                 state: 'active',
                 time: 0
            });
            
            showToast("Success", "Booking extended", "success");
            setRefreshGridTrigger(prev => prev + 1);

        } catch (error) {
            console.error("Extension failed:", error);
            showToast("Error", "Failed to extend booking", "error");
        }
    }, [confirm, showToast, setRefreshGridTrigger]);

    const handleQuickAction = useCallback(async (bookingId: string, action: 'activate' | 'end') => {
        try {
            const { data: booking, error: fetchError } = await supabase
                .from('bookings')
                .select('start_time, end_time, booking_day, borrowed_items, bulk_booking_id')
                .eq('id', bookingId)
                .single();

            if (fetchError || !booking) throw fetchError || new Error("Booking not found");

            let scope = 'single';
            if (booking.bulk_booking_id) {
                 const result = await confirm({
                     title: action === 'activate' ? "Activate Booking" : "End Booking",
                     description: `This booking is part of a bulk group.`,
                     cancelText: "Cancel",
                     actions: [
                         { label: `${action === 'activate' ? 'Activate' : 'End'} This Only`, value: 'single', variant: 'outlined' },
                         { label: `${action === 'activate' ? 'Activate' : 'End'} Entire Group`, value: 'group', variant: 'contained' }
                     ]
                 });
                 if (!result) return;
                 scope = result;
            }

            const newState = action === 'activate' ? 'Active' : 'Ended';

            if (action === 'end') {
                if (scope === 'single') {
                    if (booking?.borrowed_items && booking.borrowed_items.length > 0) {
                        const lowercasedItems = booking.borrowed_items.map((item: string) => item.toLowerCase());
                        const itemsList = lowercasedItems.join(', ');
                        const lastIndex = itemsList.lastIndexOf(', ');
                        const formattedList = lastIndex !== -1 
                            ? itemsList.substring(0, lastIndex) + ' and ' + itemsList.substring(lastIndex + 2)
                            : itemsList;
                        
                        const verb = lowercasedItems.length === 1 ? 'Is' : 'Are';
                        const returned = await confirm({
                            title: "Confirm Return",
                            description: `${verb} ${formattedList} returned?`,
                            confirmText: "Yes",
                            cancelText: "No",
                        });
                        if (!returned) return;
                    }

                    const now = await timeLib.getTime();
                    const m = now.getMinutes();
                    const roundedM = Math.round(m / 30) * 30;
                    now.setMinutes(roundedM);
                    now.setSeconds(0);
                    now.setMilliseconds(0);

                    const bookingEnd = parseISO(`${booking.booking_day}T${booking.end_time}`);
                    const bookingStart = parseISO(`${booking.booking_day}T${booking.start_time}`);

                    if (now < bookingEnd) {
                        if (now <= bookingStart) {
                             const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
                             if (error) throw error;
                             showToast("Deleted", "Booking deleted (ended before start time)", "info");
                             setRefreshGridTrigger(prev => prev + 1);
                             return;
                        } else {
                            const newEndTime = format(now, "HH:mm:ss");
                            const { error } = await supabase
                                .from('bookings')
                                .update({ state: newState, end_time: newEndTime })
                                .eq('id', bookingId);
                            if (error) throw error;

                            await logEvent('state_change', {
                                type: 'quick',
                                state: 'active_to_ended',
                                time: differenceInMinutes(now, bookingEnd)
                            });

                            showToast("Success", `Booking ended early at ${format(now, "HH:mm")}`, "success");
                            setRefreshGridTrigger(prev => prev + 1);
                            return;
                        }
                    } else {
                         const { error } = await supabase
                            .from('bookings')
                            .update({ state: newState })
                            .eq('id', bookingId);
                         if (error) throw error;
                         
                         await logEvent('state_change', {
                             type: 'quick',
                             state: 'active_to_ended',
                             time: differenceInMinutes(now, bookingEnd)
                         });
                         
                         showToast("Success", "Booking ended", "success");
                         setRefreshGridTrigger(prev => prev + 1);
                         return;
                    }
                } else {
                    const { error } = await supabase
                        .from('bookings')
                        .update({ state: newState })
                        .eq('bulk_booking_id', booking.bulk_booking_id);
                    if (error) throw error;
                    
                    const now = await timeLib.getTime();
                    const bEnd = parseISO(`${booking.booking_day}T${booking.end_time}`);
                    await logEvent('state_change', {
                        type: 'quick',
                        state: 'active_to_ended',
                        time: differenceInMinutes(now, bEnd)
                    });

                    showToast("Success", `Group ended`, "success");
                    setRefreshGridTrigger(prev => prev + 1);
                    return;
                }
            }

            const nowForLog = await timeLib.getTime();
            const bStart = parseISO(`${booking.booking_day}T${booking.start_time}`);

            if (scope === 'group') {
                const { error } = await supabase
                    .from('bookings')
                    .update({ state: newState })
                    .eq('bulk_booking_id', booking.bulk_booking_id);
                if (error) throw error;
                 
                 await logEvent('state_change', {
                    type: 'quick',
                    state: 'reserved_to_active', 
                    time: differenceInMinutes(nowForLog, bStart)
                 });

                 showToast("Success", `Group ${newState.toLowerCase()}`, "success");
                 setRefreshGridTrigger(prev => prev + 1);
            } else {
                const { error } = await supabase
                    .from('bookings')
                    .update({ state: newState })
                    .eq('id', bookingId);
                if (error) throw error;

                 await logEvent('state_change', {
                    type: 'quick',
                    state: 'reserved_to_active',
                    time: differenceInMinutes(nowForLog, bStart)
                 });

                 showToast("Success", `Booking ${newState.toLowerCase()}`, "success");
                 setRefreshGridTrigger(prev => prev + 1);
            }
        } catch (err: any) {
            console.error("Quick action failed", err);
            showToast("Error", "Failed to update booking", "error");
        }
    }, [confirm, showToast, setRefreshGridTrigger]);

    return {
        handleMoveBooking,
        handleExtendBooking,
        handleQuickAction
    };
};
