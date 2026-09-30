export const accessDurations = [
  { hours: null, label: 'Never' },
  { hours: 8, label: '8 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 168, label: '7 days' },
] as const

export function hasProfileAccess(profile: { access_expires_at: string | null } | null, now = Date.now()) {
  return !!profile && (profile.access_expires_at === null || Date.parse(profile.access_expires_at) > now)
}

export function formatAccessExpiry(expiresAt: string | null, now = Date.now()) {
  if (expiresAt === null) return 'Never'
  const remaining = Date.parse(expiresAt) - now
  if (!(remaining > 0)) return 'Inactive'
  const minutes = Math.ceil(remaining / 60_000)
  const [amount, unit] = minutes < 60 ? [minutes, 'minute']
    : minutes < 1440 ? [Math.ceil(minutes / 60), 'hour']
    : [Math.ceil(minutes / 1440), 'day']
  return `In ${amount} ${unit}${amount === 1 ? '' : 's'}`
}
