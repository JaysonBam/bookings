export type BookingState = 'Active' | 'Reserved' | 'Ended'

export type CourseRow = {
  id: number
  name: string
  color_hex?: string | null
}

export type RoomRow = {
  id: number
  name: string
  max_people?: number | null
  min_people?: number | null
  is_available?: boolean | null
  dynamic_labels?: string[] | null
  borrowable_items?: string[] | null
}

export type BookingRow = {
  id: number
  room_id: number
  course_id?: number | null
  course_name?: string | null
  start_time: string
  end_time: string
  booking_day: string
  student_numbers?: string | null
  borrowed_items?: string[] | null
  booked_by: string
  bulk_booking_id?: string | null
  state: BookingState
  rooms?: { name: string } | null
  courses?: CourseRow | null
}

export type BookingWrite = Omit<BookingRow, 'id' | 'rooms' | 'courses'> & {
  id?: never
}

export type BookingUpdate = Partial<Omit<BookingRow, 'id' | 'rooms' | 'courses'>>

export type ReportBookingRow = Pick<
  BookingRow,
  'id' | 'room_id' | 'course_id' | 'course_name' | 'start_time' | 'end_time' |
  'booking_day' | 'student_numbers' | 'booked_by' | 'bulk_booking_id'
>

export type ProfileRow = {
  access_kind?: 'regular' | 'temporary'
  expires_at?: string
  email: string
  full_name: string | null
  profile_url: string | null
  status: 'active' | 'pending'
  settings: boolean
  authorisation: boolean
  analytics: boolean
  id?: string | null
}

export type SettingKey = 'operation_hours' | 'saturday_hours' | 'testing_clock'

export type SettingRow<T = unknown> = {
  key: string
  value: T
  updated_at?: string
}

export type TestingClock = {
  enabled: boolean
  date?: string
  time?: string
}

export type OperationHours = {
  start?: string
  end?: string
  open?: string
  close?: string
}

export type SaturdayHours = {
  enabled: boolean
  start?: string
  end?: string
}

export type BugStatus = 'new' | 'acknowledged' | 'fixed'

export type BugRow = {
  id: number
  created_at: string
  description: string
  reporter_name: string
  upvotes: number
  status: BugStatus
  admin_update: string | null
}
