import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { IconButton, TextField, Card, CardContent, Typography, Box, Chip, CircularProgress } from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import { supabase } from "../../../lib/supabaseClient";
import { StyledSearchPanel } from "../styles";

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onBookingSelect?: (bookingId: string) => void;
}

interface Booking {
  id: number;
  room_id: number;
  start_time: string;
  end_time: string;
  state: string;
  student_numbers: string;
  booked_by: string;
  rooms: {
    name: string;
  };
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ isOpen, onClose, selectedDate, onBookingSelect }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchBookings();
    }
  }, [isOpen, selectedDate]);

  const fetchBookings = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
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
        rooms (
          name
        )
      `)
      .eq("booking_day", dateStr);

    if (error) {
      console.error("Error fetching bookings:", error);
    } else {
      setBookings(data as any);
    }
    setLoading(false);
  };

  const filteredBookings = bookings.filter((booking) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const studentNumbers = booking.student_numbers?.toLowerCase() || "";
    const bookedBy = booking.booked_by?.toLowerCase() || "";
    return studentNumbers.includes(query) || bookedBy.includes(query);
  });

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
