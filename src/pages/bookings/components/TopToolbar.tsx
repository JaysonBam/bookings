import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button, TextField, Box } from '@mui/material';
import { Add as AddIcon, Search as SearchIcon } from '@mui/icons-material';

interface TopToolbarProps {
  selectedDate: Date;
  onDateChange: (d: Date) => void;
  onBookClick: () => void;
  onSearchClick?: () => void;
  currentUser?: string;
  onUserChange?: (name: string) => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({ selectedDate, onDateChange, onBookClick, onSearchClick, currentUser, onUserChange }) => {
  const [localUser, setLocalUser] = useState(currentUser || "");

  useEffect(() => {
    setLocalUser(currentUser || "");
  }, [currentUser]);

  const handleToday = () => onDateChange(new Date());

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      // valueAsDate returns a Date object in UTC, but input type="date" works with local date string YYYY-MM-DD.
      // We need to be careful with timezone shifts if using valueAsDate directly if logic expects local midnight.
      // But typically valueAsDate is fine for "Set to this date".
      // Actually, safest is to parse the YYYY-MM-DD string as local time.
      if (event.target.value) {
          const [y, m, d] = event.target.value.split('-').map(Number);
          onDateChange(new Date(y, m - 1, d));
      }
  };

  const handleUserBlur = () => {
      if (onUserChange && localUser !== currentUser) {
          onUserChange(localUser);
      }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Date Picker using native input styled as textfield */}
            <TextField
                type="date"
                size="small"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={handleDateChange}
                sx={{ width: 160, bgcolor: 'background.paper', borderRadius: 1 }}
            />

            <Button variant="outlined" color="inherit" size="small" onClick={handleToday}>TODAY</Button>

            <Button 
                variant="contained" 
                size="small" 
                startIcon={<AddIcon />} 
                onClick={onBookClick}
                color="primary"
            >
                BOOK
            </Button>
            <Button 
                variant="outlined" 
                size="small" 
                startIcon={<SearchIcon />} 
                onClick={onSearchClick}
                color="inherit"
            >
                SEARCH
            </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {onUserChange && (
                <TextField
                    size="small"
                    placeholder="Employee Name"
                    value={localUser}
                    onChange={(e) => setLocalUser(e.target.value)}
                    onBlur={handleUserBlur}
                    sx={{ width: { xs: 150, sm: 200 }, bgcolor: 'background.paper', borderRadius: 1 }}
                />
            )}
        </Box>
    </Box>
  );
};

export default TopToolbar;
