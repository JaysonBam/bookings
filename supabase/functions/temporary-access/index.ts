import { createAccessBackend } from './backend.ts'
import { createTemporaryAccessHandler } from './core.ts'

const required = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is required`)
  return value
}
const handler = createTemporaryAccessHandler(createAccessBackend(
  required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'), required('SUPABASE_SERVICE_ROLE_KEY'),
))
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
// Login is public; management explicitly verifies Auth and current DB permissions.
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const response = await handler(request)
  for (const [key, value] of Object.entries(cors)) response.headers.set(key, value)
  return response
})
