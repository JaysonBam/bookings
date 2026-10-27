import React from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import { isBookingTime } from '../lib/bookingEntry';
import { useEntryDraft } from './useEntryDraft';

type TimeInputProps = Omit<TextFieldProps, 'value' | 'onChange'> & { value: string; onChange: (value: string) => void };
const displayTime = (value: string) => value;
const parseTime = (value: string) => isBookingTime(value.trim()) ? value.trim() : '';
export function TimeInput({ value, onChange, onBlur, error, helperText, inputProps, InputLabelProps, ...props }: TimeInputProps) {
  const { draft, change } = useEntryDraft(value, displayTime, parseTime, onChange);
  const [touched, setTouched] = React.useState(false);
  const invalid = !!draft && !isBookingTime(draft.trim());
  return <TextField {...props} type="text" value={draft} placeholder="HH:mm"
    onChange={event => change(event.target.value)} onBlur={event => { setTouched(true); onBlur?.(event); }}
    error={error || (touched && invalid)}
    helperText={touched && invalid ? 'Enter a time as HH:mm (24-hour), such as 08:30.' : helperText}
    InputLabelProps={{ ...InputLabelProps, shrink: true }}
    inputProps={{ ...inputProps, autoComplete: 'off', maxLength: 5, spellCheck: false }} />;
}
