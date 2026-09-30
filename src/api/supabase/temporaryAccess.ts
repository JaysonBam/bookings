import { supabase } from './client'
import { throwIfError } from './errors'
import type { ProfileRow } from './types'

export type TemporaryAccessCode = {
  id: string
  user_id: string
  label: string
  created_at: string
  expires_at: string
  revoked_at: string | null
  last_used_at: string | null
  login_count: number
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('temporary-access', { body })
  if (error) {
    const context: unknown = (error as { context?: unknown }).context
    if (context instanceof Response) {
      const payload = await context.json().catch(() => null) as { error?: string } | null
      if (payload?.error) throw new Error(payload.error)
    }
    throw new Error('Temporary access is unavailable. Please try again.')
  }
  return data as T
}

export const createTemporaryAccessCode = (label: string, durationHours: number) =>
  invoke<{ id: string; user_id: string; code: string }>({ action: 'create', label, duration_hours: durationHours })

export async function signInWithAccessCode(code: string) {
  const tokens = await invoke<{ access_token: string; refresh_token: string }>({ action: 'login', code })
  const { error } = await supabase.auth.setSession(tokens)
  throwIfError(error, 'Unable to establish the temporary session')
}

export async function getTemporaryAccessProfile(): Promise<ProfileRow | null> {
  const { data, error } = await supabase.rpc('get_temporary_access_session')
  throwIfError(error, 'Unable to validate temporary access')
  const row = (data as Array<{ user_id: string; label: string; expires_at: string }> | null)?.[0]
  if (!row) return null
  return {
    id: row.user_id, email: '', full_name: row.label, profile_url: null, status: 'active',
    authorisation: false, settings: false, analytics: false,
    access_kind: 'temporary', expires_at: row.expires_at,
  }
}

export async function listTemporaryAccessCodes() {
  const { data, error } = await supabase.rpc('list_temporary_access_codes')
  throwIfError(error, 'Unable to load temporary access codes')
  return (data || []) as TemporaryAccessCode[]
}

export async function revokeTemporaryAccessCode(id: string) {
  const { data, error } = await supabase.rpc('revoke_temporary_access_code', { p_id: id })
  throwIfError(error, 'Unable to remove temporary access')
  if (!data) throw new Error('This access code could not be found.')
}
