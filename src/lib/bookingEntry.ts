/** Display dates are day/month/year; API dates remain ISO calendar dates. */
export function isBookingDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8, 10));
}
export function displayBookingDate(value: string) {
  return isBookingDate(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '';
}
export function parseBookingDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : '';
  return isBookingDate(iso) ? iso : '';
}
export function isBookingTime(value: string) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
export function timeMinutes(value: string) {
  return isBookingTime(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) : NaN;
}
export function validateSchedule(date: string, time: string, duration: string, hours: { start: string; end: string }) {
  const errors: Record<string, string> = {};
  if (!isBookingDate(date)) errors.startDate = 'Enter a valid date as DD/MM/YYYY.';
  const start = timeMinutes(time);
  const length = Number(duration);
  if (!Number.isFinite(start)) errors.startClock = 'Enter a time as HH:mm (24-hour).';
  else if (start % 30 !== 0) errors.startClock = 'Use a half-hour time, such as 08:00 or 08:30.';
  if (!Number.isInteger(length) || length <= 0 || length % 30 !== 0) errors.duration = 'Choose a duration in 30-minute increments.';
  if (Number.isFinite(start) && (start < timeMinutes(hours.start) || start >= timeMinutes(hours.end))) errors.startClock = `Start between ${hours.start} and ${hours.end}.`;
  if (Number.isFinite(start) && length > 0 && start + length > timeMinutes(hours.end)) errors.duration = `The booking must end by ${hours.end}.`;
  return errors;
}
export interface BookingRange { id: string; start: string; end: string }
export function validateBulkRanges(dates: BookingRange[], times: BookingRange[], hours: { start: string; end: string }) {
  const errors: Record<string, string> = {};
  for (const range of dates) {
    if (!isBookingDate(range.start)) errors[`${range.id}.start`] = 'Enter a start date as DD/MM/YYYY.';
    if (!isBookingDate(range.end)) errors[`${range.id}.end`] = 'Enter an end date as DD/MM/YYYY.';
    if (isBookingDate(range.start) && isBookingDate(range.end) && range.end < range.start) errors[`${range.id}.end`] = 'End date must be on or after start date.';
  }
  for (const range of times) {
    for (const field of ['start', 'end'] as const) {
      const minutes = timeMinutes(range[field]);
      if (!Number.isFinite(minutes)) errors[`${range.id}.${field}`] = 'Enter a time as HH:mm (24-hour).';
      else if (minutes % 30 !== 0) errors[`${range.id}.${field}`] = 'Use a half-hour time, such as 08:00 or 08:30.';
      else if (minutes < timeMinutes(hours.start) || minutes > timeMinutes(hours.end)) errors[`${range.id}.${field}`] = `Use a time between ${hours.start} and ${hours.end}.`;
    }
    if (isBookingTime(range.start) && isBookingTime(range.end) && range.end <= range.start) errors[`${range.id}.end`] = 'End time must be after start time.';
  }
  // Every time range applies to every date; overlapping rows create duplicates.
  for (const [ranges, inclusive, message] of [[dates, true, 'This date range overlaps another row.'], [times, false, 'This time range overlaps another row.']] as const) {
    const valid = ranges.filter(range => !errors[`${range.id}.start`] && !errors[`${range.id}.end`]);
    for (let i = 0; i < valid.length; i++) for (let j = 0; j < i; j++) {
      if (inclusive ? valid[i].start <= valid[j].end && valid[j].start <= valid[i].end : valid[i].start < valid[j].end && valid[j].start < valid[i].end) {
        errors[`${valid[i].id}.start`] = message;
        errors[`${valid[j].id}.start`] = message;
      }
    }
  }
  return errors;
}
