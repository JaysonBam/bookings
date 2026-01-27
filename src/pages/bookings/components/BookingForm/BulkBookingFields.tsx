import React from 'react';
import { Grid, Box, TextField, Button, FormControlLabel, Checkbox, FormHelperText, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { BookingFormState } from '../../hooks/useBookingForm';
import { BookingCourseFields } from './BookingCourseFields';

interface BulkBookingFieldsProps {
    form: BookingFormState;
    rooms: any[];
    courses: any[];
}

export const BulkBookingFields: React.FC<BulkBookingFieldsProps> = ({ form, rooms, courses }) => {
    const { 
        bulkDates, setBulkDates, 
        bulkTimes, setBulkTimes, 
        bulkRoomIds, setBulkRoomIds,
        errors
    } = form;

    const addDate = () => setBulkDates([...bulkDates, { start: "", end: "" }]);
    const removeDate = (i: number) => setBulkDates(bulkDates.filter((_, idx) => idx !== i));
    const updateDate = (i: number, field: "start" | "end", val: string) => {
        const newDates = [...bulkDates];
        newDates[i][field] = val;
        setBulkDates(newDates);
    };

    const addTime = () => setBulkTimes([...bulkTimes, { start: "", end: "" }]);
    const removeTime = (i: number) => setBulkTimes(bulkTimes.filter((_, idx) => idx !== i));
    const updateTime = (i: number, field: "start" | "end", val: string) => {
        const newTimes = [...bulkTimes];
        newTimes[i][field] = val;
        setBulkTimes(newTimes);
    };

    const toggleRoom = (rId: string) => {
        setBulkRoomIds(prev => prev.includes(rId) ? prev.filter(id => id !== rId) : [...prev, rId]);
    };

    return (
        <>
            <Grid item xs={12}>
                <Typography variant="subtitle2">Date Ranges</Typography>
                {bulkDates.map((d, i) => (
                    <Box key={i} display="flex" gap={1} mb={1} alignItems="center">
                        <TextField type="date" size="small" value={d.start} onChange={e => updateDate(i, 'start', e.target.value)} error={!!errors.bulkDates && !d.start} />
                        <Typography>to</Typography>
                        <TextField type="date" size="small" value={d.end} onChange={e => updateDate(i, 'end', e.target.value)} error={!!errors.bulkDates && !d.end} />
                        <IconButton onClick={() => removeDate(i)}><CloseIcon /></IconButton>
                    </Box>
                ))}
                <Button size="small" onClick={addDate}>Add Date</Button>
            </Grid>
            <Grid item xs={12}>
                <Typography variant="subtitle2">Time Ranges (HH:mm)</Typography>
                {bulkTimes.map((t, i) => (
                    <Box key={i} display="flex" gap={1} mb={1} alignItems="center">
                        <TextField type="time" size="small" value={t.start} onChange={e => updateTime(i, 'start', e.target.value)} error={!!errors.bulkTimes && !t.start} />
                        <Typography>to</Typography>
                        <TextField type="time" size="small" value={t.end} onChange={e => updateTime(i, 'end', e.target.value)} error={!!errors.bulkTimes && !t.end} />
                        <IconButton onClick={() => removeTime(i)}><CloseIcon /></IconButton>
                    </Box>
                ))}
                <Button size="small" onClick={addTime}>Add Time</Button>
            </Grid>
             <Grid item xs={12}>
                <Typography variant="subtitle2">Rooms</Typography>
                <Box sx={{ border: 1, borderColor: 'divider', p: 1, maxHeight: 150, overflow: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    {rooms.map(r => (
                        <FormControlLabel key={r.id} control={<Checkbox checked={bulkRoomIds.includes(String(r.id))} onChange={() => toggleRoom(String(r.id))} />} label={r.name} />
                    ))}
                </Box>
                {errors.bulkRooms && <FormHelperText error>Select at least one room</FormHelperText>}
            </Grid>
            
            <BookingCourseFields form={form} courses={courses} />
        </>
    );
};
