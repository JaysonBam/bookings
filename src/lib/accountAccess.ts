import type { ProfileRow } from '../api/supabase/types'

export const isTemporaryProfile = (profile: ProfileRow | null) => profile?.access_kind === 'temporary'
export function hasAppAccess(profile: ProfileRow | null, now = Date.now()) {
  if (!profile || profile.status !== 'active') return false
  if (!isTemporaryProfile(profile)) return true
  return Boolean(profile.expires_at && Date.parse(profile.expires_at) > now)
}
export const canUseCollections = (profile: ProfileRow | null) => hasAppAccess(profile) && !isTemporaryProfile(profile)
