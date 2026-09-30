export type SupabaseErrorLike = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

export class ApiError extends Error {
  code?: string
  details?: string

  constructor(error: SupabaseErrorLike | Error | string, fallback = 'Request failed') {
    const message = typeof error === 'string'
      ? error
      : error.message || fallback
    super(message)
    this.name = 'ApiError'
    if (typeof error !== 'string' && !(error instanceof Error)) {
      this.code = error.code
      this.details = error.details
    }
  }
}

export const throwIfError = (error: SupabaseErrorLike | null, fallback?: string) => {
  if (error) throw new ApiError(error, fallback)
}

export const getErrorMessage = (error: unknown, fallback = 'Request failed') => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}
