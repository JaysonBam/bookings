/**
 * Purpose: Module logic for pages\bookings\components\BookingPanel.tsx.
 */
import React, { useEffect, useState, useMemo, useRef } from "react";
import { 
    Dialog, DialogContent, DialogTitle, DialogActions, 
    Button, TextField, Select, MenuItem, InputLabel, FormControl, 
    FormControlLabel, Checkbox, Switch, Box, Typography, 
    CircularProgress, IconButton, Grid,
    FormHelperText, Alert
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { supabase } from "../../../lib/supabaseClient";
import { format, parseISO, addMinutes, eachDayOfInterval, differenceInCalendarDays, differenceInMinutes, isSameDay } from "date-fns";
import { getRoomAvailability, isReclaimableReservation, rankRooms } from "../../../lib/roomRecommendations";
import timeLib from "../../../lib/time";
import { useConfirm } from "../context/ConfirmDialogContext";
import { useNow } from "../context/NowContext";
import { DateInput } from "../../../components/DateInput";
import { TimeInput } from "../../../components/TimeInput";
import { displayBookingDate, validateSchedule, validateBulkRanges, timeMinutes, type BookingRange } from "../../../lib/bookingEntry";

import { logEvent } from "../../../lib/log";

interface BookingRangeSectionProps {
  kind: 'date' | 'time';
  ranges: BookingRange[];
  errors: Record<string, string>;
  validationErrors: Record<string, string>;
  onAdd: () => void;
  onChange: (id: string, field: 'start' | 'end', value: string) => void;
  onRemove: (id: string, index: number) => void;
}

function BookingRangeSection({ kind, ranges, errors, validationErrors, onAdd, onChange, onRemove }: BookingRangeSectionProps) {
  const isDate = kind === 'date';
  const Input = isDate ? DateInput : TimeInput;
  const sectionError = errors[isDate ? 'bulkDates' : 'bulkTimes'];
  return <>
    <Typography variant="subtitle2" gutterBottom>{isDate ? 'Date ranges' : 'Time ranges'}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      {isDate ? 'Use DD/MM/YYYY. Include both the first and last day.' : '24-hour time (HH:mm), in 30-minute intervals. Each range applies to every selected day.'}
    </Typography>
    {ranges.map((range, index) => (
      <Box key={range.id} sx={{ display: 'grid', gridTemplateColumns: isDate ? { xs: 'minmax(0, 1fr) auto', sm: 'minmax(0, 1fr) minmax(0, 1fr) auto' } : 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 1, mb: 2, alignItems: 'start' }}>
        {(['start', 'end'] as const).map(field => {
          const label = `${field === 'start' ? 'Start' : 'End'} ${kind}`;
          const key = `${range.id}.${field}`;
          const message = errors[key] ? validationErrors[key] : undefined;
          return <Input key={field} id={`${range.id}-${field}`} fullWidth size="small" label={label}
            sx={isDate ? { gridColumn: { xs: 1, sm: 'auto' } } : undefined}
            value={range[field]} inputProps={{ 'aria-label': `${label}, range ${index + 1}` }}
            onChange={value => onChange(range.id, field, value)} error={!!message} helperText={message} />;
        })}
        <IconButton aria-label={`Remove ${kind} range ${index + 1}`} onClick={() => onRemove(range.id, index)}
          sx={isDate ? { gridColumn: { xs: 2, sm: 'auto' }, gridRow: { xs: '1 / span 2', sm: 'auto' } } : undefined}><CloseIcon /></IconButton>
      </Box>
    ))}
    <Button id={`add-${kind}-range`} aria-invalid={!!sectionError && !ranges.length} size="small" onClick={onAdd}>Add {kind} range</Button>
    {!ranges.length && sectionError && <FormHelperText error>{sectionError}</FormHelperText>}
  </>;
}

interface BookingPanelProps {
  open: boolean;
  onClose: () => void;
  prefill?: { roomId?: string; timeSlot?: string; booking?: any } | null;
  defaultStaffName?: string;
  showToast?: (title: string, description: string, severity?: "success" | "error" | "info") => void;
  onBookingUpdate?: (staffName?: string) => void;
  rooms: any[];
  courses: any[];
  creationStartTime?: number | null;
}

export const BookingPanel: React.FC<BookingPanelProps> = ({ open, onClose, prefill = null, defaultStaffName = "", showToast = () => {}, onBookingUpdate, rooms, courses, creationStartTime }) => {
  const { confirm } = useConfirm();
  const { currentTime } = useNow();

  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState("");

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
      return ""
  });

  const [staffName, setStaffName] = useState<string>(() => {
      return prefill?.booking?.booked_by || defaultStaffName || ""
  });
  const [isNameManuallyTyped, setIsNameManuallyTyped] = useState(false);

  useEffect(() => {
    if (!open) {
        setIsNameManuallyTyped(false);
    }
  }, [open]);

  useEffect(() => {
    if (!isNameManuallyTyped && !prefill?.booking) {
        setStaffName(defaultStaffName || "");
    }
  }, [defaultStaffName, isNameManuallyTyped, prefill?.booking]);

  const [studentNumbers, setStudentNumbers] = useState<string>(() => prefill?.booking?.student_numbers || "");

  const [totalStudents, setTotalStudents] = useState<string>("");
  const [isBulkCount, setIsBulkCount] = useState(false);

  useEffect(() => {
    const raw = prefill?.booking?.student_numbers || "";
        // Parse bulk marker format: bulk booking - <uuid> - <count>.
    const match = raw.match(/^bulk booking - ([0-9a-fA-F-]+) - (\d+)$/);
    
    if (prefill?.booking?.bulk_booking_id) {
        setIsBulkCount(true);
        if (match) {
            setTotalStudents(match[2]);
        } else {
            setTotalStudents(""); // Empty initially
        }
    } else {
        setIsBulkCount(false);
        setTotalStudents("");
    }
  }, [prefill?.booking]);

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
    if (prefill?.booking?.borrowed_items) {
        (prefill.booking.borrowed_items || []).forEach((it: string) => (sel[it] = true));
        return sel;
    }
    const targetId = prefill?.roomId ?? "";
    const r = rooms.find((x: any) => String(x.id) === targetId);
    (r?.borrowable_items || []).forEach((it: string) => (sel[it] = false));
    return sel;
  });

  const [availability, setAvailability] = useState<{ date: string; bookings: any[] } | null>(null);
  const availabilityReady = availability?.date === startDate;
  const dayBookings = useMemo(() => availabilityReady ? availability!.bookings : [], [availability, availabilityReady]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const contentRef = useRef<HTMLDivElement>(null);
  const clearFieldError = (key: string) => setErrors(previous => {
    const next = { ...previous };
    delete next[key];
    return next;
  });
  const showFieldErrors = (next: Record<string, string>) => {
    setErrors(next);
    if (Object.keys(next).length) requestAnimationFrame(() => {
      contentRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  };

  const [isBulkEdit, setIsBulkEdit] = useState(false);
  const [bulkGroupBookings, setBulkGroupBookings] = useState<any[]>([]);
  const [groupReady, setGroupReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setGroupReady(false);
    setBulkGroupBookings([]);
    setIsBulkEdit(!!prefill?.booking?.bulk_booking_id);
    if (prefill?.booking?.bulk_booking_id) {
      supabase.from('bookings').select('*').eq('bulk_booking_id', prefill.booking.bulk_booking_id).then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.length) { setSaveError("Could not load the bulk group. Reopen the booking to try again."); return; }
        setBulkGroupBookings(data);
        setGroupReady(true);
      });
    }
    return () => { cancelled = true; };
  }, [prefill?.booking]);

  const [isBulkBooking, setIsBulkBooking] = useState(false);
  const [bulkDates, setBulkDates] = useState<BookingRange[]>([{ id: crypto.randomUUID(), start: "", end: "" }]);
  const [bulkTimes, setBulkTimes] = useState<BookingRange[]>([{ id: crypto.randomUUID(), start: "", end: "" }]);
  const [bulkRoomIds, setBulkRoomIds] = useState<string[]>([]);

  const [isSmartSelecting, setIsSmartSelecting] = useState(false);
  const [rankedRooms, setRankedRooms] = useState<any[]>([]);
  const [currentRankIndex, setCurrentRankIndex] = useState(0);
  const [openingHours, setOpeningHours] = useState<{ start: string; end: string }>({ start: "06:00", end: "21:00" });

  const [hoursReady, setHoursReady] = useState(false);
  const smartRequestId = useRef(0);
  const smartRequestedDuration = useRef("");

  useEffect(() => {
    smartRequestId.current += 1;
    setIsSmartSelecting(false);
    setRankedRooms([]);
    setCurrentRankIndex(0);
  }, [open, startDate, startClock, openingHours, rooms, currentTime]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setHoursReady(false);
    const loadHours = async () => {
      const { data, error } = await supabase.from("settings").select("value").eq("key", "operation_hours").maybeSingle();
      if (cancelled) return;
      if (error) {
        showToast("Warning", "Could not load opening hours", "info");
        return;
      }
      const value = data?.value as any;
      setOpeningHours({ start: value?.start ?? value?.open ?? "06:00", end: value?.end ?? value?.close ?? "21:00" });
      setHoursReady(true);
    };
    loadHours();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    setAvailability(null);
    if (!startDate || !open) return;
    let cancelled = false;
    const fetchBookings = async () => {
      const { data, error } = await supabase.from('bookings')
        .select('id, room_id, start_time, end_time, state, booking_day').eq('booking_day', startDate);
      if (cancelled) return;
      if (error || !data) {
        showToast("Warning", "Could not load availability data", "info");
        return;
      }
      setAvailability({ date: startDate, bookings: data });
    };
    fetchBookings();
    return () => { cancelled = true; };
  }, [startDate, open]);

  const roomRequest = useMemo(() => ({ date: startDate, time: startClock, now: currentTime,
    openingHours, excludeBookingId: prefill?.booking?.id }), [startDate, startClock, currentTime, openingHours, prefill?.booking?.id]);

  const availableDurationOptions = useMemo(() => {
    if (!availabilityReady || !hoursReady || !startClock) return duration ? [Number(duration)] : [];
    const { minutesAvailable: maxDuration } = getRoomAvailability(roomId, dayBookings, roomRequest);
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
  }, [startClock, dayBookings, prefill?.booking, duration, roomId, roomRequest, availabilityReady, hoursReady]);

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
    
    const [closeH, closeM] = openingHours.end.split(':').map(Number);
    let limitMins = closeH * 60 + closeM;

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
  }, [startClock, duration, dayBookings, prefill?.booking, roomId, openingHours]);

  useEffect(() => {
    if (!availabilityReady || !hoursReady || isBulkEdit) return;
    const currentDur = parseInt(duration);
    if (availableDurationOptions.length > 0) {
        if (!duration || Number.isNaN(currentDur)) {
            if (prefill?.booking) {
                setDuration(String(availableDurationOptions[0]));
            }
            return;
        }
        const max = availableDurationOptions[availableDurationOptions.length - 1];
        if (currentDur > max) setDuration(String(max));
    } else {
        if (duration !== "") setDuration("");
    }
  }, [availableDurationOptions, duration, prefill?.booking, availabilityReady, hoursReady, isBulkEdit]);

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

  const selectSmartRoom = (room: any, bookings = dayBookings) => {
    setRoomId(String(room.id));
    if (smartRequestedDuration.current) {
      const { minutesAvailable } = getRoomAvailability(room.id, bookings, roomRequest);
      setDuration(String(Math.min(Number(smartRequestedDuration.current), Math.floor(minutesAvailable / 30) * 30)));
    }
  };

  const handleSmartSelect = async () => {
    if (!hoursReady) {
      showToast("Unavailable", "Opening hours have not loaded. Please reopen the booking form.", "info");
      return;
    }
    const sizeStr = window.prompt("Enter Group Size:");
    if (!sizeStr) return;
    const size = Number(sizeStr);
    if (!Number.isInteger(size) || size <= 0) {
      showToast("Invalid size", "Please enter a positive whole number", "error");
      return;
    }
    const requestId = ++smartRequestId.current;
    const { data: bookings, error } = await supabase.from('bookings')
      .select('id, room_id, start_time, end_time, state, booking_day').eq('booking_day', startDate);
    if (requestId !== smartRequestId.current) return;
    if (error || !bookings) {
      showToast("Unavailable", "Could not load availability data. Please try Smart Select again.", "info");
      return;
    }
    setAvailability({ date: startDate, bookings });
    const ranked = rankRooms(size, rooms, bookings, { ...roomRequest, duration: duration ? Number(duration) : 30 });
    if (ranked.length === 0) {
      setIsSmartSelecting(false);
      setRankedRooms([]);
      showToast("No rooms found", "No rooms fit this group with at least 30 minutes available within opening hours.", "info");
      return;
    }
    setRankedRooms(ranked);
    setCurrentRankIndex(0);
    smartRequestedDuration.current = duration;
    selectSmartRoom(ranked[0], bookings);
    setIsSmartSelecting(true);
  };

  const selectNextRankedRoom = () => {
      if (rankedRooms.length === 0) return;
      const nextIndex = (currentRankIndex + 1) % rankedRooms.length;
      setCurrentRankIndex(nextIndex);
      selectSmartRoom(rankedRooms[nextIndex]);
  };

  const mapDatabaseError = (error: any): string => {
    if (!error) return "An unexpected error occurred";
    if (error.code === "23P01") return "This time slot is already booked.";
    if (error.code === "23514") return "Invalid booking time.";
    if (error.code === "23503") return "Invalid room or course.";
    return error.message || "Unable to complete the operation.";
  };

  const handleBulkGroupUpdate = async (state: "Active" | "Reserved" | "Ended") => {
      if (!prefill?.booking?.bulk_booking_id) return;
      setLoading(true);
      try {
          const extensionMins = selectedExtension ? parseInt(selectedExtension, 10) : 0;
          
          const { data: group, error: groupError } = await supabase.from('bookings').select('*').eq('bulk_booking_id', prefill.booking.bulk_booking_id);
          if (groupError) throw groupError;
          if (!group?.length) throw new Error("This group no longer exists. Reopen the booking.");
          const { data: targetBookings, error: targetError } = await supabase.from('bookings')
            .select('id, room_id, start_time, end_time').eq('booking_day', startDate);
          if (targetError) throw targetError;
          const groupIds = new Set(group.map(booking => String(booking.id)));
          const groupRooms = new Set(group.map(booking => String(booking.room_id)));
          const startMins = timeMinutes(startClock);
          const endMins = startMins + Number(duration) + extensionMins;
          if (endMins > timeMinutes(openingHours.end)) throw new Error(`The booking must end by ${openingHours.end}.`);
          if (extensionMins && (startDate !== prefill.booking.booking_day || startClock !== prefill.booking.start_time.slice(0, 5) || Number(duration) !== differenceInMinutes(parseISO(`${prefill.booking.booking_day}T${prefill.booking.end_time}`), parseISO(`${prefill.booking.booking_day}T${prefill.booking.start_time}`)))) {
            throw new Error("Save date or time changes before extending the group.");
          }
          const conflict = targetBookings?.find(booking => !groupIds.has(String(booking.id)) && groupRooms.has(String(booking.room_id)) &&
            startMins < timeMinutes(booking.end_time.slice(0, 5)) && endMins > timeMinutes(booking.start_time.slice(0, 5)));
          if (conflict) {
            const room = rooms.find(room => String(room.id) === String(conflict.room_id));
            showFieldErrors({ startClock: `${room?.name || 'A room in this group'} is already booked during this time. Choose another time.` });
            return;
          }
          const basePayload: any = {
             booked_by: staffName,
          };

          let studentNumbersPayload = null; // Default to null if not set
          
          if (isBulkCount && totalStudents) {
             let uuid = prefill?.booking?.bulk_booking_id;
             if (uuid) {
                 studentNumbersPayload = `bulk booking - ${uuid} - ${totalStudents}`;
             } else {
                 studentNumbersPayload = studentNumbers;
             }
          } else if (isBulkCount && !totalStudents) {
              studentNumbersPayload = null;
          } else {
              studentNumbersPayload = studentNumbers;
          }
          
          if (isBulkCount) {
             basePayload.student_numbers = studentNumbersPayload;
          } else if (studentNumbers) {
             basePayload.student_numbers = studentNumbers;
          }

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

          if (extensionMins > 0) {
              // Extension ends the current group segment and creates a new active segment.
              const start = parseISO(`${startDate}T${startClock}`);
              const originalDuration = parseInt(duration, 10);
              const end = addMinutes(start, originalDuration);
              const extendedEnd = addMinutes(end, extensionMins);
              
              const newClumpId = crypto.randomUUID();
              
              const { error: updateError } = await supabase.from("bookings")
                  .update({ 
                      state: 'Ended', 
                      end_time: format(end, "HH:mm:ss") // Ensure they end at the proper time
                  })
                  .eq("bulk_booking_id", prefill.booking.bulk_booking_id);
                  
              if (updateError) throw updateError;
              
              const newBookings = group.map(b => {
                  
                  let nextStudentNumbers = b.student_numbers;
                  if (basePayload.student_numbers && basePayload.student_numbers.startsWith("bulk booking -")) {
                       const parts = basePayload.student_numbers.split(' - ');
                       if (parts.length === 3) {
                           nextStudentNumbers = `bulk booking - ${newClumpId} - ${parts[2]}`;
                       }
                  } else if (b.student_numbers && b.student_numbers.startsWith("bulk booking -")) {
                       const parts = b.student_numbers.split(' - ');
                       if (parts.length === 3) {
                           nextStudentNumbers = `bulk booking - ${newClumpId} - ${parts[2]}`;
                       }
                  }

                  return {
                    ...basePayload,
                    room_id: b.room_id,
                    booking_day: b.booking_day, // Assume extending on same day
                    start_time: format(end, "HH:mm:ss"),
                    end_time: format(extendedEnd, "HH:mm:ss"),
                    state: 'Active',
                    student_numbers: nextStudentNumbers, 
                    borrowed_items: b.borrowed_items, // Copy from previous
                    bulk_booking_id: newClumpId
                  };
              });
               
             const { error: insertError } = await supabase.from("bookings").insert(newBookings);
             if (insertError) throw insertError;
             
             showToast("Extended Group", `Extended ${newBookings.length} bookings`, "success");

          } else {
               const end = addMinutes(parseISO(`${startDate}T${startClock}`), Number(duration));
               const updatePayload = {
                   ...basePayload,
                   booking_day: startDate,
                   start_time: `${startClock}:00`,
                   end_time: format(end, "HH:mm:ss"),
                   state
               };
               
               const { data: updated, error } = await supabase.from("bookings")
                  .update(updatePayload)
                  .eq("bulk_booking_id", prefill.booking.bulk_booking_id).select('id');
               if (error) throw error;
               if (!updated?.length) throw new Error("No bookings were updated. Reopen the group and try again.");
               showToast("Updated Group", `Updated ${updated.length} bookings for ${displayBookingDate(startDate)}, ${startClock}–${format(end, 'HH:mm')}`, "success");
          }
          
          resetFormToDefaults();
          onBookingUpdate?.(staffName !== prefill?.booking?.booked_by ? staffName : undefined);
          onClose();

      } catch (err: any) {
           setSaveError(mapDatabaseError(err));
      } finally {
          setLoading(false);
      }
  };

  const analyzeChanges = () => {
    if (!prefill?.booking) return { isSharedChange: false, isIndividualChange: false, isExtension: false };

    const currentStartClock = startClock;
    const currentDuration = duration;
    const originalStart = prefill.booking.start_time.slice(0, 5);
    const s = parseISO(`${prefill.booking.booking_day}T${prefill.booking.start_time}`);
    const e = parseISO(`${prefill.booking.booking_day}T${prefill.booking.end_time}`);
    const originalDur = Math.round((e.getTime() - s.getTime())/60000);
    
    const isTimeChanged = startDate !== prefill.booking.booking_day || (currentStartClock !== originalStart) || (parseInt(currentDuration) !== originalDur);
    
    const originalCourseId = prefill.booking.course_id ? String(prefill.booking.course_id) : "";
    const originalCourseName = prefill.booking.course_name ? prefill.booking.course_name : "";
    
    let isCourseChanged = false;
    if (selectedCourseId !== "other") {
        isCourseChanged = selectedCourseId !== originalCourseId;
    } else {
        isCourseChanged = otherCourseName !== originalCourseName;
    }

    let isCountChanged = false;
    if (isBulkCount) {
        const raw = prefill.booking.student_numbers || "";
        const match = raw.match(/^bulk booking - [0-9a-fA-F-]+ - (\d+)$/);
        const originalCount = match ? match[1] : "";
        isCountChanged = totalStudents !== originalCount;
    }

    const isSharedChange = isTimeChanged || isCourseChanged || isCountChanged;

    const isRoomChanged = prefill.booking.room_id !== parseInt(roomId, 10);
    
    const isExtension = !!selectedExtension;


    return { isSharedChange, isIndividualChange: isRoomChanged, isExtension };
  };

  const validateDetails = () => {
    const next = validateSchedule(startDate, startClock, duration, openingHours);
    if (!roomId) next.roomId = 'Select a room.';
    if (!staffName.trim()) next.staffName = 'Enter the staff name.';
    if (!selectedCourseId) next.selectedCourseId = 'Select a course.';
    if (selectedCourseId === 'other' && !otherCourseName.trim()) next.otherCourseName = 'Enter a course name.';
    if (isBulkCount && totalStudents && (!/^\d+$/.test(totalStudents) || Number(totalStudents) <= 0)) next.totalStudents = 'Enter a positive whole number.';
    showFieldErrors(next);
    if (Object.keys(next).length) return false;
    if (!hoursReady) { setSaveError('Opening hours have not loaded. Reopen the form and try again.'); return false; }
    return true;
  };

  const handleSave = async (state: "Active" | "Reserved" | "Ended") => {
    setSaveError("");
    if (isBulkBooking) {
      await handleBulkSave(state);
      return;
    }
    
    if (!validateDetails()) return;
    if (isBulkEdit && !groupReady) { setSaveError('The bulk group has not loaded. Reopen the booking to try again.'); return; }
    let updateScope = 'single';
    if (isBulkEdit) {
        const { isSharedChange, isIndividualChange, isExtension } = analyzeChanges();

        if (isSharedChange && isIndividualChange) {
            showToast("Conflict", "Cannot change Room (Individual) and Time/Course/Count (Group) at the same time.", "error");
            return;
        }

        const actions: any[] = [];
        
        
        if (isIndividualChange) {
            actions.push({ label: "Update This Only", value: 'single', variant: 'contained' });
        } else if (isSharedChange) {
             actions.push({ label: "Update Entire Group", value: 'group', variant: 'contained' });
        } else if (isExtension) {
             actions.push({ label: "Extend This Only", value: 'single', variant: 'outlined' });
             actions.push({ label: "Extend Entire Group", value: 'group', variant: 'contained' });
        } else {
             actions.push({ label: "Update This Only", value: 'single', variant: 'outlined' });
             actions.push({ label: "Update Entire Group", value: 'group', variant: 'contained' });
        }

        const result = await confirm({
            title: isExtension ? "Extend Bulk Group" : "Update Bulk Group",
            description: isSharedChange 
                ? `Changes to date, time, course, or student count apply to all ${bulkGroupBookings.length} bookings. New schedule: ${displayBookingDate(startDate)}, ${startClock}–${format(addMinutes(parseISO(`${startDate}T${startClock}`), Number(duration)), "HH:mm")}.`
                : (isIndividualChange ? "Room changes can only represent this individual booking." : `This booking is part of a bulk group (${bulkGroupBookings.length} bookings).`),
            cancelText: "Cancel",
            actions: actions
        });
        if (!result) return;
        updateScope = result;
    }
    
    if (updateScope === 'group') {
        const { isIndividualChange } = analyzeChanges();
        if (isIndividualChange) {
             showToast("Error", "Cannot apply room change to entire group.", "error");
             return;
        }
        await handleBulkGroupUpdate(state);
        return;
    }
    
    const dur = Number(duration);
    const parseTime = (time: string) => timeMinutes(time.slice(0, 5));
    const bookingStartMins = parseTime(startClock);
    const bookingEndMins = bookingStartMins + dur;
    if (!availabilityReady) {
      showToast("Unavailable", "Availability has not loaded for this date. Please try again.", "info");
      return;
    }
    const bookingsToDelete: string[] = [];
    if (!isBulkBooking) {
        const hasCollision = dayBookings.some(b => {
             if (String(b.room_id) !== String(roomId)) return false;
             if (prefill?.booking && String(b.id) === String(prefill.booking.id)) return false;
             
             const bStart = parseTime(b.start_time);
             const bEnd = parseTime(b.end_time);
             
             const overlaps = (bookingStartMins < bEnd && bookingEndMins > bStart);
             
             if (overlaps) {
                 if (isReclaimableReservation(b, roomRequest)) {
                     // Late bookings can be auto-removed to free this overlapping slot.
                     if (!bookingsToDelete.includes(String(b.id))) {
                         bookingsToDelete.push(String(b.id));
                     }
                     return false;
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
         
         const { data: autoEndedBookings } = await supabase
            .from('bookings')
            .select('id, start_time, end_time, state')
            .eq('room_id', roomId)
            .eq('booking_day', startDate)
            .lt('start_time', startStr)
            .neq('state', 'Ended');

         if (autoEndedBookings && autoEndedBookings.length > 0) {
              const exactNow = await timeLib.getTime();
              for (const b of autoEndedBookings) {
                  const bEnd = parseISO(`${startDate}T${b.end_time}`);
                  const diffMins = isSameDay(exactNow, bEnd) ? differenceInMinutes(exactNow, bEnd) : 1000;
                  await logEvent('state_change', {
                      type: 'auto',
                      state: 'active_to_ended',
                      time: diffMins
                  });
              }
         }

         const { error: _autoEndError } = await supabase
            .from('bookings')
            .update({ state: 'Ended' })
            .eq('room_id', roomId)
            .eq('booking_day', startDate)
            .lt('start_time', startStr)
            .neq('state', 'Ended');

          if (_autoEndError) {
             showToast("Error", "Failed to auto-end overlapping bookings", "error");
          }
      }

      const extensionMins = selectedExtension ? parseInt(selectedExtension, 10) : 0;
      
      const originalDuration = parseInt(duration, 10);
      let end = addMinutes(start, originalDuration);
      
      let extendedEnd = addMinutes(end, extensionMins);

      if (state === 'Ended' && extensionMins === 0) {
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
      } else if (!prefill?.booking && extensionMins > 0) {
          end = extendedEnd; 
      } else if (prefill?.booking && extensionMins === 0) {
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
                         // Split existing booking into an ended segment plus a new active extension.
             const oldPayload = {
                 ...basePayload,
                 start_time: format(start, "HH:mm:ss"),
                 end_time: format(end, "HH:mm:ss"),
                 state: 'Ended'
             };
             
             const { error: updateError } = await supabase.from("bookings").update(oldPayload).eq("id", prefill.booking.id);
             if (updateError) throw updateError;

             const exactNow = await timeLib.getTime();
             const bEnd = end;
             await logEvent('state_change', {
                 type: 'extended',
                 state: 'active_to_ended',
                 time: isSameDay(exactNow, bEnd) ? differenceInMinutes(exactNow, bEnd) : 1000
             });

             const newPayload = {
                 ...basePayload,
                 start_time: format(end, "HH:mm:ss"),
                 end_time: format(extendedEnd, "HH:mm:ss"),
                 state: 'Active'
             };
             
             const { error: insertError } = await supabase.from("bookings").insert(newPayload);
             if (insertError) throw insertError;

             await logEvent('booking_create', {
                 type: 'extension',
                 rank: null,
                 name_entered: isNameManuallyTyped ? 'manual' : 'auto',
                 state: 'active',
                 time: creationStartTime ? (Date.now() - creationStartTime) / 1000 : 0
             });

             showToast("Extended", "Booking extended (new session created)", "success");
        } else {
            const payload = {
                ...basePayload,
                start_time: format(start, "HH:mm:ss"),
                end_time: format(end, "HH:mm:ss"),
                state,
            };
            const { error } = await supabase.from("bookings").update(payload).eq("id", prefill.booking.id);
            if (error) throw error;

            if (state !== prefill.booking.state) {
                 const exactNow = await timeLib.getTime();
                 let timeDiff = 0;
                 let targetState: 'reserved_to_active' | 'active_to_ended' | null = null;
                 
                 if (prefill.booking.state === 'Reserved' && state === 'Active') {
                     const bStart = parseISO(`${prefill.booking.booking_day}T${prefill.booking.start_time}`);
                     timeDiff = isSameDay(exactNow, bStart) ? differenceInMinutes(exactNow, bStart) : 1000;
                     targetState = 'reserved_to_active';
                 }
                 else if (prefill.booking.state === 'Active' && state === 'Ended') {
                     const bEnd = parseISO(`${prefill.booking.booking_day}T${prefill.booking.end_time}`);
                     timeDiff = isSameDay(exactNow, bEnd) ? differenceInMinutes(exactNow, bEnd) : 1000;
                     targetState = 'active_to_ended';
                 }

                 if (targetState) {
                     await logEvent('state_change', {
                         type: 'manual',
                         state: targetState,
                         time: timeDiff
                     });
                 }
            }

            showToast("Updated", "Booking updated", "success");
        }
      } else {
        
        const payload = {
            ...basePayload,
            start_time: format(start, "HH:mm:ss"),
            end_time: format(end, "HH:mm:ss"),
            state,
        };
        const { error } = await supabase.from("bookings").insert(payload);
        if (error) throw error;

        await logEvent('booking_create', {
             type: isSmartSelecting ? 'smart' : 'manual',
             rank: isSmartSelecting ? (currentRankIndex + 1) : null,
             name_entered: isNameManuallyTyped ? 'manual' : 'auto',
             state: (state as string).toLowerCase() as any, 
             time: creationStartTime ? (Date.now() - creationStartTime) / 1000 : 0
        });

        showToast("Saved", "Booking created", "success");
      }
      resetFormToDefaults();
      onBookingUpdate?.(staffName !== prefill?.booking?.booked_by ? staffName : undefined);
      onClose();
    } catch (err: any) {
      setSaveError(mapDatabaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const addBulkDate = () => setBulkDates(previous => [...previous, { id: crypto.randomUUID(), start: "", end: "" }]);
  const addBulkTime = () => setBulkTimes(previous => [...previous, { id: crypto.randomUUID(), start: "", end: "" }]);
  const updateBulkDate = (id: string, field: "start" | "end", value: string) => setBulkDates(previous => previous.map(row => row.id === id ? { ...row, [field]: value } : row));
  const updateBulkTime = (id: string, field: "start" | "end", value: string) => setBulkTimes(previous => previous.map(row => row.id === id ? { ...row, [field]: value } : row));
  const removeRange = (kind: 'date' | 'time', id: string, index: number) => {
    const rows = kind === 'date' ? bulkDates : bulkTimes;
    const next = rows.filter(row => row.id !== id);
    (kind === 'date' ? setBulkDates : setBulkTimes)(next);
    const focusId = next[Math.min(index, next.length - 1)]?.id;
    requestAnimationFrame(() => document.getElementById(focusId ? `${focusId}-start` : `add-${kind}-range`)?.focus());
  };
  const rangeErrors = validateBulkRanges(bulkDates, bulkTimes, openingHours);
  const bulkCount = bulkDates.length && bulkTimes.length && !Object.keys(rangeErrors).length
    ? bulkDates.reduce((sum, range) => sum + differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) + 1, 0) * bulkTimes.length * bulkRoomIds.length : 0;

  const toggleBulkRoom = (rId: string) => {
    clearFieldError("bulkRooms");
    setBulkRoomIds(prev => prev.includes(rId) ? prev.filter(id => id !== rId) : [...prev, rId]);
  };

  const handleBulkSave = async (state: "Active" | "Reserved" | "Ended") => {
    const newErrors = validateBulkRanges(bulkDates, bulkTimes, openingHours);
    if (!bulkDates.length) newErrors.bulkDates = 'Add at least one date range.';
    if (!bulkTimes.length) newErrors.bulkTimes = 'Add at least one time range.';
    if (!bulkRoomIds.length) newErrors.bulkRooms = 'Select at least one room.';
    if (!staffName.trim()) newErrors.staffName = 'Enter the staff name.';
    if (!selectedCourseId) newErrors.selectedCourseId = 'Select a course.';
    if (selectedCourseId === 'other' && !otherCourseName.trim()) newErrors.otherCourseName = 'Enter a course name.';
    showFieldErrors(newErrors);
    if (Object.keys(newErrors).length) {
      showToast('Check the form', 'Correct the highlighted fields. Every range must be complete.', 'error');
      return;
    }
    if (!hoursReady) { setSaveError('Opening hours have not loaded. Reopen the form and try again.'); return; }

    setLoading(true);
    try {
        const bookingsToInsert: any[] = [];
        for (const dateRange of bulkDates) {
            const startD = parseISO(dateRange.start);
            const endD = parseISO(dateRange.end);
            const days = eachDayOfInterval({ start: startD, end: endD });
            for (const day of days) {
                const dayStr = format(day, "yyyy-MM-dd");
                for (const timeRange of bulkTimes) {
                    const tStart = timeRange.start;
                    const tEnd = timeRange.end;
                    
                    const clumpId = crypto.randomUUID();

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
                            bulk_booking_id: clumpId,
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
        onBookingUpdate?.(staffName !== prefill?.booking?.booked_by ? staffName : undefined);
        onClose();
    } catch (err: any) {
        console.error(err);
        setSaveError(mapDatabaseError(err));
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
    setBulkDates([{ id: crypto.randomUUID(), start: "", end: "" }]);
    setBulkTimes([{ id: crypto.randomUUID(), start: "", end: "" }]);
    setBulkRoomIds([]);
    setIsSmartSelecting(false);
    setRankedRooms([]);
    setCurrentRankIndex(0);
    setErrors({});
    setSaveError("");
  };

  const handleDelete = async () => {
    if (!prefill?.booking?.id) return;
    const isGroup = isBulkEdit && prefill.booking.bulk_booking_id;
    
    let scope = 'single';
    if (isGroup) {
         const result = await confirm({
             title: "Delete Booking",
             description: `This booking is part of a bulk group (${bulkGroupBookings.length} bookings).`,
             cancelText: "Cancel",
             actions: [
                 { label: "Delete This Only", value: 'single', variant: 'outlined', color: 'error' },
                 { label: "Delete Entire Group", value: 'group', variant: 'contained', color: 'error' }
             ]
         });
         if (!result) return;
         scope = result;
    } else {
        const ok = await confirm({
            title: "Delete Booking",
            description: "Delete this booking?",
            confirmText: "Delete",
            cancelText: "Cancel",
        });
        if (!ok) return;
    }

    setLoading(true);
    try {
      if (scope === 'group') {
          const { error } = await supabase.from('bookings').delete().eq('bulk_booking_id', prefill.booking.bulk_booking_id);
          if (error) throw error;
      } else {
          const { error } = await supabase.from('bookings').delete().eq('id', prefill.booking.id);
          if (error) throw error;
      }
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
    if (!availabilityReady || !hoursReady || !startClock || !startDate) return null;
    const status = getRoomAvailability(rId, dayBookings, roomRequest);
    const describe = (minutes: number) => minutes < 60 ? minutes + ' minutes' : Math.floor(minutes / 60) + ' hr+';
    if (status.occupied) return { color: status.reserved ? 'warning.light' : 'error.main', text: status.reserved ? 'Reserved' : 'Occupied' };
    if (status.minutesAvailable === 0) return { color: 'text.secondary', text: 'Outside opening hours' };
    if (status.lateMinutes) return { color: 'warning.main', text: describe(status.lateMinutes) + ' late' };
    if (status.overdueMinutes) return { color: 'error.main', text: 'Overdue ' + describe(status.overdueMinutes) };
    if (status.minutesAvailable <= 120) {
      const h = Math.floor(status.minutesAvailable / 60);
      const m = status.minutesAvailable % 60;
      return { color: 'text.primary', text: 'Available for ' + (h ? h + ' hr' : '') + (h && m ? ' ' : '') + (m ? m + ' min' : '') };
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
                {isBulkEdit 
                    ? `Edit Bulk Group (${bulkGroupBookings.length} rooms)` 
                    : (prefill?.booking ? "Edit Booking" : "New Booking")
                }
                {isBulkCount 
                    ? (totalStudents && ` - ${totalStudents} students`) 
                    : (studentNumbers && ` - ${studentNumbers.split('\n').filter(l => l.trim()).length} students`)
                }
            </Box>
            {!prefill?.booking && (
                <FormControlLabel control={<Switch checked={isBulkBooking} onChange={(e) => setIsBulkBooking(e.target.checked)} />} label="Bulk Mode" />
            )}
        </DialogTitle>
        <DialogContent ref={contentRef} dividers sx={{ overflowX: 'hidden' }}>
            {loading ? (
                <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
            ) : (
                <Grid container spacing={2}>
                    {saveError && <Grid item xs={12}><Alert severity="error">{saveError}</Alert></Grid>}
                    {isBulkBooking ? (
                        <>
                            <Grid item xs={12}>
                                <BookingRangeSection kind="date" ranges={bulkDates} errors={errors} validationErrors={rangeErrors}
                                    onAdd={addBulkDate} onChange={updateBulkDate} onRemove={(id, index) => removeRange('date', id, index)} />
                            </Grid>
                            <Grid item xs={12}>
                                <BookingRangeSection kind="time" ranges={bulkTimes} errors={errors} validationErrors={rangeErrors}
                                    onAdd={addBulkTime} onChange={updateBulkTime} onRemove={(id, index) => removeRange('time', id, index)} />
                            </Grid>
                            <Grid item xs={12}>
                                <Box role="status" sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 2, py: 1.5 }}>
                                    <Typography variant="body2" fontWeight={600}>{bulkCount ? `${bulkCount} bookings ready to create` : 'Complete the ranges and select rooms to preview your booking count.'}</Typography>
                                </Box>
                            </Grid>
                             <Grid item xs={12}>
                                <Typography id="bulk-rooms-label" variant="subtitle2">Rooms</Typography>
                                <Box role="group" aria-labelledby="bulk-rooms-label" aria-invalid={!!errors.bulkRooms && !bulkRoomIds.length} tabIndex={-1} sx={{ border: 1, borderColor: 'divider', p: 1, maxHeight: 150, overflow: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                    {rooms.map(r => (
                                        <FormControlLabel key={r.id} control={<Checkbox checked={bulkRoomIds.includes(String(r.id))} onChange={() => toggleBulkRoom(String(r.id))} />} label={r.name} />
                                    ))}
                                </Box>
                                {errors.bulkRooms && <FormHelperText error>Select at least one room</FormHelperText>}
                            </Grid>
                            <Grid item xs={12}>
                                <TextField fullWidth label="Staff Name" value={staffName} onChange={e => { setStaffName(e.target.value); setIsNameManuallyTyped(true); clearFieldError("staffName"); }} error={!!errors.staffName} helperText={errors.staffName} />
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
                                        onChange={(e) => { setRoomId(e.target.value); clearFieldError("roomId"); }}
                                        error={!!errors.roomId}
                                        helperText={errors.roomId}
                                    >
                                        {rooms.map(r => {
                                            const status = getRoomStatus(String(r.id));
                                            if (String(r.id) !== String(roomId) && (status?.text === 'Occupied' || (status?.text === 'Reserved' && !status.text.includes('late')))) return null;
                                            return (
                                                <MenuItem key={r.id} value={String(r.id)}>
                                                    <Box display="flex" justifyContent="space-between" width="100%">
                                                        <Typography color={status?.color || 'inherit'}>{r.name} {status?.text && `(${status.text})`}</Typography>
                                                                                                                {r.dynamic_labels && r.dynamic_labels.length > 0 && (
                                                                                                                        <Typography sx={{ ml: 1, display: 'flex', gap: 0.5 }}>
                                                                                                                                {r.dynamic_labels.map((l: any, idx: number) => (
                                                                                                                                    <span key={idx} style={{
                                                                                                                                        display: 'inline-flex',
                                                                                                                                        alignItems: 'center',
                                                                                                                                        justifyContent: 'center',
                                                                                                                                        position: 'relative',
                                                                                                                                        marginRight: 2
                                                                                                                                    }}>
                                                                                                                                        <span style={{
                                                                                                                                            position: 'absolute',
                                                                                                                                            left: '50%',
                                                                                                                                            top: '50%',
                                                                                                                                            transform: 'translate(-50%, -50%)',
                                                                                                                                            width: 18,
                                                                                                                                            height: 18,
                                                                                                                                            borderRadius: '50%',
                                                                                                                                            background: '#b0b3b8',
                                                                                                                                            zIndex: 0,
                                                                                                                                        }} />
                                                                                                                                        <span style={{ position: 'relative', zIndex: 1, color: '#222' }}>{l.split(' ').pop()}</span>
                                                                                                                                    </span>
                                                                                                                                ))}
                                                                                                                        </Typography>
                                                                                                                )}
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
                            <Grid item xs={12} sm={6}>
                                <DateInput fullWidth label="Date" value={startDate} onChange={val => { setStartDate(val); clearFieldError("startDate"); }} helperText={errors.startDate || "DD/MM/YYYY"} error={!!errors.startDate} InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TimeInput fullWidth label="Start Time" value={startClock} onChange={value => { setStartClock(value); clearFieldError("startClock"); }} error={!!errors.startClock} helperText={errors.startClock || "24-hour time · 30-minute intervals"} />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Duration"
                                    value={duration}
                                    onChange={e => {
                                        setDuration(e.target.value);
                                        clearFieldError("duration");
                                        smartRequestId.current += 1;
                                        setIsSmartSelecting(false);
                                        setRankedRooms([]);
                                        setCurrentRankIndex(0);
                                    }}
                                    error={!!errors.duration}
                                    helperText={errors.duration}
                                    SelectProps={{
                                        renderValue: (val: unknown) => {
                                            if (!val) return '';
                                            const d = Number(val);
                                            return isNaN(d) ? '' : `${d} mins`;
                                        }
                                    }}
                                >
                                    {availableDurationOptions.map(d => {
                                        const endTime = startClock
                                            ? format(addMinutes(parseISO(`2000-01-01T${startClock}`), d), "HH:mm")
                                            : null;
                                        return (
                                            <MenuItem key={d} value={String(d)}>
                                                <Box display="flex" justifyContent="space-between" width="100%">
                                                    <span>{d} mins</span>
                                                    {endTime && (
                                                        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                                                            until {endTime}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </MenuItem>
                                        );
                                    })}
                                </TextField>
                            </Grid>
                             <Grid item xs={12} sm={6}>
                                <TextField fullWidth label="Staff Name" value={staffName} onChange={e => { setStaffName(e.target.value); setIsNameManuallyTyped(true); clearFieldError("staffName"); }} error={!!errors.staffName} helperText={errors.staffName} />
                            </Grid>
                        </>
                    )}
                    
                    <Grid item xs={12}>
                        <FormControl fullWidth error={!!errors.selectedCourseId}>
                            <InputLabel id="booking-course-label">Course</InputLabel>
                            <Select labelId="booking-course-label" value={selectedCourseId} onChange={e => { setSelectedCourseId(e.target.value as string); clearFieldError("selectedCourseId"); }} label="Course">
                                {courses.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
                                <MenuItem value="other">Other</MenuItem>
                            </Select>
                            {errors.selectedCourseId && <FormHelperText>{errors.selectedCourseId}</FormHelperText>}
                        </FormControl>
                        {selectedCourseId === "other" && (
                            <TextField fullWidth sx={{ mt: 1 }} label="Course Name" value={otherCourseName} onChange={e => { setOtherCourseName(e.target.value); clearFieldError("otherCourseName"); }} error={!!errors.otherCourseName} helperText={errors.otherCourseName} />
                        )}
                    </Grid>

                    {!isBulkBooking && (
                        <>
                             <Grid item xs={12}>
                                {isBulkCount ? (
                                    <TextField 
                                        type="number" 
                                        fullWidth 
                                        label="Total Students (Entire Bulk Group)" 
                                        value={totalStudents} 
                                        onChange={e => { setTotalStudents(e.target.value); clearFieldError("totalStudents"); }}
                                        error={!!errors.totalStudents} helperText={errors.totalStudents || "This count is shared across the bulk group"}
                                    />
                                ) : (
                                    <TextField multiline rows={3} fullWidth label="Student Numbers" value={studentNumbers} onChange={e => setStudentNumbers(e.target.value)} />
                                )}
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
        <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
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
