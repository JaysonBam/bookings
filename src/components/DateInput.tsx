import React, { useState } from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import { format, parseISO, isValid } from 'date-fns';

interface DateInputProps extends Omit<TextFieldProps, 'onChange' | 'value'> {
  value: string; // expects yyyy-MM-dd
  onChange: (value: string) => void;
}

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, onFocus, onBlur, ...props }) => {
  const [inputType, setInputType] = useState<'text' | 'date'>('text');
  
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
    />
  );
};
