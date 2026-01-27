import React, { useEffect, useState, useMemo } from "react";
import { 
    Dialog, DialogContent, DialogTitle, DialogActions, 
    Button, TextField, Select, MenuItem, InputLabel, FormControl, 
    FormControlLabel, Checkbox, Switch, Box, Typography, 
    CircularProgress, IconButton, Grid,
    FormHelperText
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { supabase } from "../../../lib/supabaseClient";
import { format, parseISO, addMinutes, eachDayOfInterval, isBefore, differenceInMinutes } from "date-fns";
import timeLib from "../../../lib/time";
import { useConfirm } from "../context/ConfirmDialogContext";
import { useNow } from "../context/NowContext";

interface BookingPanelProps {
  open: boolean;
  onClose: () => void;
  prefill?: { roomId?: string; timeSlot?: string; booking?: any } | null;
  defaultStaffName?: string;
  showToast?: (title: string, description: string, severity?: "success" | "error" | "info") => void;
  onBookingUpdate?: () => void;
  rooms: any[];
  courses: any[];
}

export const BookingPanel: React.FC<BookingPanelProps> = ({ open, onClose, prefill = null, defaultStaffName = "", showToast = () => {}, onBookingUpdate, rooms, courses }) => {
  const { confirm } = useConfirm();
  const { currentTime } = useNow();

  const [loading, setLoading] = useState(false);

  // --- Smart Initializers ---
  const [roomId, setRoomId] = useState<string>(() => {
    if (prefill?.booking) return String(prefill.booking.room_id)
    return prefill?.roomId ?? ""
  });

  const [startDate, setStartDate] = useState<string>(() => {
    if (prefill?.booking) return prefill.booking.booking_day
    if (prefill?.timeSlot) {
        try { return format(new Date(prefill.timeSlot), "yyyy-MM-dd") } catch (e) {}
    }
    return format(new Date(), "yyyy-MM-dd")
  });

  const [startClock, setStartClock] = useState<string>(() => {
    if (prefill?.booking) return prefill.booking.start_time.slice(0, 5)
    if (prefill?.timeSlot) {
        try { return format(new Date(prefill.timeSlot), "HH:mm") } catch (e) {}
    }
    const now = new Date()
    now.setMinutes(Math.round(now.getMinutes() / 30) * 30)
    return format(now, "HH:mm")
  });

  const [duration, setDuration] = useState<string>(() => {
      if (prefill?.booking) {
          try {
            const s = parseISO(`${prefill.booking.booking_day}T${prefill.booking.start_time}`)
            const e = parseISO(`${prefill.booking.booking_day}T${prefill.booking.end_time}`)
            const mins = Math.round((e.getTime() - s.getTime())/60000)
            return String(mins)
          } catch(e) {}
      }
      return "30"
  });

  const [staffName, setStaffName] = useState<string>(() => {
      return prefill?.booking?.booked_by || defaultStaffName || ""
  });

  const [studentNumbers, setStudentNumbers] = useState<string>(() => prefill?.booking?.student_numbers || "");

  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
      if (prefill?.booking?.course_id) return String(prefill.booking.course_id)
      if (prefill?.booking?.course_name) return "other"
      return ""
  });

  const [otherCourseName, setOtherCourseName] = useState<string>(() => {
      if (prefill?.booking?.course_name && !prefill?.booking?.course_id) return prefill.booking.course_name
      return ""
  });

  const [selectedExtension, setSelectedExtension] = useState<string>("");
  const [selectedState, setSelectedState] = useState<"Active" | "Reserved" | "Ended">(() => (prefill?.booking?.state as any) ?? "Active");

  const [borrowableItems, setBorrowableItems] = useState<string[]>(() => {
      const targetId = prefill?.booking ? String(prefill.booking.room_id) : (prefill?.roomId ?? "")
      const r = rooms.find((x: any) => String(x.id) === targetId)
      return r?.borrowable_items || []
  });

  const [selectedBorrowed, setSelectedBorrowed] = useState<Record<string, boolean>>(() => {
    const sel: Record<string, boolean> = {};
    // If editing, load from booking
    if (prefill?.booking?.borrowed_items) {
        (prefill.booking.borrowed_items || []).forEach((it: string) => (sel[it] = true));
        return sel;
    }
    // If new, init with false for current room items
    const targetId = prefill?.roomId ?? "";
    const r = rooms.find((x: any) => String(x.id) === targetId);
    (r?.borrowable_items || []).forEach((it: string) => (sel[it] = false));
    return sel;
  });

  const [dayBookings, setDayBookings] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Bulk booking state
  const [isBulkBooking, setIsBulkBooking] = useState(false);
  const [bulkDates, setBulkDates] = useState<{ start: string; end: string }[]>([{ start: "", end: "" }]);
  const [bulkTimes, setBulkTimes] = useState<{ start: string; end: string }[]>([{ start: "", end: "" }]);
  const [bulkRoomIds, setBulkRoomIds] = useState<string[]>([]);

  // Smart Select State
  const [isSmartSelecting, setIsSmartSelecting] = useState(false);
  const [rankedRooms, setRankedRooms] = useState<any[]>([]);
  const [currentRankIndex, setCurrentRankIndex] = useState(0);

  // Background fetch for validation data (no loading spinner)
  useEffect(() => {
    if (!open) return;
    const loadBackground = async () => {
        try {
            // Need dayBookings for validation logic
            const dateStr = startDate; 
            if (!dateStr) return;

            // Simple fetch, don't clear form
            const { data: bookingsData } = await supabase
                .from('bookings')
                .select('id, room_id, start_time, end_time, state, booking_day')
                .eq('booking_day', dateStr);
            if (bookingsData) {
                setDayBookings(bookingsData);
            }
        } catch(e) {
            console.error("Background fetch failed", e);
        }
    };
    loadBackground();
  }, [open, startDate]); // Re-fetch if date changes

  // Remove the old 'load' effect that repopulates everything
  // effectively replaced by initializers above.

  useEffect(() => {
    if (!startDate || !open) return;
    const fetchBookings = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, room_id, start_time, end_time, state, booking_day')
        .eq('booking_day', startDate);
      if (!error && data) setDayBookings(data);
    };
    fetchBookings();
  }, [startDate, open]);

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
    const currentDur = parseInt(duration, 10);
    if (!isNaN(currentDur) && currentDur > 0 && !options.includes(currentDur)) {
        if (currentDur <= maxDuration || (prefill?.booking && currentDur <= 120)) {
             options.push(currentDur);
             options.sort((a, b) => a - b);
        }
    }
    return options;
  }, [startClock, dayBookings, prefill?.booking, duration, roomId]);

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
  }, [startClock, duration, dayBookings, prefill?.booking, roomId]);

  useEffect(() => {
    const currentDur = parseInt(duration);
    if (availableDurationOptions.length > 0) {
        if (!duration || Number.isNaN(currentDur)) {
             setDuration(String(availableDurationOptions[0]));
             return;
        }
        const max = availableDurationOptions[availableDurationOptions.length - 1];
        if (currentDur > max) setDuration(String(max));
    } else {
        if (duration !== "") setDuration("");
    }
  }, [availableDurationOptions, duration]);

  useEffect(() => {
    const r = rooms.find((x) => String(x.id) === String(roomId));
    const items = r?.borrowable_items || [];
    setBorrowableItems(items);
    if (prefill?.booking && String(prefill.booking.room_id) === String(roomId)) {
      setSelectedBorrowed((prev) => {
        const out: Record<string, boolean> = { ...(prev || {}) };
        items.forEach((it: string) => { if (!(it in out)) out[it] = false; });
        Object.keys(out).forEach((k) => { if (!items.includes(k)) delete out[k]; });
        return out;
      });
      return;
    }
    const sel: Record<string, boolean> = {};
    items.forEach((it: string) => (sel[it] = false));
    setSelectedBorrowed(sel);
  }, [roomId, rooms, prefill?.booking]);

  const toggleBorrowed = (item: string) => {
    setSelectedBorrowed((s) => ({ ...s, [item]: !s[item] }));
  };

  const getOptimalRooms = (groupSize: number, allRooms: any[], bookings: any[], now: Date) => {
      // 1. Filter by Capacity
      const validRooms = allRooms.filter(r => (r.capacity || 0) >= groupSize);
      
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const endOfDayMins = 24 * 60;

      const roomMetrics = validRooms.map(room => {
          // Calculate Metrics
          const rId = String(room.id);
          const roomBookings = bookings.filter((b: any) => String(b.room_id) === rId);
          
          // Find current and relevant bookings
          let currentBooking: any = null;
          let lastActiveBooking: any = null; // For overdue check
          let nextBookingStart = endOfDayMins;

          roomBookings.forEach((b: any) => {
              const start = parseISO(`${b.booking_day}T${b.start_time}`);
              const end = parseISO(`${b.booking_day}T${b.end_time}`);
              const startMins = start.getHours() * 60 + start.getMinutes();
              
              // Check if current
              if (now >= start && now < end) {
                  if (b.state === 'Active' || b.state === 'Reserved') {
                      currentBooking = b;
                  }
              }
              
              // Check for overdue (Active and ended in the past)
              if (b.state === 'Active' && now > end) {
                  // We want the most recent overdue one if multiple?
                  if (!lastActiveBooking || parseISO(`${lastActiveBooking.booking_day}T${lastActiveBooking.end_time}`) < parseISO(`${b.booking_day}T${b.end_time}`)) {
                      lastActiveBooking = b;
                  }
              }

              // Find next booking start
              if (start > now) {
                  if (startMins < nextBookingStart) {
                      nextBookingStart = startMins;
                  }
              }
          });

          let category = 3; // Default Worst
          let subCategoryTier2 = 0; // 1 for Reserved Late, 2 for Overdue
          let lateArrivalMinutes = 0;
          let overdueMinutes = 0;
          let minutesAvailable = 0;

          // Calculate Late Arrival
          if (currentBooking && currentBooking.state === 'Reserved') {
              const start = parseISO(`${currentBooking.booking_day}T${currentBooking.start_time}`);
              lateArrivalMinutes = differenceInMinutes(now, start);
          }

          // Calculate Overdue
          if (lastActiveBooking) {
              const end = parseISO(`${lastActiveBooking.booking_day}T${lastActiveBooking.end_time}`);
              overdueMinutes = differenceInMinutes(now, end);
          }

          // Determine Category
          if (currentBooking) {
              if (currentBooking.state === 'Active') {
                  category = 3;
              } else if (currentBooking.state === 'Reserved') {
                  if (lateArrivalMinutes >= 30) {
                      category = 1;
                  } else if (lateArrivalMinutes > 10) { // 10 < late < 30
                      category = 2;
                      subCategoryTier2 = 1; // Reserved Late
                  } else { // <= 10
                      category = 3;
                  }
              }
          } else {
              // No current booking
              if (lastActiveBooking) {
                  category = 2;
                  subCategoryTier2 = 2; // Overdue
              } else {
                  category = 1;
              }
          }

          // Calculate Minutes Available
          minutesAvailable = nextBookingStart - nowMins;
          if (minutesAvailable < 0) minutesAvailable = 0;

          // Maintenance
          const hasIssues = room.dynamic_labels && room.dynamic_labels.length > 0;
          const isOpen = room.is_open === true;

          return {
              room,
              category,
              subCategoryTier2,
              hasIssues,
              overdueMinutes,
              lateArrivalMinutes,
              minutesAvailable,
              name: room.name,
              isOpen
          };
      });

      // Sort
      roomMetrics.sort((a, b) => {
          // 1. Category ASC (1 best)
          if (a.category !== b.category) return a.category - b.category;

          // Tier 1 Sorting
          if (a.category === 1) {
              // 1. Preference
              // If GroupSize >= 4: Closed (!isOpen) first.
              // If GroupSize < 4: Open (isOpen) first.
              const preferClosed = groupSize >= 4;
              const aIsPreferred = preferClosed ? !a.isOpen : a.isOpen;
              const bIsPreferred = preferClosed ? !b.isOpen : b.isOpen;
              
              if (aIsPreferred !== bIsPreferred) return (bIsPreferred ? 1 : 0) - (aIsPreferred ? 1 : 0);

              // 2. Time Available (Descending)
              if (a.minutesAvailable !== b.minutesAvailable) return b.minutesAvailable - a.minutesAvailable;

              // 3. Maintenance (No issues first)
              if (a.hasIssues !== b.hasIssues) return (a.hasIssues ? 1 : 0) - (b.hasIssues ? 1 : 0);

              // 4. Alpha
              return a.name.localeCompare(b.name);
          }

          // Tier 2 Sorting
          if (a.category === 2) {
              // Sub-category: Reserved Late (1) vs Overdue (2). Reserved Late first.
              if (a.subCategoryTier2 !== b.subCategoryTier2) return a.subCategoryTier2 - b.subCategoryTier2;

              if (a.subCategoryTier2 === 1) {
                  // Reserved Late: Most late first
                  if (a.lateArrivalMinutes !== b.lateArrivalMinutes) return b.lateArrivalMinutes - a.lateArrivalMinutes;
              } else {
                  // Overdue: Most overdue first
                  if (a.overdueMinutes !== b.overdueMinutes) return b.overdueMinutes - a.overdueMinutes;
              }
              
              // Alpha tie-breaker
              return a.name.localeCompare(b.name);
          }

          // Tier 3 Sorting
          if (a.category === 3) {
              return a.name.localeCompare(b.name);
          }
          
          return 0;
      });

      return roomMetrics.filter(m => m.category !== 3).map(m => m.room);
  };

  const handleSmartSelect = async () => {
    const sizeStr = window.prompt("Enter Group Size:");
    if (!sizeStr) return;
    const size = parseInt(sizeStr, 10);
    if (isNaN(size)) {
        showToast("Invalid size", "Please enter a number", "error");
        return;
    }

    // Use currently selected date/time
    let targetDate = new Date();
    try {
        targetDate = parseISO(`${startDate}T${startClock}`);
    } catch (e) {
        console.error("Invalid date/time", e);
    }

    // Fetch bookings for the selected date
    const { data: bookings } = await supabase
        .from('bookings')
        .select('id, room_id, start_time, end_time, state, booking_day')
        .eq('booking_day', startDate);
        
    if (!bookings) {
        return;
    }
    setDayBookings(bookings);

    // Run Algorithm
    const ranked = getOptimalRooms(size, rooms, bookings, targetDate);
    
    if (ranked.length === 0) {
        showToast("No rooms found", "No rooms match the criteria.", "info");
        return;
    }

    setRankedRooms(ranked);
    setCurrentRankIndex(0);
    setRoomId(String(ranked[0].id));
    setIsSmartSelecting(true);
  };

  const selectNextRankedRoom = () => {
      if (rankedRooms.length === 0) return;
      const nextIndex = (currentRankIndex + 1) % rankedRooms.length;
      setCurrentRankIndex(nextIndex);
      setRoomId(String(rankedRooms[nextIndex].id));
  };

  const mapDatabaseError = (error: any): string => {
    if (!error) return "An unexpected error occurred";
    if (error.code === "23P01") return "This time slot is already booked.";
    if (error.code === "23514") return "Invalid booking time.";
    if (error.code === "23503") return "Invalid room or course.";
    return error.message || "Unable to complete the operation.";
  };

  const handleSave = async (state: "Active" | "Reserved" | "Ended") => {
    if (isBulkBooking) {
      await handleBulkSave(state);
      return;
    }
    const newErrors: Record<string, boolean> = {};
    if (!roomId) newErrors.roomId = true;
    if (!startDate) newErrors.startDate = true;
    if (!startClock) newErrors.startClock = true;
    if (!duration) newErrors.duration = true;
    if (!staffName?.trim()) newErrors.staffName = true;
    if (!selectedCourseId) newErrors.selectedCourseId = true;
    if (selectedCourseId === "other" && !otherCourseName?.trim()) newErrors.otherCourseName = true;

    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        showToast("Missing fields", "Please fill in all required fields.", "error");
        return;
    }

    const startParts = startClock.split(":").map((s) => parseInt(s, 10));
    const startMins = (startParts[1] ?? 0);
    const dur = parseInt(duration, 10);
    if (Number.isNaN(startMins) || (startMins % 30) !== 0) {
      showToast("Invalid start time", "Start time must be on a 30-minute boundary", "error");
      return;
    }
    if (Number.isNaN(dur) || dur <= 0 || (dur % 30) !== 0) {
      showToast("Invalid duration", "Duration must be valid", "error");
      return;
    }

    const borrowed = Object.keys(selectedBorrowed).filter((k) => selectedBorrowed[k]);

    if (state === "Ended" && borrowed.length > 0) {
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

    setLoading(true);
    try {
      const start = parseISO(`${startDate}T${startClock}`);
      const extensionMins = selectedExtension ? parseInt(selectedExtension, 10) : 0;
      let end = addMinutes(start, parseInt(duration, 10) + extensionMins);

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
                   resetFormToDefaults();
                   onBookingUpdate?.();
                   onClose();
                   setLoading(false);
                   return;
              } else {
                  end = now;
              }
          }
      }

      const booking_day = startDate;
      const start_time = format(start, "HH:mm:ss");
      const end_time = format(end, "HH:mm:ss");

      const payload: any = {
        room_id: parseInt(roomId, 10),
        start_time,
        end_time,
        booking_day,
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
        const { error } = await supabase.from("bookings").update(payload).eq("id", prefill.booking.id);
        if (error) throw error;
        showToast("Updated", "Booking updated", "success");
      } else {
        const { error } = await supabase.from("bookings").insert(payload);
        if (error) throw error;
        showToast("Saved", "Booking created", "success");
      }
      resetFormToDefaults();
      onBookingUpdate?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast("Save failed", mapDatabaseError(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const addBulkDate = () => setBulkDates([...bulkDates, { start: "", end: "" }]);
  const removeBulkDate = (i: number) => setBulkDates(bulkDates.filter((_, idx) => idx !== i));
  const updateBulkDate = (i: number, field: "start" | "end", val: string) => {
    const newDates = [...bulkDates];
    newDates[i][field] = val;
    setBulkDates(newDates);
  };

  const addBulkTime = () => setBulkTimes([...bulkTimes, { start: "", end: "" }]);
  const removeBulkTime = (i: number) => setBulkTimes(bulkTimes.filter((_, idx) => idx !== i));
  const updateBulkTime = (i: number, field: "start" | "end", val: string) => {
    const newTimes = [...bulkTimes];
    newTimes[i][field] = val;
    setBulkTimes(newTimes);
  };

  const toggleBulkRoom = (rId: string) => {
    setBulkRoomIds(prev => prev.includes(rId) ? prev.filter(id => id !== rId) : [...prev, rId]);
  };

  const handleBulkSave = async (state: "Active" | "Reserved" | "Ended") => {
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
        setErrors(newErrors);
        showToast("Missing fields", "Please fill in fields", "error");
        return;
    }

    setLoading(true);
    try {
        const bookingsToInsert: any[] = [];
        for (const dateRange of validDates) {
            const startD = parseISO(dateRange.start);
            const endD = parseISO(dateRange.end);
            if (isBefore(endD, startD)) {
                 showToast("Invalid date range", "End before start", "error");
                 setLoading(false);
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
                            student_numbers: null,
                            borrowed_items: [],
                            booked_by: staffName,
                            state: state,
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
                        bookingsToInsert.push(payload);
                    }
                }
            }
        }
        if (bookingsToInsert.length === 0) {
             showToast("No bookings", "Check ranges", "info");
             return;
        }
        const { error } = await supabase.from("bookings").insert(bookingsToInsert);
        if (error) throw error;
        showToast("Saved", `${bookingsToInsert.length} bookings created`, "success");
        resetFormToDefaults();
        onBookingUpdate?.();
        onClose();
    } catch (err: any) {
        console.error(err);
        showToast("Save failed", mapDatabaseError(err), "error");
    } finally {
        setLoading(false);
    }
  };

  const resetFormToDefaults = () => {
    setRoomId("");
    setStartDate(() => format(new Date(), "yyyy-MM-dd"));
    const nowInit = new Date();
    nowInit.setMinutes(Math.round(nowInit.getMinutes() / 30) * 30);
    setStartClock(format(nowInit, "HH:mm"));
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
    setIsSmartSelecting(false);
    setRankedRooms([]);
    setCurrentRankIndex(0);
    setErrors({});
  };

  const handleDelete = async () => {
    if (!prefill?.booking?.id) return;
    const ok = await confirm({
      title: "Delete Booking",
      description: "Delete this booking?",
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!ok) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', prefill.booking.id);
      if (error) throw error;
      showToast("Deleted", "Booking deleted", "info");
      onBookingUpdate?.();
      onClose();
    } catch (err: any) {
      showToast("Delete failed", err?.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const getRoomStatus = (rId: string) => {
    if (!startClock || !startDate) return null;
    const isToday = format(currentTime, "yyyy-MM-dd") === startDate;
    const [h, m] = startClock.split(':').map(Number);
    const selectedTimeMins = h * 60 + m;
    const overlappingBooking = dayBookings.find(b => {
        if (String(b.room_id) !== String(rId)) return false;
        if (prefill?.booking && String(b.id) === String(prefill.booking.id)) return false;
        const [sh, sm] = b.start_time.split(':').map(Number);
        const [eh, em] = b.end_time.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        return startMins <= selectedTimeMins && endMins > selectedTimeMins;
    });
    if (overlappingBooking) {
        if (overlappingBooking.state === 'Active') return { color: 'error.main', text: 'Occupied' };
        if (isToday && overlappingBooking.state === 'Reserved') {
             const startDateObj = new Date(`${overlappingBooking.booking_day}T${overlappingBooking.start_time}`);
             const lateThreshold = new Date(startDateObj.getTime() + 10 * 60000);
             if (currentTime > lateThreshold) {
                 const diff = Math.floor((currentTime.getTime() - startDateObj.getTime()) / 60000);
                 return { color: 'warning.main', text: `${diff} min late` };
             }
             return { color: 'warning.light', text: 'Reserved' };
        }
        if (overlappingBooking.state === 'Reserved') return { color: 'warning.light', text: 'Reserved' };
    }
    if (isToday) {
        const overdueBooking = dayBookings.find(b => {
            if (String(b.room_id) !== String(rId)) return false;
            if (b.state !== 'Active') return false;
            const endDate = new Date(`${b.booking_day}T${b.end_time}`);
            return currentTime > endDate;
        });
        if (overdueBooking) {
             const endDate = new Date(`${overdueBooking.booking_day}T${overdueBooking.end_time}`);
             const diff = Math.floor((currentTime.getTime() - endDate.getTime()) / 60000);
             return { color: 'error.main', text: `Overdue ${diff} min` };
        }
    }
    return null;
  };

  const shouldHighlightReserve = useMemo(() => {
    if (!startDate || !startClock) return false;
    try {
        const selectedTime = parseISO(`${startDate}T${startClock}`);
        const roundedCurrent = new Date(currentTime);
        roundedCurrent.setMinutes(Math.round(roundedCurrent.getMinutes() / 30) * 30);
        roundedCurrent.setSeconds(0);
        return roundedCurrent < selectedTime;
    } catch (e) { return false; }
  }, [currentTime, startDate, startClock]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
                {prefill?.booking ? "Edit Booking" : "New Booking"}
                {studentNumbers && ` - ${studentNumbers.split('\n').filter(l => l.trim()).length} students`}
            </Box>
            {!prefill?.booking && (
                <FormControlLabel control={<Switch checked={isBulkBooking} onChange={(e) => setIsBulkBooking(e.target.checked)} />} label="Bulk Mode" />
            )}
        </DialogTitle>
        <DialogContent dividers>
            {loading ? (
                <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
            ) : (
                <Grid container spacing={2}>
                    {isBulkBooking ? (
                        <>
                            <Grid item xs={12}>
                                <Typography variant="subtitle2">Date Ranges</Typography>
                                {bulkDates.map((d, i) => (
                                    <Box key={i} display="flex" gap={1} mb={1} alignItems="center">
                                        <TextField type="date" size="small" value={d.start} onChange={e => updateBulkDate(i, 'start', e.target.value)} error={!!errors.bulkDates && !d.start} />
                                        <Typography>to</Typography>
                                        <TextField type="date" size="small" value={d.end} onChange={e => updateBulkDate(i, 'end', e.target.value)} error={!!errors.bulkDates && !d.end} />
                                        <IconButton onClick={() => removeBulkDate(i)}><CloseIcon /></IconButton>
                                    </Box>
                                ))}
                                <Button size="small" onClick={addBulkDate}>Add Date</Button>
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="subtitle2">Time Ranges (HH:mm)</Typography>
                                {bulkTimes.map((t, i) => (
                                    <Box key={i} display="flex" gap={1} mb={1} alignItems="center">
                                        <TextField type="time" size="small" value={t.start} onChange={e => updateBulkTime(i, 'start', e.target.value)} error={!!errors.bulkTimes && !t.start} />
                                        <Typography>to</Typography>
                                        <TextField type="time" size="small" value={t.end} onChange={e => updateBulkTime(i, 'end', e.target.value)} error={!!errors.bulkTimes && !t.end} />
                                        <IconButton onClick={() => removeBulkTime(i)}><CloseIcon /></IconButton>
                                    </Box>
                                ))}
                                <Button size="small" onClick={addBulkTime}>Add Time</Button>
                            </Grid>
                             <Grid item xs={12}>
                                <Typography variant="subtitle2">Rooms</Typography>
                                <Box sx={{ border: 1, borderColor: 'divider', p: 1, maxHeight: 150, overflow: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                    {rooms.map(r => (
                                        <FormControlLabel key={r.id} control={<Checkbox checked={bulkRoomIds.includes(String(r.id))} onChange={() => toggleBulkRoom(String(r.id))} />} label={r.name} />
                                    ))}
                                </Box>
                                {errors.bulkRooms && <FormHelperText error>Select at least one room</FormHelperText>}
                            </Grid>
                        </>
                    ) : (
                        <>
                            <Grid item xs={12}>
                                <Box display="flex" gap={1} alignItems="flex-start">
                                    <TextField 
                                        select 
                                        fullWidth 
                                        label="Room" 
                                        value={roomId} 
                                        onChange={(e) => setRoomId(e.target.value)}
                                        error={!!errors.roomId}
                                    >
                                        {rooms.map(r => {
                                            const status = getRoomStatus(String(r.id));
                                            if (String(r.id) !== String(roomId) && (status?.text === 'Occupied' || (status?.text === 'Reserved' && !status.text.includes('late')))) return null;
                                            return (
                                                <MenuItem key={r.id} value={String(r.id)}>
                                                    <Box display="flex" justifyContent="space-between" width="100%">
                                                        <Typography color={status?.color || 'inherit'}>{r.name} {status?.text && `(${status.text})`}</Typography>
                                                    </Box>
                                                </MenuItem>
                                            );
                                        })}
                                    </TextField>
                                    {!prefill?.booking && (
                                        isSmartSelecting ? (
                                            <Button variant="outlined" onClick={selectNextRankedRoom} sx={{ height: 56, textTransform: 'none', lineHeight: 1.2, minWidth: 120, ml: 1 }}>
                                                Next ({currentRankIndex + 1}/{rankedRooms.length})
                                            </Button>
                                        ) : (
                                            <Button variant="outlined" onClick={handleSmartSelect} sx={{ height: 56, minWidth: 120, ml: 1 }}>
                                                Smart Select
                                            </Button>
                                        )
                                    )}
                                </Box>
                            </Grid>
                            <Grid item xs={6}>
                                <TextField type="date" fullWidth label="Date" value={startDate} onChange={e => setStartDate(e.target.value)} error={!!errors.startDate} InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField type="time" fullWidth label="Start Time" value={startClock} onChange={e => setStartClock(e.target.value)} error={!!errors.startClock} InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField select fullWidth label="Duration" value={duration} onChange={e => setDuration(e.target.value)} error={!!errors.duration}>
                                    {availableDurationOptions.map(d => <MenuItem key={d} value={String(d)}>{d} mins</MenuItem>)}
                                </TextField>
                            </Grid>
                             <Grid item xs={6}>
                                <TextField fullWidth label="Staff Name" value={staffName} onChange={e => setStaffName(e.target.value)} error={!!errors.staffName} />
                            </Grid>
                        </>
                    )}
                    
                    <Grid item xs={12}>
                        <FormControl fullWidth error={!!errors.selectedCourseId}>
                            <InputLabel>Course</InputLabel>
                            <Select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value as string)} label="Course">
                                {courses.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
                                <MenuItem value="other">Other</MenuItem>
                            </Select>
                        </FormControl>
                        {selectedCourseId === "other" && (
                            <TextField fullWidth sx={{ mt: 1 }} label="Course Name" value={otherCourseName} onChange={e => setOtherCourseName(e.target.value)} error={!!errors.otherCourseName} />
                        )}
                    </Grid>

                    {!isBulkBooking && (
                        <>
                             <Grid item xs={12}>
                                <TextField multiline rows={3} fullWidth label="Student Numbers" value={studentNumbers} onChange={e => setStudentNumbers(e.target.value)} />
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="subtitle2">Borrowed Items</Typography>
                                {borrowableItems.length === 0 ? <Typography variant="caption">None available</Typography> : (
                                    <Box>
                                        {borrowableItems.map(it => (
                                            <FormControlLabel key={it} control={<Checkbox checked={!!selectedBorrowed[it]} onChange={() => toggleBorrowed(it)} />} label={it} />
                                        ))}
                                    </Box>
                                )}
                            </Grid>
                        </>
                    )}
                </Grid>
            )}
        </DialogContent>
        <DialogActions>
             {prefill?.booking ? (
                 <>
                    <Box flexGrow={1} display="flex" gap={1}>
                        <TextField select size="small" label="Extend" value={selectedExtension} onChange={e => setSelectedExtension(e.target.value)} sx={{ width: 120 }}>
                            {availableExtensionOptions.map(m => <MenuItem key={m} value={String(m)}>+{m} mins</MenuItem>)}
                        </TextField>
                        <TextField select size="small" label="State" value={selectedState} onChange={e => setSelectedState(e.target.value as any)} sx={{ width: 120 }}>
                            <MenuItem value="Active">Active</MenuItem>
                            <MenuItem value="Reserved">Reserved</MenuItem>
                            <MenuItem value="Ended">Ended</MenuItem>
                        </TextField>
                    </Box>
                    <Button color="error" onClick={handleDelete} disabled={loading}>Delete</Button>
                    <Button variant="contained" onClick={() => handleSave(selectedState)} disabled={loading}>Update</Button>
                 </>
             ) : (
                 <>
                    <Button onClick={onClose} color="inherit">Cancel</Button>
                    <Button 
                        variant={shouldHighlightReserve ? "contained" : "outlined"} 
                        color={shouldHighlightReserve ? "primary" : "inherit"}
                        onClick={() => handleSave("Reserved")}
                        disabled={loading}
                    >
                        Reserve
                    </Button>
                     <Button 
                        variant={shouldHighlightReserve ? "outlined" : "contained"} 
                        color="primary"
                        onClick={() => handleSave("Active")}
                        disabled={loading}
                    >
                        Book (Active)
                    </Button>
                 </>
             )}
        </DialogActions>
    </Dialog>
  );
};
