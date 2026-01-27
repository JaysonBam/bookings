import { useState, useMemo, useEffect } from "react";
import { format, parseISO } from "date-fns";
import timeLib from "../../../lib/time";

export interface BookingFormState {
  roomId: string;
  setRoomId: (id: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  startClock: string;
  setStartClock: (time: string) => void;
  duration: string;
  setDuration: (dur: string) => void;
  staffName: string;
  setStaffName: (name: string) => void;
  studentNumbers: string;
  setStudentNumbers: (nums: string) => void;
  selectedCourseId: string;
  setSelectedCourseId: (id: string) => void;
  otherCourseName: string;
  setOtherCourseName: (name: string) => void;
  selectedExtension: string;
  setSelectedExtension: (ext: string) => void;
  selectedState: "Active" | "Reserved" | "Ended";
  setSelectedState: (state: "Active" | "Reserved" | "Ended") => void;
  selectedBorrowed: Record<string, boolean>;
  setSelectedBorrowed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  toggleBorrowed: (item: string) => void;
  borrowableItems: string[];
  setBorrowableItems: (items: string[]) => void;
  errors: Record<string, boolean>;
  setErrors: (errors: Record<string, boolean>) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  dayBookings: any[];
  setDayBookings: (bookings: any[]) => void;
  
  // Bulk
  isBulkBooking: boolean;
  setIsBulkBooking: (isBulk: boolean) => void;
  bulkDates: { start: string; end: string }[];
  setBulkDates: React.Dispatch<React.SetStateAction<{ start: string; end: string }[]>>;
  bulkTimes: { start: string; end: string }[];
  setBulkTimes: React.Dispatch<React.SetStateAction<{ start: string; end: string }[]>>;
  bulkRoomIds: string[];
  setBulkRoomIds: React.Dispatch<React.SetStateAction<string[]>>;

  // Computed
  availableDurationOptions: number[];
  availableExtensionOptions: number[];
  resetForm: () => void;
}

export function useBookingForm(
  open: boolean, 
  prefill: any, 
  defaultStaffName: string,
  rooms: any[]
) {
    const [loading, setLoading] = useState(false);
    const [roomId, setRoomId] = useState<string>("");
    const [startDate, setStartDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
    const [startClock, setStartClock] = useState<string>(() => format(new Date(), "HH:mm"));
    const [duration, setDuration] = useState<string>("30");
    const [staffName, setStaffName] = useState<string>(defaultStaffName);
    const [studentNumbers, setStudentNumbers] = useState<string>("");

    const [selectedCourseId, setSelectedCourseId] = useState<string>("");
    const [otherCourseName, setOtherCourseName] = useState<string>("");
    const [selectedExtension, setSelectedExtension] = useState<string>("");
    const [selectedState, setSelectedState] = useState<"Active" | "Reserved" | "Ended">("Active");

    const [selectedBorrowed, setSelectedBorrowed] = useState<Record<string, boolean>>({});
    const [borrowableItems, setBorrowableItems] = useState<string[]>([]);
    const [dayBookings, setDayBookings] = useState<any[]>([]);
    const [errors, setErrors] = useState<Record<string, boolean>>({});

    const [isBulkBooking, setIsBulkBooking] = useState(false);
    const [bulkDates, setBulkDates] = useState<{ start: string; end: string }[]>([{ start: "", end: "" }]);
    const [bulkTimes, setBulkTimes] = useState<{ start: string; end: string }[]>([{ start: "", end: "" }]);
    const [bulkRoomIds, setBulkRoomIds] = useState<string[]>([]);

    const resetForm = () => {
        setRoomId("");
        setStartDate(format(new Date(), "yyyy-MM-dd"));
        setStartClock(format(new Date(), "HH:mm"));
        setDuration("30");
        setStaffName(defaultStaffName);
        setStudentNumbers("");
        setSelectedCourseId("");
        setOtherCourseName("");
        setSelectedBorrowed({});
        setBorrowableItems([]);
        setSelectedState("Active");
        setIsBulkBooking(false);
        setBulkDates([{ start: "", end: "" }]);
        setBulkTimes([{ start: "", end: "" }]);
        setBulkRoomIds([]);
        setErrors({});
    };

    // Load Prefill Data
    useEffect(() => {
        if (!open) return;
        
        const init = async () => {
            setLoading(true);
            try {
                // Default Time
                if (!prefill?.timeSlot && !prefill?.booking) {
                    try {
                        const t = await timeLib.getTime();
                        setStartDate(format(t, "yyyy-MM-dd"));
                        setStartClock(format(t, "HH:mm"));
                    } catch (e) {}
                }

                // Prefill Logic mirroring original component...
                if (prefill?.roomId) {
                  setRoomId(prefill.roomId);
                }

                if (prefill?.timeSlot) {
                    const dt = new Date(prefill.timeSlot);
                    setStartDate(format(dt, "yyyy-MM-dd"));
                    setStartClock(format(dt, "HH:mm"));
                }

                if (prefill?.booking) {
                    const b = prefill.booking;
                    setRoomId(String(b.room_id));
                    setStartDate(b.booking_day);
                    setStartClock(b.start_time.slice(0,5));
                    try {
                        const s = parseISO(`${b.booking_day}T${b.start_time}`);
                        const e = parseISO(`${b.booking_day}T${b.end_time}`);
                        const mins = Math.round((e.getTime() - s.getTime())/60000);
                        setDuration(String(mins));
                    } catch (e) {}
                    setStaffName(b.booked_by || "");
                    setStudentNumbers(b.student_numbers || "");
                    if (b.course_id) setSelectedCourseId(String(b.course_id));
                    else if (b.course_name) {
                        setSelectedCourseId("other");
                        setOtherCourseName(b.course_name);
                    }
                    
                    const sel: Record<string, boolean> = {};
                    (b.borrowed_items || []).forEach((it: string) => (sel[it] = true));
                    setSelectedBorrowed(sel);
                    setSelectedState((b.state as any) ?? "Active");
                }
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [open, prefill, defaultStaffName]);

    // Update Borrowable Items when room changes
    useEffect(() => {
        const r = rooms.find((x) => String(x.id) === String(roomId));
        const items = r?.borrowable_items || [];
        setBorrowableItems(items);
        
        // Preserve selection if possible
        setSelectedBorrowed((prev) => {
             if (prefill?.booking && String(prefill.booking.room_id) === String(roomId)) {
                 // If editing same booking room, keep original items + current edits logic is complex
                 // Simpler: Just rely on user re-checking if they switch rooms entirely
             }
             return prev; 
        });
        
        // If switching rooms, and not the prefill room, we might want to clear or keep valid items.
        // For now, simpler to just keep valid ones.
        setSelectedBorrowed(prev => {
            const out: Record<string, boolean> = { ...prev };
            Object.keys(out).forEach(k => { if (!items.includes(k)) delete out[k]; });
            return out;
         });

    }, [roomId, rooms, prefill]);

    const toggleBorrowed = (item: string) => {
        setSelectedBorrowed((s) => ({ ...s, [item]: !s[item] }));
    };

    // Calculate Availabilities (Logic Extracted)
    const availableDurationOptions = useMemo(() => {
        if (!startClock) return [30];
        const parseTime = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        };
        const startMins = parseTime(startClock);
        let limitMins = 24 * 60;
        
        for (const b of dayBookings) {
          if (String(b.room_id) !== String(roomId)) continue;
          if (prefill?.booking && String(b.id) === String(prefill.booking.id)) continue;
          const bStart = parseTime(b.start_time);
          const bEnd = parseTime(b.end_time);
          if (bStart > startMins) {
            if (bStart < limitMins) limitMins = bStart;
          } else if (bStart <= startMins && bEnd > startMins) {
             limitMins = startMins; 
          }
        }
        
        const maxDuration = limitMins - startMins;
        const options: number[] = [];
        for (let d = 30; d <= maxDuration && d <= 120; d += 30) options.push(d);
        
        // Ensure current duration is in list if possible
        const currentDur = parseInt(duration, 10);
        if (!isNaN(currentDur) && currentDur > 0 && !options.includes(currentDur)) {
            if (currentDur <= maxDuration || (prefill?.booking && currentDur <= 120)) { // allow edit overrides
                 options.push(currentDur);
                 options.sort((a, b) => a - b);
            }
        }
        return options;
    }, [startClock, dayBookings, duration, roomId, prefill]);

    const availableExtensionOptions = useMemo(() => {
        if (!prefill?.booking) return [];
        const parseTime = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        };
        const startMins = parseTime(startClock);
        const currentDuration = parseInt(duration, 10);
        if (isNaN(currentDuration)) return [];
        const endMins = startMins + currentDuration;
        let limitMins = 24 * 60;
        for (const b of dayBookings) {
          if (String(b.room_id) !== String(roomId)) continue;
          if (prefill?.booking && String(b.id) === String(prefill.booking.id)) continue;
          const bStart = parseTime(b.start_time);
          if (bStart >= endMins && bStart < limitMins) limitMins = bStart;
        }
        const maxExtension = limitMins - endMins;
        const options: number[] = [];
        for (let d = 30; d <= maxExtension && d <= 120; d += 30) options.push(d);
        return options;
    }, [startClock, duration, dayBookings, prefill, roomId]);

    return {
        roomId, setRoomId,
        startDate, setStartDate,
        startClock, setStartClock,
        duration, setDuration,
        staffName, setStaffName,
        studentNumbers, setStudentNumbers,
        selectedCourseId, setSelectedCourseId,
        otherCourseName, setOtherCourseName,
        selectedExtension, setSelectedExtension,
        selectedState, setSelectedState,
        selectedBorrowed, setSelectedBorrowed, toggleBorrowed,
        borrowableItems, setBorrowableItems,
        errors, setErrors,
        loading, setLoading,
        dayBookings, setDayBookings,
        isBulkBooking, setIsBulkBooking,
        bulkDates, setBulkDates,
        bulkTimes, setBulkTimes,
        bulkRoomIds, setBulkRoomIds,
        availableDurationOptions, availableExtensionOptions,
        resetForm
    };
}
