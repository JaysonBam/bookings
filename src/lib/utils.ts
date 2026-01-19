import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBookingSoftState(booking: any, now: Date): 'late' | 'overdue' | null {
  if (!booking) return null;
  
  // Late: Reserved and now > start + 10 mins
  if (booking.state === 'Reserved') {
    let startT = new Date(booking.start_time);
    if (booking.booking_day && booking.start_time) {
        startT = new Date(`${booking.booking_day}T${booking.start_time}`);
    }
    
    const lateThreshold = new Date(startT.getTime() + 10 * 60000);
    if (now > lateThreshold) {
      return 'late';
    }
  }
  
  // Overdue: Active and now > end
  if (booking.state === 'Active') {
    let endT = new Date(booking.end_time);
    if (booking.booking_day && booking.end_time) {
        endT = new Date(`${booking.booking_day}T${booking.end_time}`);
    }
    
    if (now > endT) {
      return 'overdue';
    }
  }
  
  return null;
}
