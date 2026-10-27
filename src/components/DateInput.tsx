import React from 'react';
import { Box, Button, IconButton, InputAdornment, Popover, TextField, TextFieldProps, Typography } from '@mui/material';
import { CalendarMonth, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { displayBookingDate, parseBookingDate } from '../lib/bookingEntry';
import { useEntryDraft } from './useEntryDraft';

interface DateInputProps extends Omit<TextFieldProps, 'onChange' | 'value'> { value: string; onChange: (value: string) => void }

/** Stable date entry and a Monday-first calendar, independent of browser locale. */
export function DateInput({ value, onChange, onBlur, onKeyDown, label, error, helperText, inputProps,
  InputProps, InputLabelProps, disabled, ...props }: DateInputProps) {
  const { draft, change } = useEntryDraft(value, displayBookingDate, parseBookingDate, onChange);
  const [touched, setTouched] = React.useState(false);
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [focusedDay, setFocusedDay] = React.useState(() => value ? parseISO(value) : new Date());
  const inputRef = React.useRef<HTMLInputElement>(null);
  const calendarRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const fieldName = inputProps?.['aria-label'] || (typeof label === 'string' ? label : 'date');
  const invalid = !!draft && !parseBookingDate(draft);
  const month = startOfMonth(focusedDay);
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  const focusDayButton = () => calendarRef.current?.querySelector<HTMLButtonElement>('[data-calendar-focus="true"]')?.focus();
  const openCalendar = (element: HTMLElement) => { setFocusedDay(value ? parseISO(value) : new Date()); setAnchor(element); };
  const closeCalendar = () => { setAnchor(null); requestAnimationFrame(() => inputRef.current?.focus()); };
  const moveFocus = (date: Date) => { setFocusedDay(date); requestAnimationFrame(focusDayButton); };
  const handleCalendarKey = (event: React.KeyboardEvent, day: Date) => {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(day, -1), ArrowRight: () => addDays(day, 1),
      ArrowUp: () => addDays(day, -7), ArrowDown: () => addDays(day, 7),
      Home: () => startOfWeek(day, { weekStartsOn: 1 }), End: () => endOfWeek(day, { weekStartsOn: 1 }),
      PageUp: () => addMonths(day, event.shiftKey ? -12 : -1), PageDown: () => addMonths(day, event.shiftKey ? 12 : 1),
    };
    if (moves[event.key]) { event.preventDefault(); moveFocus(moves[event.key]()); }
  };
  return <>
    <TextField {...props} label={label} disabled={disabled} type="text" value={draft} inputRef={inputRef}
      placeholder="DD/MM/YYYY" onChange={event => change(event.target.value)}
      onBlur={event => { setTouched(true); onBlur?.(event); }}
      onKeyDown={event => {
        if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); openCalendar(inputRef.current!); }
        onKeyDown?.(event);
      }}
      error={error || (touched && invalid)}
      helperText={touched && invalid ? 'Enter a valid date as DD/MM/YYYY, such as 16/12/2026.' : helperText}
      InputLabelProps={{ ...InputLabelProps, shrink: true }}
      inputProps={{ ...inputProps, autoComplete: 'off', maxLength: 10, spellCheck: false }}
      InputProps={{ ...InputProps, endAdornment: <>{InputProps?.endAdornment}<InputAdornment position="end">
        <IconButton aria-label={`Open calendar for ${fieldName}`} aria-haspopup="dialog" aria-expanded={!!anchor}
          disabled={disabled} edge="end" size="small" onClick={event => openCalendar(event.currentTarget)}>
          <CalendarMonth fontSize="small" />
        </IconButton></InputAdornment></> }} />
    <Popover open={!!anchor} anchorEl={anchor} onClose={closeCalendar} disableRestoreFocus
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} TransitionProps={{ onEntered: focusDayButton }}
      PaperProps={{ role: 'dialog', 'aria-label': `Choose ${fieldName}`, sx: { p: 2, width: 300, maxWidth: 'calc(100vw - 32px)' } }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <IconButton aria-label="Previous month" onClick={() => setFocusedDay(addMonths(focusedDay, -1))}><ChevronLeft /></IconButton>
        <Typography id={titleId} variant="subtitle1" fontWeight={600} aria-live="polite">{format(month, 'MMMM yyyy')}</Typography>
        <IconButton aria-label="Next month" onClick={() => setFocusedDay(addMonths(focusedDay, 1))}><ChevronRight /></IconButton>
      </Box>
      <Box ref={calendarRef} role="grid" aria-labelledby={titleId}>
        <Box role="row" display="grid" gridTemplateColumns="repeat(7, 1fr)">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day =>
            <Typography key={day} role="columnheader" aria-label={day} align="center" variant="caption" color="text.secondary">{day.slice(0, 2)}</Typography>)}
        </Box>
        {Array.from({ length: days.length / 7 }, (_, week) => <Box role="row" key={week} display="grid" gridTemplateColumns="repeat(7, 1fr)">
          {days.slice(week * 7, week * 7 + 7).map(day => {
            const selected = !!value && isSameDay(day, parseISO(value));
            const focused = isSameDay(day, focusedDay);
            return <Box role="gridcell" aria-selected={selected} key={format(day, 'yyyy-MM-dd')}>
              <Button aria-label={format(day, 'd MMMM yyyy')} aria-current={isSameDay(day, new Date()) ? 'date' : undefined}
                data-calendar-focus={focused} tabIndex={focused ? 0 : -1} variant={selected ? 'contained' : 'text'}
                color={isSameMonth(day, month) ? 'primary' : 'inherit'}
                sx={{ minWidth: 0, width: '100%', height: 36, p: 0, opacity: isSameMonth(day, month) ? 1 : 0.55 }}
                onKeyDown={event => handleCalendarKey(event, day)}
                onClick={() => { change(format(day, 'dd/MM/yyyy')); setTouched(false); closeCalendar(); }}>
                {format(day, 'd')}
              </Button>
            </Box>;
          })}
        </Box>)}
      </Box>
      <Box display="flex" justifyContent="space-between" mt={1}>
        <Button size="small" onClick={() => moveFocus(new Date())}>Today</Button>
        <Button size="small" onClick={closeCalendar}>Close calendar</Button>
      </Box>
    </Popover>
  </>;
}
