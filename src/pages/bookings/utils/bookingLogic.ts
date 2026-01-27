import { addMinutes } from "date-fns";

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

export function roundToNearest30(date: Date): Date {
  const ms = 1000 * 60 * 30;
  return new Date(Math.round(date.getTime() / ms) * ms);
}

export function roundUpToNearest30(date: Date): Date {
  const ms = 1000 * 60 * 30;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

export function generateTimeSlots(startStr: string, endStr: string, selectedDate: Date): Date[] {
    const [sh, sm] = startStr.split(":").map(Number);
    const [eh, em] = endStr.split(":").map(Number);
    const start = new Date(selectedDate);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(eh, em, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);

    const slots: Date[] = [];
    let cur = new Date(start);
    while (cur < end) {
      slots.push(new Date(cur));
      cur = addMinutes(cur, 30);
    }
    return slots;
}

export function formatBorrowedItems(items: string[]): string {
  if (!items || items.length === 0) return '';
  const lowercasedItems = items.map((item: string) => item.toLowerCase());
  const itemsList = lowercasedItems.join(', ');
  const lastIndex = itemsList.lastIndexOf(', ');
  return lastIndex !== -1 
      ? itemsList.substring(0, lastIndex) + ' and ' + itemsList.substring(lastIndex + 2)
      : itemsList;
}

// Logic for default panel time (nearest 30)
export function getSmartPanelTime(now: Date): Date {
    const mins = now.getMinutes();
    const result = new Date(now);
    const rem = mins % 30;
    
    // Original logic from handleBookClick
    if (rem < 15) result.setMinutes(mins - rem);
    else result.setMinutes(mins + (30 - rem));
    
    result.setSeconds(0, 0);
    return result;
}
