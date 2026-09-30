import { supabase } from './client'
import { throwIfError } from './errors'
import type { CourseRow } from './types'

const COURSE_COLUMNS = 'id,name,color_hex'

export const getCourses = async () => {
  const { data, error } = await supabase.from('courses').select(COURSE_COLUMNS).order('name')
  throwIfError(error, 'Failed to load courses')
  return (data || []) as CourseRow[]
}

export const upsertCourses = async (courses: CourseRow[]) => {
  if (courses.length === 0) return []
  const { data, error } = await supabase.from('courses').upsert(courses).select(COURSE_COLUMNS)
  throwIfError(error, 'Failed to update courses')
  return (data || []) as CourseRow[]
}

export const insertCourses = async (courses: Array<Omit<CourseRow, 'id'>>) => {
  if (courses.length === 0) return []
  const { data, error } = await supabase.from('courses').insert(courses).select(COURSE_COLUMNS)
  throwIfError(error, 'Failed to add courses')
  return (data || []) as CourseRow[]
}

export const deleteCourses = async (ids: number[]) => {
  if (ids.length === 0) return
  const { error } = await supabase.from('courses').delete().in('id', ids)
  throwIfError(error, 'Failed to delete courses')
}
