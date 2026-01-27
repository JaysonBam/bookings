import React, { useState } from "react";
import { IconButton, TextField, Card, CardContent, Typography, Box, Chip, CircularProgress } from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import { StyledSearchPanel } from "../styles";
import { Booking } from "../hooks/useBookings";

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  loading?: boolean;
  onBookingSelect?: (bookingId: string) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ isOpen, onClose, bookings, loading = false, onBookingSelect }) => {
  const [searchQuery, setSearchQuery] = useState("");

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
                    <Typography variant="subtitle2" fontWeight="bold">{(booking as any).rooms?.name || "Unknown Room"}</Typography>
                    <Chip 
                        label={booking.state} 
                        size="small" 
                        color={booking.state === 'Active' ? 'success' : booking.state === 'Ended' ? 'default' : 'warning'}
                        variant={booking.state === 'Ended' ? 'filled' : 'outlined'}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {booking.start_time.slice(11, 16)} - {booking.end_time.slice(11, 16)}
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
