/**
 * Purpose: Module logic for components\DateInput.tsx.
 */
import React from 'react';
import {
  IconButton,
  InputAdornment,
  TextField,
  TextFieldProps,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { format, isValid, parseISO } from 'date-fns';

interface DateInputProps extends Omit<TextFieldProps, 'onChange' | 'value'> {
  value: string; // expects yyyy-MM-dd
  onChange: (value: string) => void;
}

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, onFocus, onBlur, ...props }) => {
  const theme = useTheme();
  const [inputType, setInputType] = React.useState<'text' | 'date'>('text');
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const { sx, InputLabelProps, InputProps, ...restProps } = props;

  const formatDateForDisplay = (isoDate: string) => {
    if (!isoDate) return '';

    try {
      const date = parseISO(isoDate);
      if (!isValid(date)) return isoDate;
      return format(date, 'dd/MM/yyyy');
    } catch {
      return isoDate;
    }
  };

  const openDatePicker = () => {
    setInputType('date');

    // Wait for type switch to apply, then open native picker.
    requestAnimationFrame(() => {
    const input = inputRef.current;
    if (!input) return;

    const inputWithPicker = input as HTMLInputElement & {
      showPicker?: () => void;
    };

    if (typeof inputWithPicker.showPicker === 'function') {
      inputWithPicker.showPicker();
    } else {
      input.focus();
      input.click();
    }
    });
  };

  const calendarIconSx = {
    '& input[type="date"]': {
      colorScheme: theme.palette.mode,
    },
    '& input[type="date"]::-webkit-calendar-picker-indicator': {
      opacity: 0,
      pointerEvents: 'none',
    },
  };

  const mergedSx = Array.isArray(sx) ? [calendarIconSx, ...sx] : sx ? [calendarIconSx, sx] : calendarIconSx;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <TextField
      {...restProps}
      type={inputType}
      value={inputType === 'date' ? value : formatDateForDisplay(value)}
      inputRef={inputRef}
      onChange={handleChange}
      onFocus={(e) => {
        setInputType('date');
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setInputType('text');
        onBlur?.(e);
      }}
      InputProps={{
        ...InputProps,
        endAdornment: (
          <>
            {InputProps?.endAdornment}
            <InputAdornment position="end">
              <IconButton
                aria-label="Open calendar"
                edge="end"
                size="small"
                onClick={openDatePicker}
              >
                <CalendarMonthIcon
                  fontSize="small"
                  sx={{
                    color: theme.palette.mode === 'dark' ? '#ffffff' : '#0f172a',
                  }}
                />
              </IconButton>
            </InputAdornment>
          </>
        ),
      }}
      InputLabelProps={{
        shrink: true,
        ...InputLabelProps,
      }}
      placeholder={inputType === 'text' ? 'dd/mm/yyyy' : ''}
      sx={mergedSx}
    />
  );
};
