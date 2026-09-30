import { supabase } from './client'
import { throwIfError } from './errors'
import type { BugRow, BugStatus } from './types'

export const getBugs = async (status: BugStatus | 'all' | 'not_fixed') => {
  let query = supabase
    .from('bugs')
    .select('id,created_at,description,reporter_name,upvotes,status,admin_update')
    .order('upvotes', { ascending: false })

  if (status === 'not_fixed') query = query.in('status', ['new', 'acknowledged'])
  else if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  throwIfError(error, 'Failed to load bug reports')
  return (data || []) as BugRow[]
}

export const createBug = async (description: string, reporterName: string) => {
  const { data, error } = await supabase
    .from('bugs')
    .insert([{ description, reporter_name: reporterName }])
    .select('id,created_at,description,reporter_name,upvotes,status,admin_update')
    .single()
  throwIfError(error, 'Failed to report the bug')
  return data as BugRow
}

export const upvoteBug = async (bugId: number) => {
  const { error } = await supabase.rpc('increment_bug_upvotes', { bug_id: bugId })
  throwIfError(error, 'Failed to upvote the bug')
}
