import { supabase } from './supabaseClient'

const HEXFORGE_SUPABASE_URL = import.meta.env.VITE_HEXFORGE_SUPABASE_URL as string
const HEXFORGE_SUPABASE_ANON_KEY = import.meta.env.VITE_HEXFORGE_SUPABASE_ANON_KEY as string
const HEXFORGE_COLLECTION_FUNCTION = 'bookings-collection'

export type HexForgeCollectionBoardItem = {
  project_code: string
  student_name: string
  student_number: string
  state: string
  group: 'help_desk' | 'partially_ready' | null
  print_label: string | null
  total_parts: number
  completed_parts: number
  collected_parts: number
  remaining_parts: number
  all_parts_completed: boolean
  thumbnail_url: string | null
  thumbnail_part_name: string | null
  thumbnail_weight: number
  payment_outstanding: boolean
  last_activity_at: string | null
}

export type HexForgeCollectionEmailDraft = {
  to: string
  subject: string
  body: string
}

export type HexForgeCollectionPart = {
  part_id: string
  part_number: number
  part_name: string
  print_status: string
  print_status_label: string
  thumbnail_url: string | null
  printer_name: string | null
  primary_material: string | null
  primary_brand: string | null
  primary_estimated_weight: number | null
  secondary_material: string | null
  secondary_brand: string | null
  secondary_estimated_weight: number | null
  total_cost: number
  collection?: {
    collected_by: string | null
    collected_by_student_number: string | null
    collected_at: string | null
    special_instruction: string | null
  }
}

export type HexForgeCollectionProject = {
  project_code: string
  collection_code: string | null
  state: string
  state_label: string
  state_description: string
  created_at: string
  course: string | null
  lecturer: string | null
  cost_total: number
  currency: string
  payment: {
    needs_payment: boolean
    payment_state_label: string
    receipt_number: string | null
    module_paid: boolean | null
    override_applied: boolean | null
  }
  part_summary: {
    total_parts: number
    completed_parts: number
    printing_parts: number
    queued_parts: number
  }
  parts: HexForgeCollectionPart[]
  collection?: {
    student_name: string
    student_number: string
    print_label: string | null
    receipt_number: string | null
    needs_payment: boolean
    module_or_lecturer_pays: boolean
    created_at: string
  }
}

type HexForgeCollectionResponse<T> = {
  data?: T
  error?: string
  error_description?: string
}

const getBookingsAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('You must be signed in to use collection tools.')
  return token
}

const requestHexForgeCollection = async <T>(path = '', init: RequestInit = {}) => {
  if (!HEXFORGE_SUPABASE_URL || !HEXFORGE_SUPABASE_ANON_KEY) {
    throw new Error('HexForge collection access is not configured.')
  }

  const token = await getBookingsAccessToken()
  const url = `${HEXFORGE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${HEXFORGE_COLLECTION_FUNCTION}${path}`

  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: HEXFORGE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  })

  const payload = await response.json().catch(() => ({})) as HexForgeCollectionResponse<T>

  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `HexForge collection request failed (${response.status})`)
  }

  return payload.data as T
}

export const fetchHexForgeCollectionBoard = () =>
  requestHexForgeCollection<HexForgeCollectionBoardItem[]>('/board')

export const searchHexForgeCollection = (query: string) =>
  requestHexForgeCollection<HexForgeCollectionBoardItem[]>(`/search?q=${encodeURIComponent(query)}`)

export const fetchHexForgeCollectionProject = (projectCode: string) =>
  requestHexForgeCollection<HexForgeCollectionProject>(`?code=${encodeURIComponent(projectCode)}`)

export const saveHexForgeCollectionReceipt = (projectCode: string, receiptNumber: string) =>
  requestHexForgeCollection<HexForgeCollectionProject>('/receipt', {
    method: 'PATCH',
    body: JSON.stringify({ projectCode, receiptNumber })
  })

export const collectHexForgeParts = (
  projectCode: string,
  partIds: string[],
  collectorName: string,
  collectedByStudentNumber: string
) =>
  requestHexForgeCollection<{ project: HexForgeCollectionProject }>('/collect', {
    method: 'POST',
    body: JSON.stringify({ projectCode, partIds, collectorName, collectedByStudentNumber })
  })

export const releaseHexForgeCollectionProject = (projectCode: string, printLabel?: string) =>
  requestHexForgeCollection<{ project: HexForgeCollectionProject; warnings: string[] }>('/release', {
    method: 'POST',
    body: JSON.stringify({ projectCode, printLabel })
  })

export const prepareHexForgeCollectionEmail = (projectCode: string) =>
  requestHexForgeCollection<HexForgeCollectionEmailDraft>('/email', {
    method: 'POST',
    body: JSON.stringify({ projectCode })
  })
