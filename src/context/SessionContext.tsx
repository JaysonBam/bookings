import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getAuthSession, subscribeToAuthChanges } from '../api/supabase/auth'
import { getProfileByEmail } from '../api/supabase/profiles'
import { getTemporaryAccessProfile } from '../api/supabase/temporaryAccess'
import { isTemporaryProfile } from '../lib/accountAccess'
import type { ProfileRow } from '../api/supabase/types'

type SessionContextValue = {
  session: Session | null
  profile: ProfileRow | null
  loading: boolean
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)
  const loadVersion = useRef(0)

  const loadProfile = useCallback(async (nextSession: Session | null, showLoading = true) => {
    const version = ++loadVersion.current
    if (showLoading) setLoading(true)
    setSession(nextSession)
    if (!nextSession) {
      if (version === loadVersion.current) {
        setProfile(null)
        setLoading(false)
      }
      return
    }
    try {
      const nextProfile = nextSession.user.app_metadata.access_kind === 'temporary'
        ? await getTemporaryAccessProfile()
        : nextSession.user.email ? await getProfileByEmail(nextSession.user.email) : null
      if (version === loadVersion.current) setProfile(nextProfile)
    } catch {
      if (version === loadVersion.current) setProfile(null)
    } finally {
      if (version === loadVersion.current) setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    await loadProfile(await getAuthSession())
  }, [loadProfile])

  useEffect(() => {
    let active = true
    getAuthSession()
      .then((nextSession) => {
        if (active) return loadProfile(nextSession)
      })
      .catch(() => active && setLoading(false))

    const subscription = subscribeToAuthChanges((event, nextSession) => {
      if (!active) return
      if (event === 'TOKEN_REFRESHED') {
        setSession(nextSession)
        if (nextSession?.user.app_metadata.access_kind === 'temporary') {
          void loadProfile(nextSession, false)
        }
        return
      }
      void loadProfile(nextSession)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  useEffect(() => {
    if (!session || !isTemporaryProfile(profile)) return
    const revalidate = () => { void loadProfile(session, false) }
    const interval = window.setInterval(revalidate, 15000)
    const expiry = window.setTimeout(revalidate, Math.max(0, Date.parse(profile!.expires_at!) - Date.now()))
    const onVisibility = () => { if (document.visibilityState === 'visible') revalidate() }
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(expiry)
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [loadProfile, profile, session])

  const value = useMemo(() => ({ session, profile, loading, refresh }), [session, profile, loading, refresh])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = () => {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
