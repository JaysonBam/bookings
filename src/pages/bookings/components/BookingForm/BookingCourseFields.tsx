import React from 'react';
import { Grid, TextField, InputLabel, Select, MenuItem, FormControl } from '@mui/material';
import { BookingFormState } from '../../hooks/useBookingForm';

interface BookingCourseFieldsProps {
    form: BookingFormState;
    courses: any[];
}

export const BookingCourseFields: React.FC<BookingCourseFieldsProps> = ({ form, courses }) => {
    const { 
        selectedCourseId, setSelectedCourseId, 
        otherCourseName, setOtherCourseName,
        errors 
    } = form;

    return (
        <Grid item xs={12}>
            <FormControl fullWidth error={!!errors.selectedCourseId}>
                <InputLabel>Course</InputLabel>
                <Select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value as string)} label="Course">
                    {courses.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
                    <MenuItem value="other">Other</MenuItem>
                </Select>
            </FormControl>
            {selectedCourseId === "other" && (
                <TextField fullWidth sx={{ mt: 1 }} label="Course Name" value={otherCourseName} onChange={e => setOtherCourseName(e.target.value)} error={!!errors.otherCourseName} />
            )}
        </Grid>
    );
};
