import { supabase } from './client'
import { throwIfError } from './errors'
import type { ProfileRow } from './types'

const PROFILE_COLUMNS = 'id,email,full_name,profile_url,status,settings,authorisation,analytics'
const pendingProfiles = new Map<string, Promise<ProfileRow>>()

export const getProfileByEmail = async (email: string) => {
  const key = email.trim().toLowerCase()
  const pending = pendingProfiles.get(key)
  if (pending) return pending

  const request = (async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('email', email)
      .single()
    throwIfError(error, 'Failed to load the user profile')
    return data as ProfileRow
  })().finally(() => pendingProfiles.delete(key))

  pendingProfiles.set(key, request)
  return request
}

export const getProfiles = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('email')
  throwIfError(error, 'Failed to load user profiles')
  return (data || []) as ProfileRow[]
}

export const updateProfile = async (email: string, updates: Partial<ProfileRow>) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('email', email)
    .select(PROFILE_COLUMNS)
    .single()
  throwIfError(error, 'Failed to update the user profile')
  return data as ProfileRow
}

export const addProfile = async (email: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .insert([{ email, status: 'pending' }])
    .select(PROFILE_COLUMNS)
    .single()
  throwIfError(error, 'Failed to add the user')
  return data as ProfileRow
}

export const deleteProfile = async (email: string) => {
  const { error } = await supabase.from('profiles').delete().eq('email', email)
  throwIfError(error, 'Failed to remove the user')
}
