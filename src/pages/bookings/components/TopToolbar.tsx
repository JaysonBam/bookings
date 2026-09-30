/**
 * Purpose: Module logic for pages\bookings\components\TopToolbar.tsx.
 */
import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button, TextField, Box, Chip, IconButton, Tooltip } from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Warning as WarningIcon, Schedule as ScheduleIcon, Sync as SyncIcon, CloudOff as CloudOffIcon } from '@mui/icons-material';
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
    syncState?: 'connecting' | 'synced' | 'offline';
    lastSyncedAt?: Date | null;
    onRefresh?: () => void;
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
    onFilterClick,
    syncState = 'connecting',
    lastSyncedAt,
    onRefresh,
}) => {
  const [localUser, setLocalUser] = useState(currentUser || "");

  useEffect(() => {
    setLocalUser(currentUser || "");
  }, [currentUser]);

  const handleToday = () => onDateChange(new Date());

  const handleDateChange = (val: string) => {
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
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap', gap: 1, width: '100%', py: 0.5, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 1, flexShrink: 0 }}>
            <DateInput
                size="small"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={handleDateChange}
                sx={{ width: { xs: 142, sm: 160 }, bgcolor: 'background.paper', borderRadius: 1 }}
            />

            <Button variant="outlined" color="inherit" size="small" onClick={handleToday}>Today</Button>

            <Button 
                variant="contained" 
                size="small" 
                startIcon={<AddIcon />} 
                onClick={onBookClick}
                color="primary"
            >
                Book
            </Button>
            <Button 
                variant="outlined" 
                size="small" 
                startIcon={<SearchIcon />} 
                onClick={onSearchClick}
                color="inherit"
            >
                Search
            </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 1, flexShrink: 0 }}>
            <Tooltip title={lastSyncedAt ? `Last updated ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for synchronization'}>
                <Chip
                    size="small"
                    variant="outlined"
                    color={syncState === 'offline' ? 'error' : syncState === 'synced' ? 'success' : 'default'}
                    icon={syncState === 'offline' ? <CloudOffIcon /> : <SyncIcon />}
                    label={syncState === 'offline' ? 'Offline' : syncState === 'synced' ? 'Up to date' : 'Syncing'}
                />
            </Tooltip>
            {onRefresh && (
                <Tooltip title="Refresh bookings">
                    <IconButton size="small" aria-label="Refresh bookings" onClick={onRefresh}>
                        <SyncIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}
            {(lateCount > 0 || overdueCount > 0) && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>   
                    {lateCount > 0 && (
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<ScheduleIcon />}
                            onClick={() => onFilterClick?.('late')}
                            sx={{ 
                                bgcolor: 'warning.main',
                                color: 'warning.contrastText',
                                '&:hover': { bgcolor: 'warning.dark' },
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
                                bgcolor: 'error.main',
                                color: 'error.contrastText',
                                '&:hover': { bgcolor: 'error.dark' },
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
