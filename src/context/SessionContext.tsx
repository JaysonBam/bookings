import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getAuthSession, subscribeToAuthChanges } from '../api/supabase/auth'
import { getProfileByEmail } from '../api/supabase/profiles'
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

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    const version = ++loadVersion.current
    setLoading(true)
    setSession(nextSession)
    if (!nextSession?.user.email) {
      if (version === loadVersion.current) {
        setProfile(null)
        setLoading(false)
      }
      return
    }
    try {
      const nextProfile = await getProfileByEmail(nextSession.user.email)
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
        return
      }
      void loadProfile(nextSession)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo(() => ({ session, profile, loading, refresh }), [session, profile, loading, refresh])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = () => {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
