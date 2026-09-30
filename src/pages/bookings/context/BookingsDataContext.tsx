import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getBookingsForDate } from '../../../api/supabase/bookings'
import { getCourses } from '../../../api/supabase/courses'
import { getAvailableRooms } from '../../../api/supabase/rooms'
import { getSettings } from '../../../api/supabase/settings'
import {
  removeRealtimeChannel,
  subscribeToBookingChanges,
  subscribeToSettingChanges,
  type BookingRealtimeChange,
  type RealtimeStatus,
} from '../../../api/supabase/realtime'
import type {
  BookingRow,
  CourseRow,
  OperationHours,
  RoomRow,
  SettingRow,
  TestingClock,
} from '../../../api/supabase/types'
import { setTestingClockCache } from '../../../lib/time'
import { getErrorMessage } from '../../../api/supabase/errors'
import { removeBookingRows, upsertBookingRows } from './bookingsCache'

type SyncState = 'connecting' | 'synced' | 'offline'

type BookingsDataValue = {
  rooms: RoomRow[]
  courses: CourseRow[]
  operationHours: { start: string; end: string }
  referenceLoading: boolean
  referenceError: string | null
  syncState: SyncState
  lastSyncedAt: Date | null
  getBookings: (date: string) => BookingRow[]
  getBooking: (id: string | number) => BookingRow | undefined
  isDateLoading: (date: string) => boolean
  isDateRefreshing: (date: string) => boolean
  setActiveDate: (date: string) => void
  ensureDate: (date: string, force?: boolean) => Promise<BookingRow[]>
  refreshDate: (date?: string) => Promise<BookingRow[]>
  upsertBookings: (rows: BookingRow[]) => void
  removeBookings: (ids: Array<string | number>) => void
}

const BookingsDataContext = createContext<BookingsDataValue | null>(null)
const EMPTY_BOOKINGS: BookingRow[] = []

const normalizeHours = (value: OperationHours | undefined) => ({
  start: value?.start ?? value?.open ?? '06:00',
  end: value?.end ?? value?.close ?? '21:00',
})

export function BookingsDataProvider({ children }: { children: React.ReactNode }) {
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [referenceLoading, setReferenceLoading] = useState(true)
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [bookingsByDate, setBookingsByDate] = useState<Record<string, BookingRow[]>>({})
  const [loadingDates, setLoadingDates] = useState<Set<string>>(() => new Set())
  const [refreshingDates, setRefreshingDates] = useState<Set<string>>(() => new Set())
  const [syncState, setSyncState] = useState<SyncState>('connecting')
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  const activeDateRef = useRef('')
  const roomsRef = useRef<RoomRow[]>([])
  const coursesRef = useRef<CourseRow[]>([])
  const bookingsRef = useRef(bookingsByDate)
  const pendingRequests = useRef(new Map<string, Promise<BookingRow[]>>())
  const revalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { roomsRef.current = rooms }, [rooms])
  useEffect(() => { coursesRef.current = courses }, [courses])
  useEffect(() => { bookingsRef.current = bookingsByDate }, [bookingsByDate])

  const attachRelations = useCallback((row: BookingRow) => ({
    ...row,
    rooms: row.rooms ?? (() => {
      const room = roomsRef.current.find((candidate) => candidate.id === Number(row.room_id))
      return room ? { name: room.name } : null
    })(),
    courses: row.courses ?? coursesRef.current.find((course) => course.id === Number(row.course_id)) ?? null,
  }), [])

  const ensureDate = useCallback(async (date: string, force = false) => {
    if (!date) return []
    if (!force && bookingsRef.current[date]) return bookingsRef.current[date]
    const pending = pendingRequests.current.get(date)
    if (pending) return pending

    const hasCachedRows = Boolean(bookingsRef.current[date])
    const updateBusy = (setter: typeof setLoadingDates, busy: boolean) => setter((current) => {
      const next = new Set(current)
      if (busy) next.add(date)
      else next.delete(date)
      return next
    })
    updateBusy(hasCachedRows ? setRefreshingDates : setLoadingDates, true)

    const request = getBookingsForDate(date)
      .then((rows) => {
        const normalized = rows.map(attachRelations)
        setBookingsByDate((current) => {
          const next = { ...current, [date]: normalized }
          bookingsRef.current = next
          return next
        })
        setLastSyncedAt(new Date())
        return normalized
      })
      .finally(() => {
        pendingRequests.current.delete(date)
        updateBusy(hasCachedRows ? setRefreshingDates : setLoadingDates, false)
      })

    pendingRequests.current.set(date, request)
    return request
  }, [attachRelations])

  const refreshDate = useCallback((date = activeDateRef.current) => ensureDate(date, true), [ensureDate])

  const setActiveDate = useCallback((date: string) => {
    activeDateRef.current = date
    void ensureDate(date).catch(() => setSyncState('offline'))
  }, [ensureDate])

  const upsertBookings = useCallback((rows: BookingRow[]) => {
    if (rows.length === 0) return
    setBookingsByDate((current) => {
      const next = upsertBookingRows(current, rows.map(attachRelations))
      bookingsRef.current = next
      return next
    })
  }, [attachRelations])

  const removeBookings = useCallback((ids: Array<string | number>) => {
    setBookingsByDate((current) => {
      const next = removeBookingRows(current, ids)
      bookingsRef.current = next
      return next
    })
  }, [])

  const scheduleRevalidation = useCallback(() => {
    if (revalidateTimer.current) clearTimeout(revalidateTimer.current)
    revalidateTimer.current = setTimeout(() => {
      if (activeDateRef.current) {
        void refreshDate(activeDateRef.current)
          .then(() => setSyncState('synced'))
          .catch(() => setSyncState('offline'))
      }
    }, 350)
  }, [refreshDate])

  const handleRealtimeChange = useCallback((change: BookingRealtimeChange) => {
    if (change.eventType === 'DELETE') {
      if (change.oldRow?.id != null) removeBookings([change.oldRow.id])
      scheduleRevalidation()
      return
    }
    if (change.newRow) upsertBookings([change.newRow])
    setLastSyncedAt(new Date())
    if (
      change.newRow?.booking_day === activeDateRef.current
      || change.oldRow?.booking_day === activeDateRef.current
    ) scheduleRevalidation()
  }, [removeBookings, scheduleRevalidation, upsertBookings])

  const handleRealtimeStatus = useCallback((status: RealtimeStatus) => {
    if (status === 'SUBSCRIBED') {
      setSyncState('synced')
      if (activeDateRef.current) {
        void refreshDate(activeDateRef.current).catch(() => setSyncState('offline'))
      }
    } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
      setSyncState('offline')
    }
  }, [refreshDate])

  useEffect(() => {
    let active = true
    Promise.all([
      getAvailableRooms(),
      getCourses(),
      getSettings(['operation_hours', 'saturday_hours', 'testing_clock']),
    ]).then(([nextRooms, nextCourses, settingRows]) => {
      if (!active) return
      setRooms(nextRooms)
      setCourses(nextCourses)
      const nextSettings = Object.fromEntries(settingRows.map((row) => [row.key, row.value]))
      setSettings(nextSettings)
      setTestingClockCache((nextSettings.testing_clock as TestingClock | undefined) ?? null)
    }).catch((error) => {
      if (active) setReferenceError(getErrorMessage(error, 'Failed to load booking configuration'))
    }).finally(() => active && setReferenceLoading(false))

    const bookingsChannel = subscribeToBookingChanges(handleRealtimeChange, handleRealtimeStatus)
    const settingsChannel = subscribeToSettingChanges((setting: SettingRow) => {
      setSettings((current) => ({ ...current, [setting.key]: setting.value }))
      if (setting.key === 'testing_clock') setTestingClockCache(setting.value as TestingClock)
    })

    const reconcile = () => {
      if (navigator.onLine && activeDateRef.current) {
        setSyncState('connecting')
        void refreshDate(activeDateRef.current)
          .then(() => setSyncState('synced'))
          .catch(() => setSyncState('offline'))
      } else if (!navigator.onLine) {
        setSyncState('offline')
      }
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') reconcile() }
    window.addEventListener('online', reconcile)
    window.addEventListener('offline', reconcile)
    window.addEventListener('focus', reconcile)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      active = false
      if (revalidateTimer.current) clearTimeout(revalidateTimer.current)
      window.removeEventListener('online', reconcile)
      window.removeEventListener('offline', reconcile)
      window.removeEventListener('focus', reconcile)
      document.removeEventListener('visibilitychange', onVisibility)
      void removeRealtimeChannel(bookingsChannel)
      void removeRealtimeChannel(settingsChannel)
    }
  }, [handleRealtimeChange, handleRealtimeStatus, refreshDate])

  const getBookings = useCallback((date: string) => bookingsByDate[date] ?? EMPTY_BOOKINGS, [bookingsByDate])
  const getBooking = useCallback((id: string | number) => {
    const numericId = Number(id)
    return Object.values(bookingsByDate).flat().find((booking) => Number(booking.id) === numericId)
  }, [bookingsByDate])

  const value = useMemo<BookingsDataValue>(() => ({
    rooms,
    courses,
    operationHours: normalizeHours(settings.operation_hours as OperationHours | undefined),
    referenceLoading,
    referenceError,
    syncState,
    lastSyncedAt,
    getBookings,
    getBooking,
    isDateLoading: (date) => loadingDates.has(date),
    isDateRefreshing: (date) => refreshingDates.has(date),
    setActiveDate,
    ensureDate,
    refreshDate,
    upsertBookings,
    removeBookings,
  }), [
    rooms, courses, settings.operation_hours, referenceLoading, referenceError, syncState, lastSyncedAt,
    getBookings, getBooking, loadingDates, refreshingDates, setActiveDate, ensureDate,
    refreshDate, upsertBookings, removeBookings,
  ])

  return <BookingsDataContext.Provider value={value}>{children}</BookingsDataContext.Provider>
}

export const useBookingsData = () => {
  const value = useContext(BookingsDataContext)
  if (!value) throw new Error('useBookingsData must be used inside BookingsDataProvider')
  return value
}
