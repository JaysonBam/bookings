/**
 * Purpose: Module logic for pages\bookings\components\SearchPanel.tsx.
 */
import React, { useState, useEffect } from "react";
import { IconButton, TextField, Card, CardContent, Typography, Box, Chip, CircularProgress } from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import { StyledSearchPanel } from "../styles";
import { useNow } from "../context/NowContext";
import { getBookingSoftState } from "../utils/helpers";
import type { BookingRow } from '../../../api/supabase/types'

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  bookings: BookingRow[];
  loading?: boolean;
  onBookingSelect?: (bookingId: string) => void;
  showToast?: (title: string, description: string, severity?: "success" | "error" | "info") => void;
  initialFilter?: 'late' | 'overdue' | null;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ isOpen, onClose, selectedDate, bookings, loading = false, onBookingSelect, initialFilter = null }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { currentTime } = useNow();
  const [filter, setFilter] = useState<'all' | 'Active' | 'Reserved' | 'Ended' | 'late' | 'overdue'>('all');

  useEffect(() => {
    if (isOpen) {
      if (initialFilter) {
          setFilter(initialFilter);
      }
    } else {
      setFilter('all');
      setSearchQuery("");
    }
  }, [isOpen, selectedDate, initialFilter]);

  const filteredBookings = bookings.filter((booking) => {
    const startTimeIso = `${booking.booking_day}T${booking.start_time}`;
    const endTimeIso = `${booking.booking_day}T${booking.end_time}`;
    let matchesSearch = true;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const studentNumbers = booking.student_numbers?.toLowerCase() || "";
      const bookedBy = booking.booked_by?.toLowerCase() || "";
      const roomName = booking.rooms?.name?.toLowerCase() || "";
      matchesSearch = studentNumbers.includes(query) || bookedBy.includes(query) || roomName.includes(query);
    }
    let matchesFilter = true;
    if (filter !== 'all') {
      if (filter === 'late' || filter === 'overdue') {
        const mockBooking = {
          state: booking.state,
          start_time: startTimeIso,
          end_time: endTimeIso
        };
        const soft = getBookingSoftState(mockBooking, currentTime || new Date());
        matchesFilter = soft === filter;
      } else {
        matchesFilter = booking.state === filter;
      }
    }
    return matchesSearch && matchesFilter;
  });

  const handleFilterClick = (newFilter: typeof filter) => {
    setFilter(prev => prev === newFilter ? 'all' : newFilter);
  };

  return (
    <StyledSearchPanel isOpen={isOpen} elevation={3}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight="bold">Search Bookings</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
            fullWidth
            placeholder="Search student number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
            }}
            variant="outlined"
            size="small"
        />
        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip label="All" size="small" onClick={() => handleFilterClick('all')} color={filter === 'all' ? 'primary' : 'default'} variant={filter === 'all' ? 'filled' : 'outlined'} />
          <Chip label="Active" size="small" onClick={() => handleFilterClick('Active')} color="success" variant={filter === 'Active' ? 'filled' : 'outlined'} sx={filter !== 'Active' ? { color: 'success.main', borderColor: 'success.main' } : {}} />
          <Chip label="Reserved" size="small" onClick={() => handleFilterClick('Reserved')} color="warning" variant={filter === 'Reserved' ? 'filled' : 'outlined'} />
          <Chip label="Ended" size="small" onClick={() => handleFilterClick('Ended')} color="default" variant={filter === 'Ended' ? 'filled' : 'outlined'} />
          <Chip label="Late" size="small" onClick={() => handleFilterClick('late')} color="warning" variant={filter === 'late' ? 'filled' : 'outlined'} />
          <Chip label="Overdue" size="small" onClick={() => handleFilterClick('overdue')} color="error" variant={filter === 'overdue' ? 'filled' : 'outlined'} />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : filteredBookings.length === 0 ? (
            <Typography align="center" color="text.secondary" sx={{ py: 4 }}>No bookings found</Typography>
          ) : (
            filteredBookings.map((booking) => (
              <Card 
                key={booking.id} 
                sx={{ mb: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                onClick={() => onBookingSelect?.(String(booking.id))}
                variant="outlined"
              >
                <CardContent sx={{ p: '12px !important' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight="bold">{booking.rooms?.name || "Unknown Room"}</Typography>
                    <Chip 
                        label={booking.state} 
                        size="small" 
                        color={booking.state === 'Active' ? 'success' : booking.state === 'Ended' ? 'default' : 'warning'}
                        variant={booking.state === 'Ended' ? 'filled' : 'outlined'}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                  </Typography>
                  <Typography variant="body2" noWrap title={booking.student_numbers ?? undefined}>
                    {booking.student_numbers || booking.booked_by}
                  </Typography>
                </CardContent>
              </Card>
            ))
          )}
      </Box>
    </StyledSearchPanel>
  );
};

export default SearchPanel;
