import { supabase } from "../../../lib/supabaseClient";
import { format, parseISO, addMinutes, eachDayOfInterval, isBefore } from "date-fns";
import timeLib from "../../../lib/time";
import { BookingFormState } from "./useBookingForm";

export function useBookingMutations(
    form: BookingFormState, 
    prefill: any, 
    onClose: () => void, 
    onBookingUpdate?: () => void,
    showToast: (t: string, d: string, s: "success"|"error"|"info") => void = () => {},
    confirm?: any
) {

    const mapDatabaseError = (error: any): string => {
        if (!error) return "An unexpected error occurred";
        if (error.code === "23P01") return "This time slot is already booked.";
        if (error.code === "23514") return "Invalid booking time.";
        if (error.code === "23503") return "Invalid room or course.";
        return error.message || "Unable to complete the operation.";
    };

    const handleSingleSave = async (state: "Active" | "Reserved" | "Ended") => {
        const { 
            roomId, startDate, startClock, duration, staffName, selectedCourseId, otherCourseName, 
            studentNumbers, selectedBorrowed, selectedExtension 
        } = form;

        // Validation
        const newErrors: Record<string, boolean> = {};
        if (!roomId) newErrors.roomId = true;
        if (!startDate) newErrors.startDate = true;
        if (!startClock) newErrors.startClock = true;
        if (!duration) newErrors.duration = true;
        if (!staffName?.trim()) newErrors.staffName = true;
        if (!selectedCourseId) newErrors.selectedCourseId = true;
        if (selectedCourseId === "other" && !otherCourseName?.trim()) newErrors.otherCourseName = true;
        if (Object.keys(newErrors).length > 0) {
            form.setErrors(newErrors);
            showToast("Missing fields", "Please fill in all required fields.", "error");
            return;
        }

        const borrowed = Object.keys(selectedBorrowed).filter((k) => selectedBorrowed[k]);

        // Return Check
        if (state === "Ended" && borrowed.length > 0 && confirm) {
            const lowercasedItems = borrowed.map((item) => item.toLowerCase());
            const itemsList = lowercasedItems.join(', ');
            const returned = await confirm({
                title: "Confirm Return",
                description: `Are ${itemsList} returned?`,
                confirmText: "Yes",
                cancelText: "No",
            });
            if (!returned) return;
        }

        form.setLoading(true);
        try {
            const start = parseISO(`${startDate}T${startClock}`);
            const extensionMins = selectedExtension ? parseInt(selectedExtension, 10) : 0;
            let end = addMinutes(start, parseInt(duration, 10));

            // Logic for ending early / truncating
            if (state === 'Ended') {
                const now = await timeLib.getTime();
                const m = now.getMinutes();
                const roundedM = Math.round(m / 30) * 30;
                now.setMinutes(roundedM);
                now.setSeconds(0);
                now.setMilliseconds(0);
                
                if (now < end) {
                    if (now <= start) {
                        if (prefill?.booking) {
                            const { error } = await supabase.from('bookings').delete().eq('id', prefill.booking.id);
                            if (error) throw error;
                            showToast("Deleted", "Booking deleted.", "info");
                        } else {
                            showToast("Not Saved", "Booking would end before start time.", "info");
                        }
                        form.resetForm();
                        onBookingUpdate?.();
                        onClose();
                        form.setLoading(false);
                        return;
                    } else {
                        end = now;
                    }
                }
            }

            const payload: any = {
                room_id: parseInt(roomId, 10),
                start_time: format(start, "HH:mm:ss"),
                end_time: format(end, "HH:mm:ss"),
                booking_day: startDate,
                student_numbers: studentNumbers || null,
                borrowed_items: borrowed,
                booked_by: staffName,
                state,
            };

            if (selectedCourseId && selectedCourseId !== "other") {
                payload.course_id = parseInt(selectedCourseId, 10);
                payload.course_name = null;
            } else if (selectedCourseId === "other") {
                payload.course_id = null;
                payload.course_name = otherCourseName || null;
            } else {
                payload.course_id = null;
                payload.course_name = null;
            }

            if (prefill?.booking) {
                if (extensionMins > 0) {
                    // Update original to Ended
                    const updatePayload = { ...payload, state: 'Ended' };
                    const { error } = await supabase.from("bookings").update(updatePayload).eq("id", prefill.booking.id);
                    if (error) throw error;

                    // Extension booking
                    const extStart = end;
                    const extEnd = addMinutes(extStart, extensionMins);
                    const extPayload = {
                        ...payload,
                        state: 'Active',
                        start_time: format(extStart, "HH:mm:ss"),
                        end_time: format(extEnd, "HH:mm:ss"),
                        booking_day: format(extStart, "yyyy-MM-dd")
                    };
                    await supabase.from("bookings").insert(extPayload);
                    showToast("Extended", "Extension booking created", "success");
                } else {
                    const { error } = await supabase.from("bookings").update(payload).eq("id", prefill.booking.id);
                    if (error) throw error;
                    showToast("Updated", "Booking updated", "success");
                }
            } else {
                const { error } = await supabase.from("bookings").insert(payload);
                if (error) throw error;
                showToast("Saved", "Booking created", "success");
            }

            form.resetForm();
            onBookingUpdate?.();
            onClose();
        } catch (err: any) {
            console.error(err);
            showToast("Save failed", mapDatabaseError(err), "error");
        } finally {
            form.setLoading(false);
        }
    };

    const handleBulkSave = async (state: "Active" | "Reserved" | "Ended") => {
        const { bulkDates, bulkTimes, bulkRoomIds, selectedCourseId, otherCourseName, staffName } = form;
        
        // Validation
        const newErrors: Record<string, boolean> = {};
        if (bulkRoomIds.length === 0) newErrors.bulkRooms = true;
        const validDates = bulkDates.filter(d => d.start && d.end);
        const validTimes = bulkTimes.filter(t => t.start && t.end);
        if (validDates.length === 0) newErrors.bulkDates = true;
        if (validTimes.length === 0) newErrors.bulkTimes = true;
        if (!selectedCourseId) newErrors.selectedCourseId = true;
        if (selectedCourseId === "other" && !otherCourseName?.trim()) newErrors.otherCourseName = true;
        if (!staffName.trim()) newErrors.staffName = true;

        if (Object.keys(newErrors).length > 0) {
            form.setErrors(newErrors);
            showToast("Missing fields", "Please fill in fields", "error");
            return;
        }

        form.setLoading(true);
        try {
            const bookingsToInsert: any[] = [];
            for (const dateRange of validDates) {
                const startD = parseISO(dateRange.start);
                const endD = parseISO(dateRange.end);
                if (isBefore(endD, startD)) {
                     showToast("Invalid date range", "End before start", "error");
                     form.setLoading(false);
                     return;
                }
                const days = eachDayOfInterval({ start: startD, end: endD });
                for (const day of days) {
                    const dayStr = format(day, "yyyy-MM-dd");
                    for (const timeRange of validTimes) {
                        const tStart = timeRange.start;
                        const tEnd = timeRange.end;
                        if (!tStart || !tEnd || tStart >= tEnd) continue;
                        for (const rId of bulkRoomIds) {
                            const payload: any = {
                                room_id: parseInt(rId, 10),
                                start_time: tStart + ":00",
                                end_time: tEnd + ":00",
                                booking_day: dayStr,
                                booked_by: staffName,
                                state: state,
                                course_id: (selectedCourseId && selectedCourseId !=='other') ? parseInt(selectedCourseId) : null,
                                course_name: (selectedCourseId === 'other') ? otherCourseName : null
                            };
                            bookingsToInsert.push(payload);
                        }
                    }
                }
            }
            if (bookingsToInsert.length > 0) {
                const { error } = await supabase.from("bookings").insert(bookingsToInsert);
                if (error) throw error;
                showToast("Saved", `${bookingsToInsert.length} bookings created`, "success");
                form.resetForm();
                onBookingUpdate?.();
                onClose();
            }
        } catch (err: any) {
             showToast("Bulk Save failed", mapDatabaseError(err), "error");
        } finally {
            form.setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!prefill?.booking?.id) return;
        if (confirm) {
             const ok = await confirm({
                title: "Delete Booking",
                description: "Delete this booking?",
                confirmText: "Delete",
                cancelText: "Cancel",
             });
             if (!ok) return;
        }

        form.setLoading(true);
        try {
            const { error } = await supabase.from('bookings').delete().eq('id', prefill.booking.id);
            if (error) throw error;
            showToast("Deleted", "Booking deleted", "info");
            onBookingUpdate?.();
            onClose();
        } catch (err: any) {
            showToast("Delete failed", err?.message, "error");
        } finally {
            form.setLoading(false);
        }
    };

    return { handleSingleSave, handleBulkSave, handleDelete };
}
