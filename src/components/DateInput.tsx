import React, { useState, useRef } from 'react';
import { TextField, TextFieldProps, InputAdornment } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { format, parseISO, isValid } from 'date-fns';

interface DateInputProps extends Omit<TextFieldProps, 'onChange' | 'value'> {
  value: string; // expects yyyy-MM-dd
  onChange: (value: string) => void;
}

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, onFocus, onBlur, ...props }) => {
  const [inputType, setInputType] = useState<'text' | 'date'>('text');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const formatDateForDisplay = (isoDate: string) => {
    if (!isoDate) return '';
    try {
        const date = parseISO(isoDate);
        if (!isValid(date)) return isoDate;
        return format(date, 'dd/MM/yyyy');
    } catch (e) {
        return isoDate;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
  };

  return (
    <TextField
      inputRef={inputRef}
      {...props}
      type={inputType}
      value={inputType === 'date' ? value : formatDateForDisplay(value)}
      onChange={handleChange}
      onFocus={(e) => {
        setInputType('date');
        if (onFocus) onFocus(e);
      }}
      onBlur={(e) => {
        setInputType('text');
        if (onBlur) onBlur(e);
      }}
      placeholder={inputType === 'text' ? 'dd/mm/yyyy' : ''}
      InputProps={{
        ...props.InputProps,
        endAdornment: (
          <InputAdornment position="end" sx={{ margin: 0 }}>
             <CalendarTodayIcon 
                fontSize="small" 
                color="action" 
                sx={{ cursor: 'pointer' }}
                onClick={() => {
                   setInputType('date');
                   // Short timeout allows the render cycle to switch the input type to 'date' 
                   // before we try to show the picker.
                   setTimeout(() => {
                       if (inputRef.current) {
                           inputRef.current.focus();
                           if ('showPicker' in inputRef.current) {
                               (inputRef.current as any).showPicker();
                           }
                       }
                   }, 10);
                }}
             />
          </InputAdornment>
        )
      }}
      sx={{
        ...props.sx,
        '& input::-webkit-calendar-picker-indicator': {
          display: 'none',
          WebkitAppearance: 'none'
        }
      }}
    />
  );
};
