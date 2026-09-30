import { supabase } from './client'
import { throwIfError } from './errors'
import type { RoomRow } from './types'

const ROOM_COLUMNS = 'id,name,max_people,min_people,is_available,dynamic_labels,borrowable_items'

export const getRooms = async () => {
  const { data, error } = await supabase.from('rooms').select(ROOM_COLUMNS).order('name')
  throwIfError(error, 'Failed to load rooms')
  return (data || []) as RoomRow[]
}

export const getAvailableRooms = async () => {
  const rooms = await getRooms()
  return rooms.filter((room) => room.is_available !== false)
}

export const updateRoom = async (id: number, updates: Partial<RoomRow>) => {
  const { data, error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', id)
    .select(ROOM_COLUMNS)
    .single()
  throwIfError(error, 'Failed to update the room')
  return data as RoomRow
}

export const upsertRooms = async (rooms: RoomRow[]) => {
  if (rooms.length === 0) return []
  const { data, error } = await supabase.from('rooms').upsert(rooms).select(ROOM_COLUMNS)
  throwIfError(error, 'Failed to update rooms')
  return (data || []) as RoomRow[]
}

export const insertRooms = async (rooms: Array<Omit<RoomRow, 'id'>>) => {
  if (rooms.length === 0) return []
  const { data, error } = await supabase.from('rooms').insert(rooms).select(ROOM_COLUMNS)
  throwIfError(error, 'Failed to add rooms')
  return (data || []) as RoomRow[]
}

export const deleteRooms = async (ids: number[]) => {
  if (ids.length === 0) return
  const { error } = await supabase.from('rooms').delete().in('id', ids)
  throwIfError(error, 'Failed to delete rooms')
}
