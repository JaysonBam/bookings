import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from './client'
import { throwIfError } from './errors'

export const getAuthSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  throwIfError(error, 'Failed to load the current session')
  return data.session
}

export const getAccessToken = async (message = 'You must be signed in.') => {
  const session = await getAuthSession()
  if (!session?.access_token) throw new Error(message)
  return session.access_token
}

export const signOut = async () => {
  // One shared code may have several sessions; signing out affects this device.
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  throwIfError(error, 'Failed to sign out')
}

export const signInWithGoogle = async (redirectTo: string) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: 'openid email profile',
    },
  })
  throwIfError(error, 'Failed to start Google sign-in')
  return data
}

export const subscribeToAuthChanges = (
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) => supabase.auth.onAuthStateChange(callback).data.subscription
