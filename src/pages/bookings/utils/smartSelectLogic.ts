import { parseISO, differenceInMinutes } from "date-fns";

export interface RoomMetric {
    room: any;
    category: number;
    subCategoryTier2: number;
    hasIssues: boolean;
    overdueMinutes: number;
    lateArrivalMinutes: number;
    minutesAvailable: number;
    name: string;
    isOpen: boolean;
}

export function getOptimalRooms(groupSize: number, allRooms: any[], bookings: any[], now: Date): any[] {
    // 1. Filter by Capacity
    const validRooms = allRooms.filter(r => (r.capacity || 0) >= groupSize);
    
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const endOfDayMins = 24 * 60;

    const roomMetrics = validRooms.map(room => {
        // Calculate Metrics
        const rId = String(room.id);
        const roomBookings = bookings.filter((b: any) => String(b.room_id) === rId);
        
        // Find current and relevant bookings
        let currentBooking: any = null;
        let lastActiveBooking: any = null; // For overdue check
        let nextBookingStart = endOfDayMins;

        roomBookings.forEach((b: any) => {
            const start = parseISO(`${b.booking_day}T${b.start_time}`);
            const end = parseISO(`${b.booking_day}T${b.end_time}`);
            const startMins = start.getHours() * 60 + start.getMinutes();
            
            // Check if current
            if (now >= start && now < end) {
                if (b.state === 'Active' || b.state === 'Reserved') {
                    currentBooking = b;
                }
            }
            
            // Check for overdue (Active and ended in the past)
            if (b.state === 'Active' && now > end) {
                // We want the most recent overdue one if multiple?
                if (!lastActiveBooking || parseISO(`${lastActiveBooking.booking_day}T${lastActiveBooking.end_time}`) < parseISO(`${b.booking_day}T${b.end_time}`)) {
                    lastActiveBooking = b;
                }
            }

            // Find next booking start
            if (start > now) {
                if (startMins < nextBookingStart) {
                    nextBookingStart = startMins;
                }
            }
        });

        let category = 3; // Default Worst
        let subCategoryTier2 = 0; // 1 for Reserved Late, 2 for Overdue
        let lateArrivalMinutes = 0;
        let overdueMinutes = 0;
        let minutesAvailable = 0;

        // Calculate Late Arrival
        if (currentBooking && currentBooking.state === 'Reserved') {
            const start = parseISO(`${currentBooking.booking_day}T${currentBooking.start_time}`);
            lateArrivalMinutes = differenceInMinutes(now, start);
        }

        // Calculate Overdue
        if (lastActiveBooking) {
            const end = parseISO(`${lastActiveBooking.booking_day}T${lastActiveBooking.end_time}`);
            overdueMinutes = differenceInMinutes(now, end);
        }

        // Determine Category
        if (currentBooking) {
            if (currentBooking.state === 'Active') {
                category = 3;
            } else if (currentBooking.state === 'Reserved') {
                if (lateArrivalMinutes >= 30) {
                    category = 1;
                } else if (lateArrivalMinutes > 10) { // 10 < late < 30
                    category = 2;
                    subCategoryTier2 = 1; // Reserved Late
                } else { // <= 10
                    category = 3;
                }
            }
        } else {
            // No current booking
            if (lastActiveBooking) {
                category = 2;
                subCategoryTier2 = 2; // Overdue
            } else {
                category = 1;
            }
        }

        // Calculate Minutes Available
        minutesAvailable = nextBookingStart - nowMins;
        if (minutesAvailable < 0) minutesAvailable = 0;

        // Maintenance
        const hasIssues = room.dynamic_labels && room.dynamic_labels.length > 0;
        const isOpen = room.is_open === true;

        return {
            room,
            category,
            subCategoryTier2,
            hasIssues,
            overdueMinutes,
            lateArrivalMinutes,
            minutesAvailable,
            name: room.name,
            isOpen
        };
    });

    // Sort
    roomMetrics.sort((a, b) => {
        // 1. Category ASC (1 best)
        if (a.category !== b.category) return a.category - b.category;

        // Tier 1 Sorting
        if (a.category === 1) {
            // 1. Preference
            const preferClosed = groupSize >= 4;
            const aIsPreferred = preferClosed ? !a.isOpen : a.isOpen;
            const bIsPreferred = preferClosed ? !b.isOpen : b.isOpen;
            
            if (aIsPreferred !== bIsPreferred) return (bIsPreferred ? 1 : 0) - (aIsPreferred ? 1 : 0);

            // 2. Time Available (Descending)
            if (a.minutesAvailable !== b.minutesAvailable) return b.minutesAvailable - a.minutesAvailable;

            // 3. Maintenance (No issues first)
            if (a.hasIssues !== b.hasIssues) return (a.hasIssues ? 1 : 0) - (b.hasIssues ? 1 : 0);

            // 4. Alpha
            return a.name.localeCompare(b.name);
        }

        // Tier 2 Sorting
        if (a.category === 2) {
            if (a.subCategoryTier2 !== b.subCategoryTier2) return a.subCategoryTier2 - b.subCategoryTier2;

            if (a.subCategoryTier2 === 1) {
                // Reserved Late: Most late first
                if (a.lateArrivalMinutes !== b.lateArrivalMinutes) return b.lateArrivalMinutes - a.lateArrivalMinutes;
            } else {
                // Overdue: Most overdue first
                if (a.overdueMinutes !== b.overdueMinutes) return b.overdueMinutes - a.overdueMinutes;
            }
            return a.name.localeCompare(b.name);
        }

        // Tier 3 Sorting
        if (a.category === 3) {
            return a.name.localeCompare(b.name);
        }
        
        return 0;
    });

    return roomMetrics.filter(m => m.category !== 3).map(m => m.room);
};
