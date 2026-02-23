import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { IconButton, TextField, Card, CardContent, Typography, Box, CircularProgress, Chip } from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import { supabase } from "../../../lib/supabaseClient";
import { StyledSearchPanel } from "../styles";
import { useNow } from "../context/NowContext";
import { getBookingSoftState } from "../utils/helpers";

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onBookingSelect?: (bookingId: string) => void;
  showToast?: (title: string, description: string, severity?: "success" | "error" | "info") => void;
  initialFilter?: 'late' | 'overdue' | null;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ 
  isOpen, 
  onClose, 
  selectedDate, 
  onBookingSelect, 
  showToast = () => {},
  initialFilter = null
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentTime } = useNow();
  const [filter, setFilter] = useState<'all' | 'Active' | 'Reserved' | 'Ended' | 'late' | 'overdue'>('all');

  useEffect(() => {
    if (isOpen) {
      if (initialFilter) {
          setFilter(initialFilter);
      }
      fetchBookings();
    } else {
        setFilter('all');
        setSearchQuery("");
    }
  }, [isOpen, selectedDate, initialFilter]);

  const fetchBookings = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
    // We fetch ALL bookings for the day, then filter locally. 
    // This allows us to handle soft states (late/overdue) and search text efficiently without complex DB queries.
    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id,
        room_id,
        start_time,
        end_time,
        state,
        student_numbers,
        booked_by,
        booking_day,
        rooms (
          name
        )
      `)
      .eq("booking_day", dateStr);

    if (error) {
      console.error("Search error", error);
      showToast("Error", "Failed to search bookings", "error");
    } else {
      setBookings(data || []);
    }
    setLoading(false);
  };

  const filteredBookings = bookings.filter((booking) => {
    if (currentTime) {
        // Construct full start/end string if needed, or helper
        // booking has booking_day, start_time (HH:mm:ss)
        const bStart = `${booking.booking_day}T${booking.start_time}`;
        const bEnd = `${booking.booking_day}T${booking.end_time}`;
        
        booking.start_time_iso = bStart;
        booking.end_time_iso = bEnd;
    }

    // 1. Text Search
    let matchesSearch = true;
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const studentNumbers = booking.student_numbers?.toLowerCase() || "";
        const bookedBy = booking.booked_by?.toLowerCase() || "";
        const roomName = booking.rooms?.name?.toLowerCase() || "";
        matchesSearch = studentNumbers.includes(query) || bookedBy.includes(query) || roomName.includes(query);
    }
    
    // 2. State Filter
    let matchesFilter = true;
    if (filter !== 'all') {
        if (filter === 'late' || filter === 'overdue') {
             // Use helper for soft states
             // But helper expects booking object structure: { state, start_time, end_time }
             // Our current booking object has start_time as Time string? 
             // Helper expects ISO string for start/end
             
             const mockBooking = {
                 state: booking.state,
                 start_time: booking.start_time_iso,
                 end_time: booking.end_time_iso
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
                <Chip 
                    label="All" 
                    size="small" 
                    onClick={() => handleFilterClick('all')} 
                    color={filter === 'all' ? 'primary' : 'default'} 
                    variant={filter === 'all' ? 'filled' : 'outlined'}
                />
                <Chip 
                    label="Active" 
                    size="small" 
                    onClick={() => handleFilterClick('Active')} 
                    color="success" 
                    variant={filter === 'Active' ? 'filled' : 'outlined'}
                    sx={filter !== 'Active' ? { color: 'success.main', borderColor: 'success.main' } : {}}
                />
                <Chip 
                    label="Reserved" 
                    size="small" 
                    onClick={() => handleFilterClick('Reserved')} 
                    variant={filter === 'Reserved' ? 'filled' : 'outlined'}
                    sx={{ 
                        bgcolor: filter === 'Reserved' ? '#fbc02d' : 'transparent', // Yellow 700
                        color: filter === 'Reserved' ? 'black' : '#f9a825', // Yellow 800
                        borderColor: filter === 'Reserved' ? 'transparent' : '#fbc02d',
                        '&:hover': { bgcolor: filter === 'Reserved' ? '#f9a825' : 'rgba(251, 192, 45, 0.1)' }
                    }}
                />
                <Chip 
                    label="Ended" 
                    size="small" 
                    onClick={() => handleFilterClick('Ended')} 
                    color="default" 
                    variant={filter === 'Ended' ? 'filled' : 'outlined'}
                />
                <Chip 
                    label="Late" 
                    size="small" 
                    onClick={() => handleFilterClick('late')} 
                    sx={{ 
                        bgcolor: filter === 'late' ? '#ff9800' : 'transparent',
                        color: filter === 'late' ? 'white' : '#ff9800',
                        borderColor: filter === 'late' ? 'transparent' : '#ff9800',
                        borderWidth: 1,
                        borderStyle: 'solid',
                        '&:hover': { bgcolor: filter === 'late' ? '#f57c00' : 'rgba(255, 152, 0, 0.1)' }
                    }}
                />
                 <Chip 
                    label="Overdue" 
                    size="small" 
                    onClick={() => handleFilterClick('overdue')} 
                    sx={{ 
                        bgcolor: filter === 'overdue' ? '#f44336' : 'transparent',
                        color: filter === 'overdue' ? 'white' : '#f44336',
                         borderColor: filter === 'overdue' ? 'transparent' : '#f44336',
                        borderWidth: 1,
                        borderStyle: 'solid',
                        '&:hover': { bgcolor: filter === 'overdue' ? '#d32f2f' : 'rgba(244, 67, 54, 0.1)' }
                    }}
                />
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
                        sx={{ 
                            fontSize: '0.7rem', 
                            height: 20, 
                            bgcolor: booking.state === 'Active' ? '#e8f5e9' : booking.state === 'Reserved' ? '#fff3e0' : '#f5f5f5',
                            color: booking.state === 'Active' ? '#2e7d32' : booking.state === 'Reserved' ? '#ef6c00' : '#757575',
                            fontWeight: 'bold'
                        }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                  </Typography>
                  <Typography variant="body2" noWrap title={booking.student_numbers}>
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
