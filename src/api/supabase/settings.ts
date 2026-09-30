import { supabase } from './client'
import { throwIfError } from './errors'
import type { SettingKey, SettingRow } from './types'

export const getSetting = async <T>(key: SettingKey): Promise<T | null> => {
  const { data, error } = await supabase
    .from('settings')
    .select('key,value,updated_at')
    .eq('key', key)
    .maybeSingle()
  throwIfError(error, `Failed to load ${key}`)
  return data?.value as T | null
}

export const getSettings = async (keys: SettingKey[]) => {
  const { data, error } = await supabase
    .from('settings')
    .select('key,value,updated_at')
    .in('key', keys)
  throwIfError(error, 'Failed to load settings')
  return (data || []) as SettingRow[]
}

export const saveSetting = async (key: SettingKey, value: unknown) => {
  const { error } = await supabase.from('settings').upsert({ key, value })
  throwIfError(error, `Failed to save ${key}`)
}

export const saveSettings = async (entries: Array<{ key: SettingKey; value: unknown }>) => {
  if (entries.length === 0) return
  const { error } = await supabase.from('settings').upsert(entries)
  throwIfError(error, 'Failed to save settings')
}
