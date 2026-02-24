import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button, TextField, Box } from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Warning as WarningIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import { DateInput } from "../../../components/DateInput";

interface TopToolbarProps {
  selectedDate: Date;
  onDateChange: (d: Date) => void;
  onBookClick: () => void;
  onSearchClick?: () => void;
  currentUser?: string;
  onUserChange?: (name: string) => void;
    lateCount?: number;
    overdueCount?: number;
    onFilterClick?: (filter: 'late' | 'overdue') => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({ 
    selectedDate, 
    onDateChange, 
    onBookClick, 
    onSearchClick, 
    currentUser, 
    onUserChange,
    lateCount = 0,
    overdueCount = 0,
    onFilterClick
}) => {
  const [localUser, setLocalUser] = useState(currentUser || "");

  useEffect(() => {
    setLocalUser(currentUser || "");
  }, [currentUser]);

  const handleToday = () => onDateChange(new Date());

  const handleDateChange = (val: string) => {
      // Input is yyyy-MM-dd
      if (val) {
          const [y, m, d] = val.split('-').map(Number);
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
            <DateInput
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
            {(lateCount > 0 || overdueCount > 0) && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>   
                    {lateCount > 0 && (
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<ScheduleIcon />}
                            onClick={() => onFilterClick?.('late')}
                            sx={{ 
                                bgcolor: '#ff9800', // Orange
                                color: 'white',
                                '&:hover': { bgcolor: '#f57c00' },
                                fontWeight: 'bold',
                                boxShadow: 1
                            }}
                        >
                            Late: {lateCount}
                        </Button>
                    )}
                    {overdueCount > 0 && (
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<WarningIcon />}
                            onClick={() => onFilterClick?.('overdue')}
                            sx={{ 
                                bgcolor: '#f44336', // Red
                                color: 'white',
                                '&:hover': { bgcolor: '#d32f2f' },
                                fontWeight: 'bold',
                                boxShadow: 1
                            }}
                        >
                            Overdue: {overdueCount}
                        </Button>
                    )}
                </Box>
            )}

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
