import React from 'react';
import { Grid, Box, TextField, MenuItem, Button, FormControlLabel, Checkbox, Typography } from '@mui/material';
import { BookingFormState } from '../../hooks/useBookingForm';
import { BookingCourseFields } from './BookingCourseFields';

interface SingleBookingFieldsProps {
    form: BookingFormState;
    rooms: any[];
    courses: any[];
    isEditing: boolean;
    getRoomStatus: (id: string) => any;
    onSmartSelect?: () => void;
    onNextRanked?: () => void;
    isSmartSelecting?: boolean;
    rankLabel?: string;
}

export const SingleBookingFields: React.FC<SingleBookingFieldsProps> = ({ 
    form, rooms, courses, isEditing, getRoomStatus, onSmartSelect, onNextRanked, isSmartSelecting, rankLabel 
}) => {
    const { 
        roomId, setRoomId, 
        startDate, setStartDate, 
        startClock, setStartClock, 
        duration, setDuration, 
        staffName, setStaffName,
        studentNumbers, setStudentNumbers,
        borrowableItems, selectedBorrowed, toggleBorrowed,
        availableDurationOptions, errors
    } = form;

    return (
        <>
            <Grid item xs={12}>
                <Box display="flex" gap={1} alignItems="flex-start">
                    <TextField 
                        select 
                        fullWidth 
                        label="Room" 
                        value={roomId} 
                        onChange={(e) => setRoomId(e.target.value)}
                        error={!!errors.roomId}
                    >
                        {rooms.map(r => {
                            const status = getRoomStatus(String(r.id));
                            if (String(r.id) !== String(roomId) && (status?.text === 'Occupied' || (status?.text === 'Reserved' && !status.text.includes('late')))) return null;
                            return (
                                <MenuItem key={r.id} value={String(r.id)}>
                                    <Box display="flex" justifyContent="space-between" width="100%">
                                        <Typography color={status?.color || 'inherit'}>{r.name} {status?.text && `(${status.text})`}</Typography>
                                    </Box>
                                </MenuItem>
                            );
                        })}
                    </TextField>
                    {!isEditing && (
                        isSmartSelecting && onNextRanked ? (
                            <Button variant="outlined" onClick={onNextRanked} sx={{ height: 56, textTransform: 'none', lineHeight: 1.2, minWidth: 120, ml: 1 }}>
                                Next {rankLabel}
                            </Button>
                        ) : onSmartSelect && (
                            <Button variant="outlined" onClick={onSmartSelect} sx={{ height: 56, minWidth: 120, ml: 1 }}>
                                Smart Select
                            </Button>
                        )
                    )}
                </Box>
            </Grid>
            <Grid item xs={6}>
                <TextField type="date" fullWidth label="Date" value={startDate} onChange={e => setStartDate(e.target.value)} error={!!errors.startDate} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
                <TextField type="time" fullWidth label="Start Time" value={startClock} onChange={e => setStartClock(e.target.value)} error={!!errors.startClock} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
                <TextField select fullWidth label="Duration" value={duration} onChange={e => setDuration(e.target.value)} error={!!errors.duration}>
                    {availableDurationOptions.map(d => <MenuItem key={d} value={String(d)}>{d} mins</MenuItem>)}
                </TextField>
            </Grid>
             <Grid item xs={6}>
                <TextField fullWidth label="Staff Name" value={staffName} onChange={e => setStaffName(e.target.value)} error={!!errors.staffName} />
            </Grid>
            
            <BookingCourseFields form={form} courses={courses} />

            {/* Student & Borrowed Items - Only for single booking */}
            <Grid item xs={12}>
                <TextField multiline rows={3} fullWidth label="Student Numbers" value={studentNumbers} onChange={e => setStudentNumbers(e.target.value)} />
            </Grid>
            <Grid item xs={12}>
                <Typography variant="subtitle2">Borrowed Items</Typography>
                {borrowableItems.length === 0 ? <Typography variant="caption">None available</Typography> : (
                    <Box>
                        {borrowableItems.map(it => (
                            <FormControlLabel key={it} control={<Checkbox checked={!!selectedBorrowed[it]} onChange={() => toggleBorrowed(it)} />} label={it} />
                        ))}
                    </Box>
                )}
            </Grid>
        </>
    );
};
