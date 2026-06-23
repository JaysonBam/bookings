import { supabase } from './supabaseClient'

const HEXFORGE_SUPABASE_URL = import.meta.env.VITE_HEXFORGE_SUPABASE_URL as string
const HEXFORGE_SUPABASE_ANON_KEY = import.meta.env.VITE_HEXFORGE_SUPABASE_ANON_KEY as string
const HEXFORGE_ACCESS_FUNCTION = 'bookings-profile-access'

export type HexForgeProfile = {
  email: string
  full_name: string | null
  profile_url: string | null
  status: 'active' | 'pending'
}

type HexForgeAccessResponse<T> = {
  data?: T
  error?: string
  error_description?: string
}

const getBookingsAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('You must be signed in to manage HexForge access.')
  return token
}

const requestHexForgeAccess = async <T>(path = '', init: RequestInit = {}) => {
  if (!HEXFORGE_SUPABASE_URL || !HEXFORGE_SUPABASE_ANON_KEY) {
    throw new Error('HexForge access is not configured.')
  }

  const token = await getBookingsAccessToken()
  const url = `${HEXFORGE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${HEXFORGE_ACCESS_FUNCTION}${path}`

  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: HEXFORGE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  })

  const payload = await response.json().catch(() => ({})) as HexForgeAccessResponse<T>

  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `HexForge request failed (${response.status})`)
  }

  return payload.data as T
}

export const fetchHexForgeProfiles = () =>
  requestHexForgeAccess<HexForgeProfile[]>()

export const addHexForgeProfile = (email: string) =>
  requestHexForgeAccess<HexForgeProfile>('', {
    method: 'POST',
    body: JSON.stringify({ email })
  })

export const deleteHexForgeProfile = (email: string) =>
  requestHexForgeAccess<void>(`?email=${encodeURIComponent(email)}`, {
    method: 'DELETE'
  })
