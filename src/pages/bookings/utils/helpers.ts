import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBookingSoftState(booking: any, now: Date): 'late' | 'overdue' | null {
  if (!booking) return null;
  
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);
  
  // Late: Reserved and now > start + 10 mins
  if (booking.state === 'Reserved') {
    const lateThreshold = new Date(start.getTime() + 10 * 60000);
    if (now > lateThreshold) {
      return 'late';
    }
  }
  
  // Overdue: Active and now > end
  if (booking.state === 'Active') {
    if (now > end) {
      return 'overdue';
    }
  }
  
  return null;
}

export function getTextColorForBackground(backgroundColor: string): string {
  // Convert hex to RGB
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate brightness (YIQ formula)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

  // Return black for light backgrounds, white for dark backgrounds
  return yiq >= 128 ? 'text-black' : 'text-white';
}

export function roundToNearest30(date: Date): Date {
  const ms = 1000 * 60 * 30;
  return new Date(Math.round(date.getTime() / ms) * ms);
}

export function roundUpToNearest30(date: Date): Date {
  const ms = 1000 * 60 * 30;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}
