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
import { DateInput } from "../../../components/DateInput";

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
  const [openingHours, setOpeningHours] = useState<{ start: string; end: string }>({ start: "06:00", end: "21:00" });

  // Background fetch for validation data (no loading spinner)
  useEffect(() => {
    if (!open) return;
    const loadBackground = async () => {
        try {
            // Fetch Settings
            const { data: hoursData } = await supabase.from("settings").select("value").eq("key", "operation_hours").maybeSingle();
            if (hoursData && hoursData.value) {
                const val = hoursData.value as any;
                const start = val.start ?? val.open ?? "06:00";
                const end = val.end ?? val.close ?? "21:00";
                setOpeningHours({ start, end });
            }

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
    
    const isLate = (b: any) => {
        if (b.state !== 'Reserved') return false;
        if (b.booking_day !== startDate) return false;
        try {
            const bStart = parseISO(`${b.booking_day}T${b.start_time}`);
            const limit = addMinutes(bStart, 10);
            return currentTime > limit;
        } catch (e) { return false; }
    };

    for (const b of dayBookings) {
      if (String(b.room_id) !== String(roomId)) continue;
      if (prefill?.booking && String(b.id) === String(prefill.booking.id)) continue;
      
      // Ignore late bookings for duration availability
      if (isLate(b)) continue;

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
    // If current duration is valid but blocked by non-late booking, it won't be in options.
    // However, if we are editing an existing booking, we might want to keep it.
    if (!isNaN(currentDur) && currentDur > 0 && !options.includes(currentDur)) {
        if (currentDur <= maxDuration || (prefill?.booking && currentDur <= 120)) {
             options.push(currentDur);
             options.sort((a, b) => a - b);
        }
    }
    return options;
  }, [startClock, dayBookings, prefill?.booking, duration, roomId, currentTime, startDate]);

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

  const getOptimalRooms = (groupSize: number, allRooms: any[], bookings: any[], targetDate: Date, currentTime: Date) => {
      // 1. Filter: groupSize <= max_people (Hard limit is max, min is recommendation)
      const validRooms = allRooms.filter(r => (r.max_people || 0) >= groupSize);
      
      const targetMins = targetDate.getHours() * 60 + targetDate.getMinutes();
      const endOfDayMins = 24 * 60;

      const roomMetrics = validRooms.map(room => {
          // Calculate Metrics
          const rId = String(room.id);
          const roomBookings = bookings.filter((b: any) => String(b.room_id) === rId);
          
          let nextBookingStart = endOfDayMins;
          let isOccupied = false;
          let maxOverdueMinutes = 0;
          let currentLateMinutes = 0;
          let isLateAvailable = false;

          roomBookings.forEach((b: any) => {
              const start = parseISO(`${b.booking_day}T${b.start_time}`);
              const end = parseISO(`${b.booking_day}T${b.end_time}`);
              const startMins = start.getHours() * 60 + start.getMinutes();
              
              // Check if currently occupied: Use TARGET DATE for checking slot availability
              if (targetDate >= start && targetDate < end) {
                  if (b.state === 'Active') {
                      isOccupied = true;
                  } else if (b.state === 'Reserved') {
                      // Check lateness: Use REAL CURRENT TIME for lateness calculation
                      const lateDiff = differenceInMinutes(currentTime, start);
                      if (lateDiff > 10) {
                          // It is late, so it qualifies for Late Availability
                          currentLateMinutes = lateDiff;
                          isLateAvailable = true;
                          // It is NOT considered "Occupied" for the filter
                      } else {
                          // Less than 10 mins late, still occupied
                          isOccupied = true;
                      }
                  }
              }

              // Check for overdue (Active and ended in the past): Use REAL CURRENT TIME for overdue check
              if (b.state === 'Active' && currentTime > end) {
                  const ovr = differenceInMinutes(currentTime, end);
                  if (ovr > maxOverdueMinutes) maxOverdueMinutes = ovr;
              }

              // Find next booking start: Use TARGET DATE for finding gaps
              if (start > targetDate) {
                  if (startMins < nextBookingStart) {
                      nextBookingStart = startMins;
                  }
              }
          });

          // Calculate Minutes Available
          // If occupied (and not late available), 0.
          // If late available, we technically have 0 "clean" minutes, but user wants specific sorting.
          // We will preserve minutesAvailable calculation based on next booking for display/logic,
          // but use isLateAvailable for sorting Tier.
          let minutesAvailable = isOccupied ? 0 : (nextBookingStart - targetMins);
          if (minutesAvailable < 0) minutesAvailable = 0;

          // Maintenance Issues
          const issuesCount = (room.dynamic_labels || []).length;
          const minRecommended = room.min_people || 0;

          // Score Calculation
          let score = 0;
          if (groupSize >= minRecommended) {
              score = minRecommended;
          } else {
              score = minRecommended * -1;
          }

          return {
              room,
              score,
              minutesAvailable,
              issuesCount,
              maxOverdueMinutes,
              currentLateMinutes,
              isLateAvailable,
              name: room.name,
              isOccupied
          };
      });
      
      console.log("----- Smart Select Debug -----");
      console.log("1. All Room Metrics (Initial):", JSON.parse(JSON.stringify(roomMetrics)));

      const filteredBySize = roomMetrics.filter(m => (m.room.max_people || 0) >= groupSize);
      console.log("2. Filtered by Size:", JSON.parse(JSON.stringify(filteredBySize)));
      // Note: My implementation filtered `validRooms` at the start of the function which is basically step 2.
      // But for logging purposes I'll clarify what happened.
      const droppedBySize = allRooms.filter(r => (r.max_people || 0) < groupSize).map(r => r.name);
      if (droppedBySize.length > 0) console.log("   Dropped by Size Limit:", droppedBySize);

      const availableRooms = roomMetrics.filter(m => !m.isOccupied);
      console.log("3. Filtered by Occupied (Available Candidates):", JSON.parse(JSON.stringify(availableRooms)));
      const droppedByOccupied = roomMetrics.filter(m => m.isOccupied).map(m => m.name);
      if (droppedByOccupied.length > 0) console.log("   Dropped by Occupied:", droppedByOccupied);


      // Sort
      availableRooms.sort((a, b) => {
          // 1. Score Descending
          if (a.score !== b.score) return b.score - a.score;

          // 2. Availability Tier: "Clean" (Empty) > "Late" (Occupied but late)
          // "Clean" means !isLateAvailable. "Late" means isLateAvailable.
          if (a.isLateAvailable !== b.isLateAvailable) {
              return a.isLateAvailable ? 1 : -1; // False (Clean) comes first
          }

          // 3. Within Tier
          if (!a.isLateAvailable) {
              // Both Clean: Time Available Descending
              if (a.minutesAvailable !== b.minutesAvailable) return b.minutesAvailable - a.minutesAvailable;
          } else {
              // Both Late: Minutes Late Descending (More late is better/preferred to be overwritten)
              if (a.currentLateMinutes !== b.currentLateMinutes) return b.currentLateMinutes - a.currentLateMinutes;
          }

          // 4. Overdue Priority (For clean rooms that might have previous overdue bookings?)
          // Preference: No Overdue (0) > High Overdue (>0) > Low Overdue (>0)
          const aOv = a.maxOverdueMinutes;
          const bOv = b.maxOverdueMinutes;
          
          if (aOv === 0 && bOv > 0) return -1; // a is empty (better)
          if (aOv > 0 && bOv === 0) return 1;  // b is empty (better)
          if (aOv > 0 && bOv > 0) {
             return bOv - aOv; // Both overdue, picking larger one first
          }

          // 5. Issues Count Ascending (Less is better)
          if (a.issuesCount !== b.issuesCount) return a.issuesCount - b.issuesCount;

          // 6. Alphabetical
          return a.name.localeCompare(b.name);
      });

      console.log("4. Final Sorted Ranking:", JSON.parse(JSON.stringify(availableRooms.map(m => ({ 
          name: m.name, 
          score: m.score, 
          clean: !m.isLateAvailable, 
          minsAvail: m.minutesAvailable, 
          lateMins: m.currentLateMinutes 
      })))));
      console.log("------------------------------");

      return availableRooms.map(m => m.room);
  };

  const handleSmartSelect = async () => {
    const sizeStr = window.prompt("Enter Group Size:");
    if (!sizeStr) return;
    const size = parseInt(sizeStr, 10);
    if (isNaN(size) || size <= 0) {
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
    const ranked = getOptimalRooms(size, rooms, bookings, targetDate, currentTime);
    
    if (ranked.length === 0) {
        showToast("No rooms found", "No rooms available for smart suggestion.", "info");
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

    // Opening/Closing Check
    const parseTime = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };
    const openMins = parseTime(openingHours.start);
    const closeMins = parseTime(openingHours.end);
    const bookingStartMins = parseTime(startClock);
    const bookingEndMins = bookingStartMins + dur;

    if (bookingStartMins < openMins || bookingEndMins > closeMins) {
        showToast("Invalid time", `Booking must be between ${openingHours.start} and ${openingHours.end}`, "error");
        return;
    }

    // Check for collision with existing bookings, handling 'late' overrides
    const bookingsToDelete: string[] = [];
    if (!isBulkBooking) {
        const isLate = (b: any) => {
            if (b.state !== 'Reserved') return false;
            // Assuming booking_day matches startDate
            try {
                const bStart = parseISO(`${startDate}T${b.start_time}`);
                const limit = addMinutes(bStart, 10);
                return currentTime > limit;
            } catch (e) { return false; }
        };

        const hasCollision = dayBookings.some(b => {
             if (String(b.room_id) !== String(roomId)) return false;
             if (prefill?.booking && String(b.id) === String(prefill.booking.id)) return false;
             
             const bStart = parseTime(b.start_time);
             const bEnd = parseTime(b.end_time);
             
             // Check Overlap
             // (StartA < EndB) and (EndA > StartB)
             const overlaps = (bookingStartMins < bEnd && bookingEndMins > bStart);
             
             if (overlaps) {
                 if (isLate(b)) {
                     if (!bookingsToDelete.includes(String(b.id))) {
                         bookingsToDelete.push(String(b.id));
                     }
                     return false; // Not a hard collision yet, conditionally valid
                 }
                 return true; // Hard collision
             }
             return false;
        });

        if (hasCollision) {
             showToast("Unavailable", "This time slot is already booked.", "error");
             return;
        }

        if (bookingsToDelete.length > 0) {
            const ok = await confirm({
                title: "Overwrite Late Booking?",
                description: "This room will delete the late booking. Do you wanna proceed?",
                confirmText: "Yes",
                cancelText: "No",
            });
            if (!ok) return;

             setLoading(true);
             const { error } = await supabase.from('bookings').delete().in('id', bookingsToDelete);
             if (error) {
                 console.error(error);
                 showToast("Error", "Failed to delete overlapping booking", "error");
                 setLoading(false);
                 return;
             }
             // Continue to save...
        }
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

      if (state === 'Active') {
         const startStr = format(start, "HH:mm:ss");
         const { error: autoEndError } = await supabase
            .from('bookings')
            .update({ state: 'Ended' })
            .eq('room_id', roomId)
            .eq('booking_day', startDate)
            .lt('start_time', startStr)
            .neq('state', 'Ended');
            
         if (autoEndError) console.error("Auto-end error:", autoEndError); 
      }

      const extensionMins = selectedExtension ? parseInt(selectedExtension, 10) : 0;
      
      const originalDuration = parseInt(duration, 10);
      let end = addMinutes(start, originalDuration);
      
      // Calculate the end time for the NEW booking if extended
      let extendedEnd = addMinutes(end, extensionMins);

      // Handle 'Ended' logic (truncating time if ending now)
      // Only applies if NOT extending
      if (state === 'Ended' && extensionMins === 0) {
          const now = await timeLib.getTime();
          const m = now.getMinutes();
          const roundedM = Math.round(m / 30) * 30;
          now.setMinutes(roundedM);
          now.setSeconds(0);
          now.setMilliseconds(0);
          
          // Truncate 'end'
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
      } else if (!prefill?.booking && extensionMins > 0) {
          // If for some reason we are creating new and extension is set (unlikely via UI but safe to handle)
          end = extendedEnd; 
      } else if (prefill?.booking && extensionMins === 0) {
          // Standard update, no extension
           // Use 'end' as calculated (possibly truncated by Ended logic above)
      }

      const booking_day = startDate;
      
      const basePayload: any = {
        room_id: parseInt(roomId, 10),
        booking_day,
        student_numbers: studentNumbers || null,
        borrowed_items: borrowed,
        booked_by: staffName,
      };

      if (selectedCourseId && selectedCourseId !== "other") {
        basePayload.course_id = parseInt(selectedCourseId, 10);
        basePayload.course_name = null;
      } else if (selectedCourseId === "other") {
        basePayload.course_id = null;
        basePayload.course_name = otherCourseName || null;
      } else {
        basePayload.course_id = null;
        basePayload.course_name = null;
      }

      if (prefill?.booking) {
        if (extensionMins > 0) {
             // SPLIT LOGIC
             // 1. Update Old Booking to Ended
             // Time: Start -> End (Original Duration)
             const oldPayload = {
                 ...basePayload,
                 start_time: format(start, "HH:mm:ss"),
                 end_time: format(end, "HH:mm:ss"),
                 state: 'Ended'
             };
             
             const { error: updateError } = await supabase.from("bookings").update(oldPayload).eq("id", prefill.booking.id);
             if (updateError) throw updateError;

             // 2. Create New Booking (Active)
             // Time: End -> ExtendedEnd
             const newPayload = {
                 ...basePayload,
                 start_time: format(end, "HH:mm:ss"),
                 end_time: format(extendedEnd, "HH:mm:ss"),
                 state: 'Active'
             };
             
             const { error: insertError } = await supabase.from("bookings").insert(newPayload);
             if (insertError) throw insertError;

             showToast("Extended", "Booking extended (new session created)", "success");
        } else {
            // Standard Update
            const payload = {
                ...basePayload,
                start_time: format(start, "HH:mm:ss"),
                end_time: format(end, "HH:mm:ss"),
                state,
            };
            const { error } = await supabase.from("bookings").update(payload).eq("id", prefill.booking.id);
            if (error) throw error;
            showToast("Updated", "Booking updated", "success");
        }
      } else {
        // Create New
        // Note: New creations via this form don't usually use extension logic, 
        // but if they did, `end` was irrelevant unless we update it.
        // We really want start -> end (start+duration) here.
        // If extensionMins was > 0 for new, we handled it with `end = extendedEnd` above? 
        // Wait, line "else if (!prefill?.booking && extensionMins > 0) { end = extendedEnd; }" covers it.
        // So `end` is correct.
        
        const payload = {
            ...basePayload,
            start_time: format(start, "HH:mm:ss"),
            end_time: format(end, "HH:mm:ss"),
            state,
        };
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

    // Validate Time Increments and Opening Hours
    const parseTime = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };
    const openMins = parseTime(openingHours.start);
    const closeMins = parseTime(openingHours.end);

    for (const t of validTimes) {
        const sMins = parseTime(t.start);
        const eMins = parseTime(t.end);
        if ((sMins % 30) !== 0 || (eMins % 30) !== 0) {
            showToast("Invalid increment", "Bulk times must be in 30-minute increments", "error");
            return;
        }
        if (sMins < openMins || eMins > closeMins) {
             showToast("Invalid time", `Bulk times must be between ${openingHours.start} and ${openingHours.end}`, "error");
             return;
        }
    }

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

    const formatLateOrOverdue = (minutes: number, type: 'late' | 'overdue') => {
        if (minutes < 60) {
            return type === 'late' ? `${minutes} minutes late` : `Overdue ${minutes} minutes`;
        }
        const hours = Math.floor(minutes / 60);
        const suffix = hours >= 1 ? `${hours} hr${hours > 1 ? 's' : ''}+` : '1 hr+';
        return type === 'late' ? `${suffix} late` : `Overdue ${suffix}`;
    };

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
                 return { color: 'warning.main', text: formatLateOrOverdue(diff, 'late') };
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
             return { color: 'error.main', text: formatLateOrOverdue(diff, 'overdue') };
        }
    }

    // Available duration logic
    let minNextStart = 24 * 60; 
    dayBookings.forEach(b => {
        if (String(b.room_id) !== String(rId)) return;
        if (prefill?.booking && String(b.id) === String(prefill.booking.id)) return;
        const [sh, sm] = b.start_time.split(':').map(Number);
        const startMins = sh * 60 + sm;
        if (startMins > selectedTimeMins && startMins < minNextStart) {
            minNextStart = startMins;
        }
    });

    if (minNextStart < 24 * 60) {
        const diff = minNextStart - selectedTimeMins;
        // Only show availability if it's 2 hours or less
        if (diff > 0 && diff <= 120) {
            let durationText = "";
            if (diff === 30) durationText = "30 min";
            else if (diff === 60) durationText = "1 hr";
            else if (diff === 90) durationText = "1.5 hr";
            else if (diff === 120) durationText = "2 hr";
            else {
                 const h = Math.floor(diff / 60);
                 const m = diff % 60;
                 if (h === 0) durationText = `${m} min`;
                 else if (m === 0) durationText = `${h} hr`;
                 else durationText = `${h} hr ${m} min`;
            }
            return { color: 'text.primary', text: `Available for ${durationText}` };
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
                                        <DateInput size="small" value={d.start} onChange={val => updateBulkDate(i, 'start', val)} error={!!errors.bulkDates && !d.start} />
                                        <Typography>to</Typography>
                                        <DateInput size="small" value={d.end} onChange={val => updateBulkDate(i, 'end', val)} error={!!errors.bulkDates && !d.end} />
                                        <IconButton onClick={() => removeBulkDate(i)}><CloseIcon /></IconButton>
                                    </Box>
                                ))}
                                <Button size="small" onClick={addBulkDate}>Add Date</Button>
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="subtitle2">Time Ranges (HH:mm)</Typography>
                                {bulkTimes.map((t, i) => (
                                    <Box key={i} display="flex" gap={1} mb={1} alignItems="center">
                                        <TextField type="time" size="small" value={t.start} onChange={e => updateBulkTime(i, 'start', e.target.value)} error={!!errors.bulkTimes && !t.start} inputProps={{ step: 1800 }} />
                                        <Typography>to</Typography>
                                        <TextField type="time" size="small" value={t.end} onChange={e => updateBulkTime(i, 'end', e.target.value)} error={!!errors.bulkTimes && !t.end} inputProps={{ step: 1800 }} />
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
                            <Grid item xs={12}>
                                <TextField fullWidth label="Staff Name" value={staffName} onChange={e => setStaffName(e.target.value)} error={!!errors.staffName} />
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
                                <DateInput fullWidth label="Date" value={startDate} onChange={val => setStartDate(val)} error={!!errors.startDate} InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField type="time" fullWidth label="Start Time" value={startClock} onChange={e => setStartClock(e.target.value)} error={!!errors.startClock} InputLabelProps={{ shrink: true }} inputProps={{ step: 1800 }} />
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
